import { randomBytes, randomInt, randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { MeetingModel } from './meeting.model';
import { cloudinaryService, type PublicMediaAsset } from '../../service/cloudinary.service';
import { guestAvatarError, type GuestAvatarFile } from './meeting-guest-avatar';
import { allocateSpeakers, elapsedSeconds, reminderDueAt, speakingSeconds } from './meeting.rules';
import { UserModel } from '../../model/user.model';
import { notificationService } from '../../service/notification.service';
import { emitToCompany } from '../../socket';

export class MeetingError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function getMeeting(companyCode: string, id: string) {
  const item = await MeetingModel.findOne({ _id: id, companyCode });
  if (!item) throw new MeetingError(404, 'Không tìm thấy cuộc họp.');
  return item;
}

export function assertVersion(item: any, version: number) {
  if (item.__v !== version) {
    throw new MeetingError(409, 'Cuộc họp đã thay đổi. Vui lòng tải lại trước khi thao tác.');
  }
}

export async function saveMeeting(item: any) {
  try {
    await item.save();
  } catch (error: any) {
    if (error.name === 'VersionError') {
      throw new MeetingError(409, 'Có người vừa cập nhật cuộc họp. Vui lòng thử lại.');
    }
    throw error;
  }
  emitToCompany(item.companyCode, 'meeting_updated', {
    id: String(item._id),
    version: item.__v,
  });
  return item;
}

export async function createMeeting(companyCode: string, actorId: string, input: any) {
  if (new Date(input.startsAt) <= new Date()) {
    throw new MeetingError(400, 'Thời gian họp phải ở tương lai.');
  }
  return MeetingModel.create({
    ...input,
    companyCode,
    createdBy: actorId,
    reminderAt: reminderDueAt(input.startsAt, input.reminderDays),
  });
}

export async function updateMeeting(companyCode: string, id: string, input: any) {
  const item = await getMeeting(companyCode, id);
  const locationChanged = (input.latitude !== undefined && input.latitude !== item.latitude)
    || (input.longitude !== undefined && input.longitude !== item.longitude)
    || (input.gpsRadiusMeters !== undefined && input.gpsRadiusMeters !== item.gpsRadiusMeters);
  if (locationChanged) {
    item.checkInQrTokenHash = undefined;
    item.checkInQrExpiresAt = undefined;
  }
  if (input.title !== undefined) item.title = input.title;
  if (input.description !== undefined) item.description = input.description;
  if (input.location !== undefined) item.location = input.location;
  if (input.latitude !== undefined) item.latitude = input.latitude;
  if (input.longitude !== undefined) item.longitude = input.longitude;
  if (input.gpsRadiusMeters !== undefined) item.gpsRadiusMeters = input.gpsRadiusMeters;
  if (input.coverImage !== undefined) item.coverImage = input.coverImage;
  if (input.startsAt !== undefined) {
    item.startsAt = new Date(input.startsAt);
    item.reminderAt = reminderDueAt(input.startsAt, input.reminderDays ?? item.reminderDays);
  }
  if (input.reminderDays !== undefined) {
    item.reminderDays = input.reminderDays;
    item.reminderAt = reminderDueAt(item.startsAt, input.reminderDays);
  }
  if (input.tiers !== undefined) item.tiers = input.tiers;
  if (input.fallbackSeconds !== undefined) item.fallbackSeconds = input.fallbackSeconds;
  if (item.status === "scheduled" && (input.tiers !== undefined || input.fallbackSeconds !== undefined)) {
    item.speakers.forEach((person, index) => { person.seconds = speakingSeconds(index, item.tiers as any, item.fallbackSeconds); });
  }
  return saveMeeting(item);
}

export async function deleteMeeting(companyCode: string, id: string) {
  const item = await getMeeting(companyCode, id);
  await MeetingModel.deleteOne({ _id: item._id, companyCode });
  emitToCompany(companyCode, 'meeting_updated', {
    id: String(item._id),
    deleted: true,
  });
  return { success: true };
}


export async function checkIn(item: any, input: any, actorId: string, canManage: boolean) {
  if (!['scheduled', 'live', 'paused'].includes(item.status)) {
    throw new MeetingError(409, 'Cuộc họp đã dừng check-in.');
  }
  if (!canManage && (input.name || (input.userId && input.userId !== actorId))) {
    throw new MeetingError(403, 'Bạn chỉ có thể tự check-in.');
  }
  const userId = canManage && input.name && !input.userId ? undefined : (input.userId || actorId);
  let person: any;
  if (userId) {
    person = await UserModel.findOne({
      _id: userId,
      companyCode: item.companyCode,
      isActive: { $ne: false },
    })
      .select('displayName email photoURL coverImage companyName industry phone')
      .lean();
    if (!person) throw new MeetingError(404, 'Thành viên không thuộc đơn vị hoặc đã ngừng hoạt động.');
    if (item.speakers.some((p: any) => p.userId === userId)) return item;
  } else {
    if (!input.name) throw new MeetingError(400, 'Vui lòng nhập tên khách mời.');
    if (input.email && item.speakers.some((p: any) => p.email === input.email.toLowerCase())) {
      throw new MeetingError(409, 'Email này đã check-in.');
    }
  }
  if (item.speakers.length >= 1000) {
    throw new MeetingError(400, 'Tối đa 1.000 người mỗi cuộc họp.');
  }
  item.speakers.push({
    id: randomUUID(),
    userId,
    name: person?.displayName || input.name,
    email: (person?.email || input.email || '').toLowerCase(),
    phone: person?.phone || input.phone,
    company: person?.companyName || input.company,
    photoURL: person?.photoURL || input.photoURL,
    coverImage: person?.coverImage || input.coverImage,
    checkedInAt: new Date(),
    seconds: speakingSeconds(item.speakers.length, item.tiers, item.fallbackSeconds),
  });
  if (item.status === 'live' && item.currentIndex === -1) {
    item.currentIndex = 0;
    item.speakerStartedAt = undefined;
    item.elapsedSeconds = 0;
  }
  await saveMeeting(item);
  return item;
}

export async function autoStartDueMeetings(now = new Date()) {
  const dueMeetings = await MeetingModel.find({
    status: 'scheduled',
    startsAt: { $lte: now },
  });
  for (const item of dueMeetings) {
    if (item.speakers && item.speakers.length > 0) {
      item.set('speakers', allocateSpeakers(
        item.speakers.map(p => p.toObject()),
        item.tiers.map(t => ({ count: t.count ?? 0, seconds: t.seconds ?? item.fallbackSeconds })),
        item.fallbackSeconds
      ));
      item.currentIndex = 0;
      item.speakerStartedAt = undefined;
      item.elapsedSeconds = 0;
    } else {
      item.currentIndex = -1;
      item.speakerStartedAt = undefined;
      item.elapsedSeconds = 0;
    }
    item.status = 'live';
    await saveMeeting(item);
  }
  return dueMeetings.length;
}

export async function notifyNextSpeaker(item: any) {
  const next = item.speakers[item.currentIndex + 1];
  if (!next?.userId || !['live', 'paused'].includes(item.status)) return;
  try {
    await notificationService.createNotification({
      companyCode: item.companyCode,
      recipientUid: next.userId,
      title: 'Bạn là người phát biểu tiếp theo',
      body: `${item.title}: ${next.name}, hãy chuẩn bị phần phát biểu ${next.seconds} giây.`,
      type: 'he-thong',
      action: { tab: 'CUỘC HỌP' },
      idempotencyKey: `meeting:${item._id}:next:${next.id}`,
    });
  } catch (error: any) {
    if (error.code !== 11000) console.error('[meeting-notification]', error);
  }
}

export async function controlMeeting(item: any, action: string, now = new Date()) {
  const status = item.status;
  if (action === 'start' && status === 'scheduled') {
    if (item.speakers && item.speakers.length > 0) {
      item.speakers = allocateSpeakers(
        item.speakers.map((p: any) => (p.toObject ? p.toObject() : p)),
        item.tiers,
        item.fallbackSeconds
      );
      item.currentIndex = 0;
      item.speakerStartedAt = undefined;
      item.elapsedSeconds = 0;
    } else {
      item.currentIndex = -1;
      item.speakerStartedAt = undefined;
      item.elapsedSeconds = 0;
    }
    item.status = 'live';
  } else if (action === 'start_speaker' && ['live', 'paused'].includes(status)) {
    item.speakerStartedAt = now;
    item.elapsedSeconds = 0;
    item.status = 'live';
  } else if (action === 'reset_speaker' && ['live', 'paused'].includes(status)) {
    item.speakerStartedAt = undefined;
    item.elapsedSeconds = 0;
  } else if (action === 'pause' && status === 'live') {
    item.elapsedSeconds = elapsedSeconds(item, now);
    item.speakerStartedAt = undefined;
    item.status = 'paused';
  } else if (action === 'resume' && status === 'paused') {
    item.status = 'live';
    item.speakerStartedAt = now;
  } else if (action === 'finish' && ['live', 'paused'].includes(status)) {
    if (item.speakers[item.currentIndex]) {
      item.speakers[item.currentIndex].spokenSeconds = elapsedSeconds(item, now);
    }
    item.status = 'ended';
    item.endedAt = now;
    item.speakerStartedAt = undefined;
  } else if (action === 'finish') {
    throw new MeetingError(409, 'Cuộc họp phải đang diễn ra mới có thể kết thúc.');
  } else if (action === 'next' && ['live', 'paused'].includes(status)) {
    if (item.speakers[item.currentIndex]) {
      item.speakers[item.currentIndex].spokenSeconds = elapsedSeconds(item, now);
    }
    if (item.currentIndex + 1 >= item.speakers.length) {
      item.status = 'ended';
      item.endedAt = now;
      item.speakerStartedAt = undefined;
    } else {
      item.currentIndex++;
      item.elapsedSeconds = 0;
      item.speakerStartedAt = status === 'live' ? now : undefined;
    }
  } else if (action === 'cancel' && status === 'scheduled') {
    item.status = 'cancelled';
  } else {
    throw new MeetingError(409, 'Thao tác không phù hợp với trạng thái cuộc họp hoặc chưa có người check-in.');
  }
  await saveMeeting(item);
  await notifyNextSpeaker(item);
  return item;
}

// ==========================================
// LUCKY DRAW (QUAY THƯỞNG GIỐNG RANDOM.ORG)
// ==========================================

export async function updateLuckyDrawConfig(item: any, config: any) {
  if (!item.luckyDraw) {
    item.luckyDraw = {
      enabled: true,
      allowRepeatWinners: false,
      drawMode: 'attendees',
      numberMin: 1,
      numberMax: 100,
      prizes: [],
    };
  }
  if (typeof config.enabled === 'boolean') item.luckyDraw.enabled = config.enabled;
  if (typeof config.allowRepeatWinners === 'boolean') item.luckyDraw.allowRepeatWinners = config.allowRepeatWinners;
  if (['attendees', 'numbers'].includes(config.drawMode)) item.luckyDraw.drawMode = config.drawMode;
  if (Number.isInteger(config.numberMin) && config.numberMin >= 1) item.luckyDraw.numberMin = config.numberMin;
  if (Number.isInteger(config.numberMax) && config.numberMax >= item.luckyDraw.numberMin) item.luckyDraw.numberMax = config.numberMax;

  await saveMeeting(item);
  return item.luckyDraw;
}

export async function addOrUpdatePrize(item: any, prizeInput: any) {
  if (!item.luckyDraw) {
    item.luckyDraw = {
      enabled: true,
      allowRepeatWinners: false,
      drawMode: 'attendees',
      numberMin: 1,
      numberMax: 100,
      prizes: [],
    };
  }
  const prizes = item.luckyDraw.prizes || [];
  const existingIndex = prizeInput.id ? prizes.findIndex((p: any) => p.id === prizeInput.id) : -1;

  if (existingIndex >= 0) {
    const p = prizes[existingIndex];
    p.name = prizeInput.name || p.name;
    p.reward = prizeInput.reward !== undefined ? prizeInput.reward : p.reward;
    p.quantity = prizeInput.quantity ? Math.max(1, Number(prizeInput.quantity)) : p.quantity;
    p.order = prizeInput.order ? Number(prizeInput.order) : p.order;
    p.imageUrl = prizeInput.imageUrl !== undefined ? prizeInput.imageUrl : p.imageUrl;
    p.color = prizeInput.color || p.color;
  } else {
    prizes.push({
      id: randomUUID(),
      name: prizeInput.name || 'Giải thưởng mới',
      reward: prizeInput.reward || '',
      quantity: Math.max(1, Number(prizeInput.quantity) || 1),
      order: prizeInput.order ? Number(prizeInput.order) : prizes.length + 1,
      imageUrl: prizeInput.imageUrl || '',
      color: prizeInput.color || '#6366f1',
      winners: [],
    });
  }

  prizes.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  item.luckyDraw.prizes = prizes;

  await saveMeeting(item);
  return item.luckyDraw;
}

export async function deletePrize(item: any, prizeId: string) {
  if (!item.luckyDraw?.prizes) return item.luckyDraw;
  item.luckyDraw.prizes = item.luckyDraw.prizes.filter((p: any) => p.id !== prizeId);
  await saveMeeting(item);
  return item.luckyDraw;
}

/**
 * QUAY THƯỞNG: Chức năng quay ngẫu nhiên công bằng giống Random.org
 * ĐIỀU KIỆN QUAN TRỌNG: Chỉ quay khi cuộc họp đã bắt đầu (status !== 'scheduled')!
 */
export async function spinLuckyDraw(item: any, prizeId: string, actorId: string) {
  // 1. Kiểm tra trạng thái cuộc họp: CHỈ QUAY KHI CUỘC HỌP ĐÃ BẮT ĐẦU
  if (item.status === 'scheduled') {
    throw new MeetingError(
      400,
      'Cuộc họp chưa bắt đầu! Tính năng quay thưởng chỉ được phép kích hoạt sau khi cuộc họp đã bắt đầu.'
    );
  }

  if (item.status === 'cancelled') {
    throw new MeetingError(400, 'Cuộc họp đã bị hủy. Không thể quay thưởng.');
  }

  if (!item.luckyDraw?.prizes?.length) {
    throw new MeetingError(400, 'Chưa có cấu hình giải thưởng nào để quay!');
  }

  const prize = item.luckyDraw.prizes.find((p: any) => p.id === prizeId);
  if (!prize) {
    throw new MeetingError(404, 'Không tìm thấy giải thưởng đã chọn.');
  }

  if (prize.winners.length >= prize.quantity) {
    throw new MeetingError(400, `Giải thưởng "${prize.name}" đã đủ số lượng (${prize.quantity}/${prize.quantity}).`);
  }

  const allowRepeat = Boolean(item.luckyDraw.allowRepeatWinners);
  const drawMode = item.luckyDraw.drawMode || 'attendees';

  const previousWinnerIds = new Set<string>();
  if (!allowRepeat) {
    for (const p of item.luckyDraw.prizes) {
      for (const w of p.winners || []) {
        previousWinnerIds.add(String(w.winnerId));
        if (w.ticketNumber) previousWinnerIds.add(`num:${w.ticketNumber}`);
      }
    }
  }

  let chosenWinner: any = null;
  let remainingCount = 0;

  if (drawMode === 'attendees') {
    const attendees = item.speakers || [];
    if (!attendees.length) {
      throw new MeetingError(400, 'Chưa có người tham gia (check-in) nào trong cuộc họp để quay thưởng.');
    }

    const eligibleAttendees = attendees.filter((a: any) => !previousWinnerIds.has(String(a.id)));
    if (!eligibleAttendees.length) {
      throw new MeetingError(400, 'Không còn người tham gia hợp lệ nào chưa trúng giải để tiếp tục quay.');
    }

    const randomIndex = randomInt(0, eligibleAttendees.length);
    const selected = eligibleAttendees[randomIndex];

    chosenWinner = {
      winnerId: selected.id,
      userId: selected.userId,
      name: selected.name,
      email: selected.email,
      photoURL: selected.photoURL,
      coverImage: selected.coverImage,
      ticketNumber: attendees.indexOf(selected) + 1,
    };
    remainingCount = eligibleAttendees.length - 1;
  } else {
    const min = item.luckyDraw.numberMin || 1;
    const max = item.luckyDraw.numberMax || 100;
    const allNumbers: number[] = [];
    for (let i = min; i <= max; i++) {
      if (!previousWinnerIds.has(`num:${i}`)) {
        allNumbers.push(i);
      }
    }

    if (!allNumbers.length) {
      throw new MeetingError(400, 'Không còn số may mắn hợp lệ nào trong khoảng để quay thưởng.');
    }

    const randomIndex = randomInt(0, allNumbers.length);
    const selectedNumber = allNumbers[randomIndex];
    const matchingSpeaker = (item.speakers || [])[selectedNumber - 1];

    chosenWinner = {
      winnerId: matchingSpeaker ? matchingSpeaker.id : `ticket-${selectedNumber}`,
      userId: matchingSpeaker?.userId,
      name: matchingSpeaker ? matchingSpeaker.name : `Số may mắn #${selectedNumber}`,
      email: matchingSpeaker?.email,
      photoURL: matchingSpeaker?.photoURL,
      coverImage: matchingSpeaker?.coverImage,
      ticketNumber: selectedNumber,
    };
    remainingCount = allNumbers.length - 1;
  }

  // 3. Tạo chữ ký minh bạch Random.org Verification Signature
  const seed = randomBytes(16).toString('hex');
  const now = new Date();
  const timestamp = now.toISOString();
  const verificationHash = createHash('sha256')
    .update(`${item._id}:${prize.id}:${chosenWinner.winnerId}:${seed}:${timestamp}`)
    .digest('hex');

  const winnerRecord = {
    id: randomUUID(),
    prizeId: prize.id,
    prizeName: prize.name,
    winnerId: chosenWinner.winnerId,
    userId: chosenWinner.userId,
    name: chosenWinner.name,
    email: chosenWinner.email,
    photoURL: chosenWinner.photoURL,
    coverImage: chosenWinner.coverImage,
    ticketNumber: chosenWinner.ticketNumber,
    wonAt: now,
    drawnBy: actorId,
    verificationHash,
    seed,
    timestamp,
  };

  prize.winners.push(winnerRecord);
  await saveMeeting(item);

  emitToCompany(item.companyCode, 'lucky_draw_spun', {
    meetingId: String(item._id),
    prizeId: prize.id,
    winner: winnerRecord,
    verificationHash,
    seed,
    timestamp,
  });

  return {
    winner: winnerRecord,
    prize,
    verificationHash,
    seed,
    timestamp,
    remainingEligibleCount: remainingCount,
  };
}

export async function redrawPrizeWinner(item: any, prizeId: string, winnerRecordId: string) {
  if (!item.luckyDraw?.prizes) throw new MeetingError(404, 'Không có cấu hình giải thưởng.');
  const prize = item.luckyDraw.prizes.find((p: any) => p.id === prizeId);
  if (!prize) throw new MeetingError(404, 'Không tìm thấy giải thưởng.');

  prize.winners = (prize.winners || []).filter((w: any) => w.id !== winnerRecordId);
  await saveMeeting(item);

  emitToCompany(item.companyCode, 'lucky_draw_redrawn', {
    meetingId: String(item._id),
    prizeId,
    winnerRecordId,
  });

  return prize;
}

export async function resetLuckyDrawWinners(item: any, prizeId?: string) {
  if (!item.luckyDraw?.prizes) return item.luckyDraw;
  if (prizeId) {
    const prize = item.luckyDraw.prizes.find((p: any) => p.id === prizeId);
    if (prize) prize.winners = [];
  } else {
    for (const p of item.luckyDraw.prizes) {
      p.winners = [];
    }
  }
  await saveMeeting(item);
  return item.luckyDraw;
}

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function createCheckInQr(companyCode: string, id: string, hours: number) {
  const item = await getMeeting(companyCode, id);
  if (![1, 2].includes(hours)) throw new MeetingError(400, 'Thời hạn QR chỉ được chọn 1 hoặc 2 giờ.');
  if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number') throw new MeetingError(400, 'Hãy lưu tọa độ GPS địa điểm trước khi tạo QR check-in.');
  if (!['scheduled', 'live', 'paused'].includes(item.status)) throw new MeetingError(409, 'Cuộc họp hiện không nhận check-in.');
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  item.checkInQrTokenHash = createHash('sha256').update(token).digest('hex');
  item.checkInQrExpiresAt = expiresAt;
  await saveMeeting(item);
  return { token, expiresAt, meeting: { id: String(item._id), title: item.title } };
}

function validateQrAndLocation(item: any, input: any) {
  if (!item.checkInQrTokenHash || !item.checkInQrExpiresAt || new Date(item.checkInQrExpiresAt).getTime() <= Date.now()) throw new MeetingError(410, 'Mã QR đã hết hạn hoặc bị thay thế. Hãy liên hệ ban tổ chức.');
  if (!['scheduled', 'live', 'paused'].includes(item.status)) throw new MeetingError(409, 'Cuộc họp hiện không nhận check-in.');
  if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number') throw new MeetingError(409, 'Cuộc họp chưa cấu hình tọa độ GPS.');
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) throw new MeetingError(400, 'Cần cho phép truy cập vị trí GPS để check-in.');
  const distance = distanceMeters(item.latitude, item.longitude, input.latitude, input.longitude);
  if (distance > (item.gpsRadiusMeters || 200)) throw new MeetingError(403, `Bạn đang cách địa điểm họp khoảng ${Math.round(distance)} m; phạm vi check-in là ${item.gpsRadiusMeters || 200} m.`);
}

export async function getPublicQrMeeting(token: string) {
  const hash = createHash('sha256').update(token).digest('hex');
  const item = await MeetingModel.findOne({ checkInQrTokenHash: hash, checkInQrExpiresAt: { $gt: new Date() } }).lean();
  if (!item || !['scheduled', 'live', 'paused'].includes(item.status)) throw new MeetingError(410, 'Mã QR đã hết hạn hoặc không còn hiệu lực.');
  return { title: item.title, startsAt: item.startsAt, location: item.location, expiresAt: item.checkInQrExpiresAt };
}

export async function qrCheckInMember(token: string, input: any) {
  const hash = createHash('sha256').update(token).digest('hex');
  const item: any = await MeetingModel.findOne({ checkInQrTokenHash: hash, checkInQrExpiresAt: { $gt: new Date() } });
  if (!item) throw new MeetingError(410, 'Mã QR đã hết hạn hoặc không còn hiệu lực.');
  validateQrAndLocation(item, input);
  const email = String(input.email || '').trim().toLowerCase();
  const person: any = await UserModel.findOne({ email, companyCode: item.companyCode, isActive: { $ne: false } }).select('+password displayName email photoURL coverImage password').lean();
  if (!person?.password || !(await bcrypt.compare(input.password, person.password))) throw new MeetingError(401, 'Tài khoản hoặc mật khẩu không đúng với thành viên của đơn vị tổ chức.');
  await checkIn(item, { userId: String(person._id) }, String(person._id), false);
  return { success: true, name: person.displayName };
}

export async function qrCheckInGuest(token: string, input: any, avatar?: GuestAvatarFile) {
  const hash = createHash('sha256').update(token).digest('hex');
  const query = { checkInQrTokenHash: hash, checkInQrExpiresAt: { $gt: new Date() } };
  let item: any = await MeetingModel.findOne(query);
  if (!item) throw new MeetingError(410, 'Mã QR đã hết hạn hoặc không còn hiệu lực.');
  validateQrAndLocation(item, input);
  let uploaded: PublicMediaAsset | undefined;
  if (avatar) {
    const error = guestAvatarError(avatar);
    if (error) throw new MeetingError(400, error);
    if (item.speakers.length >= 1000) throw new MeetingError(400, 'Tối đa 1.000 người mỗi cuộc họp.');
    if (input.email && item.speakers.some((p: any) => p.email === input.email.toLowerCase())) {
      throw new MeetingError(409, 'Email này đã check-in.');
    }
    try {
      uploaded = await cloudinaryService.uploadMediaAsset(
        `data:${avatar.mimetype};base64,${avatar.buffer.toString('base64')}`,
        `meetings/${item._id}/guests`
      );
    } catch {
      throw new MeetingError(502, 'Chưa tải được ảnh đại diện. Vui lòng thử lại hoặc bỏ ảnh để check-in.');
    }
  }
  try {
    if (uploaded) {
      if (uploaded.resourceType !== 'image') throw new MeetingError(400, 'Tệp tải lên không phải ảnh hợp lệ.');
      // Upload may take time: recheck QR, location and the latest attendee list before saving.
      item = await MeetingModel.findOne({ ...query, checkInQrExpiresAt: { $gt: new Date() } });
      if (!item) throw new MeetingError(410, 'Mã QR đã hết hạn hoặc bị thay thế. Hãy quét mã mới.');
      validateQrAndLocation(item, input);
    }
    await checkIn(item, { name: input.name, email: input.email, phone: input.phone, company: input.company, photoURL: uploaded?.secureUrl }, 'public-qr', true);
    return { success: true, name: input.name };
  } catch (error) {
    if (uploaded) {
      // Do not delete an image already persisted if a later notification fails.
      try {
        const saved = await MeetingModel.exists({ 'speakers.photoURL': uploaded.secureUrl });
        if (!saved) await cloudinaryService.deletePublicMedia(uploaded.publicId, uploaded.resourceType);
      } catch { /* Preserve the original check-in error if cleanup is unavailable. */ }
    }
    throw error;
  }
}