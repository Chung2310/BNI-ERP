import { recurringMeetingDates } from "../../../src/utils/meetingRecurrence";
import { normalizeLoginIdentifier } from "../../../src/utils/loginIdentifier";
import { reserveMeetingNumbers } from "./meeting-sequence";
import { randomBytes, randomInt, randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { encryptSecret, decryptSecret } from '../../security/crypto';
import type { IUser } from '../../interface/user.interface';
import { MeetingModel, MeetingCheckInQrModel } from './meeting.model';
import { DEFAULT_MEETING_DURATION_MS, meetingEndsAt } from './meeting-qr.rules';
import { cloudinaryService, type PublicMediaAsset } from '../../service/cloudinary.service';
import { guestAvatarError, type GuestAvatarFile } from './meeting-guest-avatar';
import { allocateSpeakers, elapsedSeconds, reminderDueAt, speakingSeconds } from './meeting.rules';
import { UserModel } from '../../model/user.model';
import { notificationService } from '../../service/notification.service';
import { emitToCompany } from '../../socket';

export type MeetingDocument = ReturnType<typeof MeetingModel.hydrate>;
export type CheckInInput = {
  latitude?: number; longitude?: number; userId?: string; name?: string; email?: string;
  phone?: string; company?: string; industry?: string; bio?: string; photoURL?: string; coverImage?: string;
};
export type MeetingInput = {
  title: string; startsAt: string | Date; endsAt?: string | Date; description?: string; location?: string;
  latitude?: number; longitude?: number; gpsRadiusMeters?: number; coverImage?: string;
  reminderDays?: number; tiers: { startTime?: string; endTime?: string; count?: number; seconds: number }[]; fallbackSeconds: number;
};
type PrizeInput = { id?: string; name?: string; reward?: string; quantity?: number; order?: number; imageUrl?: string; color?: string };
type WinnerInput = { id: string; winnerId: string; source: 'wheel' | 'bingo'; name: string; prizeName: string; photoURL?: string; ticketNumber?: number; wonAt: Date };
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

export function assertVersion(item: MeetingDocument, version: number) {
  if (item.__v !== version) {
    throw new MeetingError(409, 'Cuộc họp đã thay đổi. Vui lòng tải lại trước khi thao tác.');
  }
}

export function assertMeetingEditable(item: { status: string }) {
  if (item.status === 'ended') throw new MeetingError(409, 'Cuộc họp đã kết thúc, chỉ có thể xem thông tin.');
}

export async function saveMeeting(item: MeetingDocument) {
  try {
    await item.save();
  } catch (error) {
    if (error.name === 'VersionError') {
      throw new MeetingError(409, 'Có người vừa cập nhật cuộc họp. Vui lòng thử lại.');
    }
    throw error;
  }
  const meeting = typeof item.toObject === 'function' ? item.toObject() : item;
  emitToCompany(item.companyCode, 'meeting_updated', {
    id: String(item._id),
    version: item.__v,
    serverNow: Date.now(),
    // Include the display state so connected screens can switch immediately,
    // without rebuilding every profile slide after each controller action.
    live: {
      _id: String(item._id),
      companyCode: item.companyCode,
      title: item.title,
      startsAt: item.startsAt,
      status: item.status,
      speakers: item.speakers.map((speaker) => {
        const person = typeof speaker.toObject === 'function' ? speaker.toObject() : speaker;
        return {
          id: person.id, userId: person.userId, name: person.name,
          company: person.company, industry: person.industry, photoURL: person.photoURL,
          checkedInAt: person.checkedInAt, seconds: person.seconds,
          spokenSeconds: person.spokenSeconds, deferred: person.deferred,
        };
      }),
      presentation: meeting.presentation,
      currentIndex: item.currentIndex,
      speakerStartedAt: item.speakerStartedAt,
      speechesCompletedAt: item.speechesCompletedAt,
      elapsedSeconds: item.elapsedSeconds,
      endedAt: item.endedAt,
      luckyDraw: item.luckyDraw ? {
        enabled: item.luckyDraw.enabled,
        allowRepeatWinners: item.luckyDraw.allowRepeatWinners,
        drawMode: item.luckyDraw.drawMode,
        numberMin: item.luckyDraw.numberMin,
        numberMax: item.luckyDraw.numberMax,
        prizes: (item.luckyDraw.prizes || []).map((prize) => ({
          id: prize.id, name: prize.name, reward: prize.reward, quantity: prize.quantity,
          order: prize.order, imageUrl: prize.imageUrl, color: prize.color,
          winners: (prize.winners || []).map((winner) => ({
            source: winner.source, id: winner.id, prizeId: winner.prizeId,
            prizeName: winner.prizeName, winnerId: winner.winnerId,
            userId: winner.userId, name: winner.name, photoURL: winner.photoURL,
            coverImage: winner.coverImage, ticketNumber: winner.ticketNumber,
            wonAt: winner.wonAt, reward: winner.reward,
          })),
        })),
      } : undefined,
      __v: item.__v,
    },
  });
  return item;
}

export async function recordGameWinner(item: MeetingDocument, input: WinnerInput, actorId: string) {
  assertMeetingEditable(item);
  const existing = (item.gameWinners || []).find((winner) => winner.id === input.id);
  if (existing) return existing;
  const attendee = (item.speakers || []).find((speaker) => speaker.id === input.winnerId || speaker.userId === input.winnerId);
  const prize = item.luckyDraw?.prizes?.find((prize) => prize.name === input.prizeName);
  const record = { ...input, prizeId: input.id, drawnBy: actorId,
    reward: prize?.reward,
    name: attendee?.name || input.name, email: attendee?.email,
    userId: attendee?.userId, photoURL: attendee?.photoURL || input.photoURL };
  if (!item.gameWinners) item.set('gameWinners', []);
  item.gameWinners.push(record);
  await saveMeeting(item);
  emitToCompany(item.companyCode, 'lucky_draw_spun', { meetingId: String(item._id), winner: record });
  return record;
}

export async function createMeeting(companyCode: string, actorId: string, input: MeetingInput) {
  if (new Date(input.startsAt) <= new Date()) {
    throw new MeetingError(400, 'Thời gian họp phải ở tương lai.');
  }
  const endsAt = meetingEndsAt(input.startsAt, input.endsAt);
  if (!Number.isFinite(endsAt.getTime()) || endsAt <= new Date(input.startsAt)) {
    throw new MeetingError(400, 'Giờ kết thúc phải sau giờ bắt đầu cuộc họp.');
  }
  return MeetingModel.create({
    ...input,
    endsAt,
    companyCode,
    createdBy: actorId,
    reminderAt: reminderDueAt(new Date(input.startsAt), input.reminderDays),
  });
}

export async function createRecurringMeetings(companyCode: string, actorId: string, input: Omit<MeetingInput, 'startsAt'> & { startsAt?: never; recurrence: Parameters<typeof recurringMeetingDates>[0] & { durationMinutes?: number } }) {
  const { recurrence, startsAt: _ignored, ...details } = input;
  let dates: Date[];
  try { dates = recurringMeetingDates(recurrence); } catch (error) { throw new MeetingError(400, error.message); }
  if (!dates.length || dates.some(date => date <= new Date())) throw new MeetingError(400, "Các buổi họp phải ở tương lai. Vui lòng chọn lại ngày bắt đầu.");
  const seriesId = randomUUID();
  const customTitle = details.title?.trim();
  const firstNumber = customTitle ? 0 : await reserveMeetingNumbers(companyCode, dates.length);
  const rows = dates.map((startsAt, index) => ({ ...details, title: customTitle || `BNI Chapter #${firstNumber + index}`, companyCode, createdBy: actorId, seriesId, startsAt, endsAt: new Date(startsAt.getTime() + (recurrence.durationMinutes ?? 120) * 60000), originalStartsAt: startsAt, reminderAt: reminderDueAt(startsAt, details.reminderDays ?? 1) }));
  try {
    const meetings = await MeetingModel.insertMany(rows, { ordered: true });
    emitToCompany(companyCode, 'meeting_updated', { seriesId });
    return meetings;
  } catch (error) {
    // Compensate partial insertion on standalone MongoDB as well as replica sets.
    await MeetingModel.deleteMany({ companyCode, seriesId });
    throw error;
  }
}

export async function updateMeeting(companyCode: string, id: string, input: Partial<MeetingInput> & { version?: number }) {
  const item = await getMeeting(companyCode, id);
  assertMeetingEditable(item);
  if (input.version !== undefined) assertVersion(item, input.version);
  const timeChanged = input.startsAt !== undefined && new Date(input.startsAt).getTime() !== item.startsAt.getTime();
  if (timeChanged && (item.status !== 'scheduled' || !Number.isFinite(new Date(input.startsAt).getTime()) || new Date(input.startsAt) <= new Date())) {
    throw new MeetingError(400, 'Chỉ có thể dời buổi chưa diễn ra sang thời gian trong tương lai.');
  }
  if (timeChanged || (input.reminderDays !== undefined && input.reminderDays !== item.reminderDays)) item.revision += 1;
  if (input.startsAt !== undefined || input.endsAt !== undefined) {
    const start = new Date(input.startsAt ?? item.startsAt);
    const previousDuration = item.endsAt ? new Date(item.endsAt).getTime() - new Date(item.startsAt).getTime() : DEFAULT_MEETING_DURATION_MS;
    const end = input.endsAt !== undefined ? new Date(input.endsAt)
      : timeChanged ? new Date(start.getTime() + previousDuration) : meetingEndsAt(start, item.endsAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      throw new MeetingError(400, 'Giờ kết thúc phải sau giờ bắt đầu cuộc họp.');
    }
    item.endsAt = end;
  }
  const locationChanged = (input.latitude !== undefined && input.latitude !== item.latitude)
    || (input.longitude !== undefined && input.longitude !== item.longitude)
    || (input.gpsRadiusMeters !== undefined && input.gpsRadiusMeters !== item.gpsRadiusMeters);
  if (locationChanged || timeChanged) {
    item.checkInQrTokenHash = undefined;
    item.checkInQrTokenEncrypted = undefined;
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
    item.reminderAt = reminderDueAt(item.startsAt, input.reminderDays ?? item.reminderDays);
  }
  if (input.reminderDays !== undefined) {
    item.reminderDays = input.reminderDays;
    item.reminderAt = reminderDueAt(item.startsAt, input.reminderDays);
  }
  if (input.tiers !== undefined) item.set('tiers', input.tiers);
  if (input.fallbackSeconds !== undefined) item.fallbackSeconds = input.fallbackSeconds;
  if (item.status === "scheduled" && (input.tiers !== undefined || input.fallbackSeconds !== undefined)) {
    item.set('speakers', allocateSpeakers(
      item.speakers.map(person => person.toObject()),
      item.tiers.map(tier => ({ startTime: tier.startTime, endTime: tier.endTime, count: tier.count, seconds: tier.seconds ?? item.fallbackSeconds })),
      item.fallbackSeconds
    ));
  }
  return saveMeeting(item);
}

export async function bulkUpdateMeetingSeries(companyCode: string, id: string, input: any) {
  const anchor = await getMeeting(companyCode, id);
  if (!anchor.seriesId) throw new MeetingError(400, 'Cuộc họp này không thuộc chu kỳ định kỳ.');
  const meetingIds: string[] = input.meetingIds;
  if (!meetingIds.length) throw new MeetingError(400, 'Vui l\u00f2ng ch\u1ecdn \u00edt nh\u1ea5t m\u1ed9t bu\u1ed5i h\u1ecdp.');
  const selected = await MeetingModel.find({ companyCode, seriesId: anchor.seriesId, _id: { $in: meetingIds }, status: 'scheduled', startsAt: { $gt: new Date() } }).lean();
  if (!selected.length) throw new MeetingError(404, 'Kh\u00f4ng c\u00f3 bu\u1ed5i h\u1ecdp n\u00e0o trong danh s\u00e1ch c\u00f3 th\u1ec3 c\u1eadp nh\u1eadt.');
  if (selected.length !== meetingIds.length) throw new MeetingError(409, 'Danh s\u00e1ch bu\u1ed5i h\u1ecdp \u0111\u00e3 thay \u0111\u1ed5i. H\u00e3y t\u1ea3i l\u1ea1i l\u1ecbch r\u1ed3i th\u1eed l\u1ea1i.');

  const changes = input.changes;
  const updates = selected.map((item: any) => {
    const set: Record<string, unknown> = {};
    for (const key of ['location', 'latitude', 'longitude', 'gpsRadiusMeters', 'coverImage', 'tiers', 'fallbackSeconds'] as const) {
      if (changes[key] !== undefined) set[key] = changes[key];
    }
    if (item.status === 'scheduled' && (changes.tiers !== undefined || changes.fallbackSeconds !== undefined)) {
      set.speakers = allocateSpeakers(
        (item.speakers || []).map((person: any) => typeof person.toObject === 'function' ? person.toObject() : person),
        changes.tiers ?? item.tiers,
        changes.fallbackSeconds ?? item.fallbackSeconds ?? 20,
      );
    }
    if (changes.startsTime !== undefined) {
      const date = new Date(new Date(item.startsAt).getTime() + 7 * 3600000).toISOString().slice(0, 10);
      const startsAt = new Date(date + 'T' + changes.startsTime + ':00+07:00');
      if (startsAt <= new Date()) throw new MeetingError(400, 'Gi\u1edd m\u1edbi khi\u1ebfn m\u1ed9t ho\u1eb7c nhi\u1ec1u bu\u1ed5i h\u1ecdp kh\u00f4ng c\u00f2n \u1edf t\u01b0\u01a1ng lai.');
      const duration = changes.durationMinutes !== undefined ? changes.durationMinutes * 60000 : item.endsAt ? new Date(item.endsAt).getTime() - new Date(item.startsAt).getTime() : DEFAULT_MEETING_DURATION_MS;
      set.startsAt = startsAt;
      set.endsAt = new Date(startsAt.getTime() + duration);
    } else {
      if (changes.durationMinutes !== undefined) set.endsAt = new Date(new Date(item.startsAt).getTime() + changes.durationMinutes * 60000);
    }

    const qrChanged = changes.startsTime !== undefined || changes.durationMinutes !== undefined
      || changes.latitude !== undefined || changes.longitude !== undefined || changes.gpsRadiusMeters !== undefined;
    return {
      updateOne: {
        filter: { _id: item._id, companyCode, seriesId: anchor.seriesId, status: 'scheduled', __v: item.__v },
        update: {
          ...(Object.keys(set).length ? { $set: set } : {}),
          $inc: { __v: 1, ...(changes.startsTime !== undefined || changes.durationMinutes !== undefined ? { revision: 1 } : {}) },
          ...(qrChanged ? { $unset: { checkInQrTokenHash: 1, checkInQrTokenEncrypted: 1, checkInQrExpiresAt: 1 } } : {}),
        },
      },
    };
  });
  const result = await MeetingModel.bulkWrite(updates as any, { ordered: true });
  if (result.matchedCount !== selected.length) {
    emitToCompany(companyCode, 'meeting_updated', { seriesId: anchor.seriesId });
    throw new MeetingError(409, 'Một buổi họp vừa thay đổi hoặc bắt đầu. Hãy tải lại lịch rồi thử lại.');
  }
  emitToCompany(companyCode, 'meeting_updated', { seriesId: anchor.seriesId });
  return { updatedCount: result.modifiedCount, seriesId: anchor.seriesId };
}

export async function deleteMeeting(companyCode: string, id: string) {
  const item = await getMeeting(companyCode, id);
  assertMeetingEditable(item);
  const result = await MeetingModel.deleteOne({ _id: item._id, companyCode, status: { $ne: 'ended' } });
  if (!result.deletedCount) throw new MeetingError(409, 'Cuộc họp đã thay đổi. Vui lòng tải lại trước khi thao tác.');
  emitToCompany(companyCode, 'meeting_updated', {
    id: String(item._id),
    deleted: true,
  });
  return { success: true };
}


export async function checkInFromModule(item: MeetingDocument, input: CheckInInput, actorId: string, canManage: boolean) {
  if (!canManage) validateCheckInLocation(item, input);
  return checkIn(item, input, actorId, canManage);
}

export async function checkIn(item: MeetingDocument, input: CheckInInput, actorId: string, canManage: boolean) {
  assertMeetingEditable(item);
  if (!['scheduled', 'live', 'paused'].includes(item.status)) {
    throw new MeetingError(409, 'Cuộc họp đã dừng check-in.');
  }
  if (!canManage && (input.name || (input.userId && input.userId !== actorId))) {
    throw new MeetingError(403, 'Bạn chỉ có thể tự check-in.');
  }
  const userId = canManage && input.name && !input.userId ? undefined : (input.userId || actorId);
  let person: Partial<IUser>;
  if (userId) {
    person = await UserModel.findOne({
      _id: userId,
      companyCode: item.companyCode,
      isActive: { $ne: false },
    })
      .select('displayName email photoURL coverImage companyName industry phone')
      .lean();
    if (!person) throw new MeetingError(404, 'Thành viên không thuộc đơn vị hoặc đã ngừng hoạt động.');
    if (item.speakers.some((p) => p.userId === userId)) return item;
  } else {
    if (!input.name) throw new MeetingError(400, 'Vui lòng nhập tên khách mời.');
    if (input.email && item.speakers.some((p) => p.email === input.email.toLowerCase())) {
      throw new MeetingError(409, 'Email này đã check-in.');
    }
  }
  if (item.speakers.length >= 1000) {
    throw new MeetingError(400, 'Tối đa 1.000 người mỗi cuộc họp.');
  }
  const checkedInAt = new Date();
  item.speakers.push({
    id: randomUUID(),
    userId,
    name: person?.displayName || input.name,
    email: (person?.email || input.email || '').toLowerCase(),
    phone: person?.phone || input.phone,
    company: person?.companyName || input.company,
    industry: person?.industry || input.industry,
    bio: input.bio,
    photoURL: person?.photoURL || input.photoURL,
    coverImage: person?.coverImage || input.coverImage,
    checkedInAt,
    seconds: speakingSeconds(checkedInAt, item.tiers.map(tier => ({ ...(typeof tier.toObject === 'function' ? tier.toObject() : tier), seconds: tier.seconds ?? item.fallbackSeconds })), item.fallbackSeconds, item.speakers.length),
  });
  if (['live', 'paused'].includes(item.status) && (item.currentIndex === -1 || item.speechesCompletedAt)) {
    item.currentIndex = item.speechesCompletedAt ? item.speakers.length - 1 : 0;
    item.speechesCompletedAt = undefined;
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
        item.tiers.map(t => ({ startTime: t.startTime, endTime: t.endTime, count: t.count, seconds: t.seconds ?? item.fallbackSeconds })),
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
    item.startedAt = now;
    item.status = 'live';
    await saveMeeting(item);
  }
  return dueMeetings.length;
}

export async function notifyNextSpeaker(item: MeetingDocument) {
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
  } catch (error) {
    if (error.code !== 11000) console.error('[meeting-notification]', error);
  }
}

export async function reorderMeetingSpeakers(item: MeetingDocument, speakerIds: unknown) {
  assertMeetingEditable(item);
  if (!['scheduled', 'live', 'paused'].includes(item.status) || !Array.isArray(speakerIds)
    || speakerIds.length !== item.speakers.length || new Set(speakerIds).size !== item.speakers.length
    || speakerIds.some(id => !item.speakers.some((speaker) => speaker.id === id))) {
    throw new MeetingError(400, 'Thứ tự người nói không hợp lệ.');
  }
  const pendingStart = item.status === 'scheduled' ? 0 : Math.max(0,
    item.currentIndex + (item.speakerStartedAt || item.elapsedSeconds > 0 ? 1 : 0));
  if (item.speakers.slice(0, pendingStart).some((speaker, index: number) => speaker.id !== speakerIds[index])) {
    throw new MeetingError(409, 'Chỉ có thể sắp xếp người đang chờ; giữ nguyên người đang nói và các lượt đã hoàn tất.');
  }
  const byId = new Map(item.speakers.map((speaker) => [speaker.id, speaker]));
  item.set('speakers', speakerIds.map(id => byId.get(id)));
  await saveMeeting(item);
  await notifyNextSpeaker(item);
  return item;
}

export async function deferMeetingSpeaker(item: MeetingDocument, speakerId: string, now = new Date()) {
  if (item.speakers.at(-1)?.id === speakerId) throw new MeetingError(409, 'Người này đã ở cuối danh sách.');
  return deferMeetingSpeakers(item, [speakerId], now);
}

export async function deferMeetingSpeakers(item: MeetingDocument, speakerIds: unknown, now = new Date()) {
  assertMeetingEditable(item);
  if (!['scheduled', 'live', 'paused'].includes(item.status)) throw new MeetingError(409, 'Cuộc họp không còn nhận điều hành phát biểu.');
  if (!Array.isArray(speakerIds) || !speakerIds.length || speakerIds.length > 1000 || speakerIds.some(id => typeof id !== 'string' || !id) || new Set(speakerIds).size !== speakerIds.length) throw new MeetingError(400, 'Chọn danh sách người cần để cuối lượt hợp lệ.');
  const ids = new Set(speakerIds);
  const first = item.status === 'scheduled' ? 0 : Math.max(0, item.currentIndex);
  for (const id of ids) {
    const index = item.speakers.findIndex((speaker) => speaker.id === id);
    if (index < 0) throw new MeetingError(404, 'Không tìm thấy người phát biểu.');
    if (index < first) throw new MeetingError(409, 'Không thể hoãn lượt đã hoàn tất.');
  }
  const waiting = item.speakers.slice(first);
  const remaining = waiting.filter((person) => !ids.has(person.id));
  if (!remaining.length) throw new MeetingError(409, 'Cần giữ ít nhất một người để tiếp tục phát biểu.');
  const isCurrent = item.status !== 'scheduled' && ids.has(item.speakers[item.currentIndex]?.id);
  const deferred = waiting.filter((person) => ids.has(person.id));
  for (const person of deferred) person.deferred = true;
  // Keep the original relative order in both groups and save the batch atomically.
  item.set('speakers', [...item.speakers.slice(0, first), ...remaining, ...deferred]);
  if (isCurrent) {
    item.elapsedSeconds = 0;
    item.speakerStartedAt = item.status === 'live' ? now : undefined;
    item.speakers[item.currentIndex].deferred = false;
  }
  await saveMeeting(item);
  await notifyNextSpeaker(item);
  return item;
}

export async function startMeetingPresentation(item: MeetingDocument, speakerId: string, now = new Date()) {
  assertMeetingEditable(item);
  if (!['scheduled', 'live', 'paused'].includes(item.status)) throw new MeetingError(409, 'Cuộc họp hiện không thể bắt đầu thuyết trình.');
  const index = item.speakers.findIndex((speaker) => speaker.id === speakerId);
  if (index < 0) throw new MeetingError(400, 'Không tìm thấy người thuyết trình.');
  const sameSpeaker = item.status !== 'scheduled' && item.currentIndex === index;
  if (item.status === 'scheduled') {
    item.startedAt = now;
    item.set('speakers', allocateSpeakers(item.speakers.map((person) => person.toObject()), item.tiers.map(tier => ({ ...tier.toObject(), seconds: tier.seconds ?? item.fallbackSeconds })), item.fallbackSeconds));
  }
  if (!sameSpeaker) {
    if (item.status !== 'scheduled' && item.speakers[item.currentIndex]) item.speakers[item.currentIndex].spokenSeconds = elapsedSeconds(item, now);
    item.currentIndex = index;
    item.elapsedSeconds = 0;
    item.speakers[index].spokenSeconds = undefined;
    item.speakerStartedAt = now;
  } else if (item.status === 'paused' || !item.speakerStartedAt) {
    item.speakerStartedAt = now;
  }
  item.status = 'live';
  item.speakers[index].deferred = false;
  item.set('presentation', { ...item.toObject().presentation, view: 'speaker' });
  item.speechesCompletedAt = undefined;
  await saveMeeting(item);
  await notifyNextSpeaker(item);
  return item;
}

export async function controlMeeting(item: MeetingDocument, action: string, now = new Date()) {
  assertMeetingEditable(item);
  const status = item.status;
  if (['start_speaker', 'reset_speaker', 'next', 'previous'].includes(action) && !item.speakers[item.currentIndex]) {
    throw new MeetingError(409, 'Không có người đang chờ phát biểu.');
  }
  if (action === 'start' && status === 'scheduled') {
    item.startedAt = now;
    if (item.speakers && item.speakers.length > 0) {
      item.set('speakers', allocateSpeakers(
        item.speakers.map((p) => (p.toObject ? p.toObject() : p)),
        item.tiers.map(tier => ({ ...tier.toObject(), seconds: tier.seconds ?? item.fallbackSeconds })),
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
    item.speechesCompletedAt = undefined;
  } else if (action === 'start_speaker' && ['live', 'paused'].includes(status)) {
    item.speakers[item.currentIndex].deferred = false;
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
    item.speakerStartedAt = item.speakers[item.currentIndex] && item.elapsedSeconds > 0 ? now : undefined;
  } else if (action === 'finish' && ['live', 'paused'].includes(status)) {
    if (item.speakers[item.currentIndex]) {
      item.speakers[item.currentIndex].spokenSeconds = elapsedSeconds(item, now);
    }
    item.status = 'ended';
    item.endedAt = now;
    item.speakerStartedAt = undefined;
  } else if (action === 'finish') {
    throw new MeetingError(409, 'Cuộc họp phải đang diễn ra mới có thể kết thúc.');
  } else if (action === 'previous' && ['live', 'paused'].includes(status)) {
    if (item.currentIndex <= 0) throw new MeetingError(409, 'Đang ở người phát biểu đầu tiên.');
    item.speakers[item.currentIndex].spokenSeconds = elapsedSeconds(item, now);
    item.currentIndex--;
    item.speakers[item.currentIndex].deferred = false;
    item.elapsedSeconds = 0;
    item.speakers[item.currentIndex].spokenSeconds = undefined;
    item.speakerStartedAt = status === 'live' ? now : undefined;
  } else if (action === 'next' && ['live', 'paused'].includes(status)) {
    if (item.speakers[item.currentIndex]) {
      item.speakers[item.currentIndex].spokenSeconds = elapsedSeconds(item, now);
    }
    if (item.currentIndex + 1 >= item.speakers.length) {
      item.currentIndex = item.speakers.length;
      item.speechesCompletedAt = now;
      item.elapsedSeconds = 0;
      item.speakerStartedAt = undefined;
    } else {
      item.currentIndex++;
      item.speakers[item.currentIndex].deferred = false;
      item.elapsedSeconds = 0;
      item.speakerStartedAt = status === 'live' ? now : undefined;
    }
  } else if (action === 'cancel' && status === 'scheduled') {
    item.status = 'cancelled';
  } else {
    throw new MeetingError(409, 'Thao tác không phù hợp với trạng thái cuộc họp hoặc chưa có người check-in.');
  }
  if (action === 'next' || action === 'previous') {
    item.set('presentation', { ...item.toObject().presentation, view: 'speaker' });
  }
  await saveMeeting(item);
  await notifyNextSpeaker(item);
  return item;
}

// ==========================================
// LUCKY DRAW (QUAY THƯỞNG GIỐNG RANDOM.ORG)
// ==========================================

export async function updateLuckyDrawConfig(item: MeetingDocument, config: { enabled?: boolean; allowRepeatWinners?: boolean; drawMode?: 'attendees' | 'numbers'; numberMin?: number; numberMax?: number }) {
  assertMeetingEditable(item);
  if (!item.luckyDraw) {
    item.set('luckyDraw', {
      enabled: true,
      allowRepeatWinners: false,
      drawMode: 'attendees',
      numberMin: 1,
      numberMax: 100,
      prizes: [],
    });
  }
  if (typeof config.enabled === 'boolean') item.luckyDraw.enabled = config.enabled;
  if (typeof config.allowRepeatWinners === 'boolean') item.luckyDraw.allowRepeatWinners = config.allowRepeatWinners;
  if (['attendees', 'numbers'].includes(config.drawMode)) item.luckyDraw.drawMode = config.drawMode;
  if (Number.isInteger(config.numberMin) && config.numberMin >= 1) item.luckyDraw.numberMin = config.numberMin;
  if (Number.isInteger(config.numberMax) && config.numberMax >= item.luckyDraw.numberMin) item.luckyDraw.numberMax = config.numberMax;

  await saveMeeting(item);
  return item.luckyDraw;
}

export async function addOrUpdatePrize(item: MeetingDocument, prizeInput: PrizeInput) {
  assertMeetingEditable(item);
  if (!item.luckyDraw) {
    item.set('luckyDraw', {
      enabled: true,
      allowRepeatWinners: false,
      drawMode: 'attendees',
      numberMin: 1,
      numberMax: 100,
      prizes: [],
    });
  }
  const prizes = item.luckyDraw.prizes || [];
  const existingIndex = prizeInput.id ? prizes.findIndex((p) => p.id === prizeInput.id) : -1;

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

  prizes.sort((a, b) => (a.order || 0) - (b.order || 0));
  item.set('luckyDraw.prizes', prizes);

  await saveMeeting(item);
  return item.luckyDraw;
}

export async function deletePrize(item: MeetingDocument, prizeId: string) {
  assertMeetingEditable(item);
  if (!item.luckyDraw?.prizes) return item.luckyDraw;
  item.set('luckyDraw.prizes', item.luckyDraw.prizes.filter((p) => p.id !== prizeId));
  await saveMeeting(item);
  return item.luckyDraw;
}

/**
 * QUAY THƯỞNG: Chức năng quay ngẫu nhiên công bằng giống Random.org
 * ĐIỀU KIỆN QUAN TRỌNG: Chỉ quay khi cuộc họp đã bắt đầu (status !== 'scheduled')!
 */
export async function spinLuckyDraw(item: MeetingDocument, prizeId: string, actorId: string, broadcast = false) {
  assertMeetingEditable(item);
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

  const prize = item.luckyDraw.prizes.find((p) => p.id === prizeId);
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

  let chosenWinner: { winnerId: string; userId?: string; name: string; email?: string; photoURL?: string; coverImage?: string; ticketNumber?: number } = null;
  let remainingCount = 0;

  if (drawMode === 'attendees') {
    const attendees = item.speakers || [];
    if (!attendees.length) {
      throw new MeetingError(400, 'Chưa có người tham gia (check-in) nào trong cuộc họp để quay thưởng.');
    }

    const eligibleAttendees = attendees.filter((a) => !previousWinnerIds.has(String(a.id)));
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
    source: 'draw',
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
  if (broadcast) {
    const state = item.toObject().presentation || {};
    item.set('presentation', { ...state, view: 'luckyDraw', drawWinnerId: winnerRecord.id,
      drawStartedAt: now, drawRevealsAt: new Date(now.getTime() + 5000) });
  }
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

export async function redrawPrizeWinner(item: MeetingDocument, prizeId: string, winnerRecordId: string) {
  assertMeetingEditable(item);
  if (!item.luckyDraw?.prizes) throw new MeetingError(404, 'Không có cấu hình giải thưởng.');
  const prize = item.luckyDraw.prizes.find((p) => p.id === prizeId);
  if (!prize) throw new MeetingError(404, 'Không tìm thấy giải thưởng.');

  prize.set('winners', (prize.winners || []).filter((w) => w.id !== winnerRecordId));
  await saveMeeting(item);

  emitToCompany(item.companyCode, 'lucky_draw_redrawn', {
    meetingId: String(item._id),
    prizeId,
    winnerRecordId,
  });

  return prize;
}

export async function resetLuckyDrawWinners(item: MeetingDocument, prizeId?: string) {
  assertMeetingEditable(item);
  if (!item.luckyDraw?.prizes) return item.luckyDraw;
  if (prizeId) {
    const prize = item.luckyDraw.prizes.find((p) => p.id === prizeId);
    if (prize) prize.set('winners', []);
  } else {
    for (const p of item.luckyDraw.prizes) {
      p.set('winners', []);
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

// A company has exactly one token. Only initialization may write the token fields.
export async function getCompanyCheckInQr(companyCode: string) {
  if (!companyCode) throw new MeetingError(403, 'Tài khoản chưa thuộc đơn vị tổ chức.');
  let qr = await MeetingCheckInQrModel.findOne({ companyCode }).select('+tokenEncrypted');
  if (!qr?.tokenHash && !qr?.tokenEncrypted) {
    const token = randomBytes(32).toString('base64url');
    try {
      qr = await MeetingCheckInQrModel.findOneAndUpdate({
        companyCode, tokenHash: { $exists: false }, tokenEncrypted: { $exists: false },
      }, {
        $set: { tokenHash: createHash('sha256').update(token).digest('hex'), tokenEncrypted: encryptSecret(token), expiresAt: null },
        $unset: { revokedAt: 1 },
      }, { upsert: true, new: true, runValidators: true }).select('+tokenEncrypted');
    } catch (error) {
      // Another request initialized the unique company record first; use its token.
      if ((error as { code?: number }).code !== 11000) throw error;
      qr = await MeetingCheckInQrModel.findOne({ companyCode }).select('+tokenEncrypted');
    }
  }
  if (!qr?.tokenHash || !qr.tokenEncrypted || qr.revokedAt) {
    throw new MeetingError(409, 'Không thể tải mã QR cố định. Vui lòng liên hệ quản trị viên.');
  }
  let token: string;
  try {
    token = decryptSecret(qr.tokenEncrypted);
    if (createHash('sha256').update(token).digest('hex') !== qr.tokenHash) throw new Error('Token mismatch');
  } catch {
    throw new MeetingError(409, 'Không thể khôi phục mã QR cố định. Vui lòng liên hệ quản trị viên.');
  }
  // Preserve existing printed company QR codes while removing their old lifetime.
  if (qr.expiresAt !== null) {
    await MeetingCheckInQrModel.updateOne({ companyCode, tokenHash: qr.tokenHash }, { $set: { expiresAt: null } });
  }
  return { checkInUrl: '/meeting-checkin/' + token, expiresAt: null, scope: 'company' };
}

// Older clients may still request a QR from a meeting; they receive the company QR.
export async function getManagedCheckInQr(companyCode: string, id: string) {
  await getMeeting(companyCode, id);
  return getCompanyCheckInQr(companyCode);
}

async function resolveQrMeeting(token: string) {
  const hash = createHash('sha256').update(token).digest('hex');
  const now = new Date();
  // Existing printed hour-based QR codes retain their original validity.
  const legacy = await MeetingModel.findOne({ checkInQrTokenHash: hash, checkInQrExpiresAt: { $gt: now } });
  if (legacy) {
    if (!legacy.checkInQrExpiresAt || new Date(legacy.checkInQrExpiresAt) <= now || !['scheduled', 'live', 'paused'].includes(legacy.status)) {
      throw new MeetingError(410, 'Mã QR đã hết hạn hoặc không còn hiệu lực.');
    }
    return { item: legacy, expiresAt: legacy.checkInQrExpiresAt, reusable: false };
  }
  const qr = await MeetingCheckInQrModel.findOne({ tokenHash: hash, revokedAt: null });
  if (!qr?.tokenHash || qr.revokedAt) throw new MeetingError(410, 'Mã QR không hợp lệ. Hãy sử dụng QR check-in dùng chung của đơn vị.');
  const checkInStartsAt = new Date(now.getTime() + DEFAULT_MEETING_DURATION_MS);
  const matches = await MeetingModel.find({ companyCode: qr!.companyCode,
    status: { $in: ['scheduled', 'live', 'paused'] }, startsAt: { $lte: checkInStartsAt },
    $or: [
      { status: { $in: ['live', 'paused'] } },
      { status: 'scheduled', endsAt: { $gt: now } },
      { status: 'scheduled', endsAt: null, startsAt: { $gt: new Date(now.getTime() - DEFAULT_MEETING_DURATION_MS) } },
    ],
  }).sort({ startsAt: -1 }).limit(2);
  if (!matches.length) throw new MeetingError(409, 'Hiện không có cuộc họp nào trong thời gian check-in. Vui lòng kiểm tra lịch họp.');
  if (matches.length > 1) throw new MeetingError(409, 'Có nhiều cuộc họp trùng giờ. Vui lòng liên hệ ban tổ chức để điều chỉnh lịch.');
  return { item: matches[0], expiresAt: null, reusable: true };
}

function validateCheckInLocation(item: MeetingDocument, input: CheckInInput) {
  if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) throw new MeetingError(409, 'Cuộc họp chưa cấu hình tọa độ GPS.');
  if (!Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90 || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180) throw new MeetingError(400, 'Cần cho phép truy cập vị trí GPS để check-in.');
  const distance = distanceMeters(item.latitude, item.longitude, input.latitude, input.longitude);
  if (distance > (item.gpsRadiusMeters || 200)) throw new MeetingError(403, `Bạn đang cách địa điểm họp khoảng ${Math.round(distance)} m; phạm vi check-in là ${item.gpsRadiusMeters || 200} m.`);
}

export async function getPublicQrMeeting(token: string) {
  const { item, expiresAt } = await resolveQrMeeting(token);
  return { id: String(item._id), title: item.title, startsAt: item.startsAt,
    endsAt: meetingEndsAt(item.startsAt, item.endsAt), location: item.location, expiresAt };
}

export async function qrCheckInMember(token: string, input: CheckInInput & { password: string; identifier?: string }) {
  let { item } = await resolveQrMeeting(token);
  validateCheckInLocation(item, input);
  const rawIdentifier = String(input.identifier || input.email || '').trim();
  const normalized = normalizeLoginIdentifier(rawIdentifier);
  if (!normalized) throw new MeetingError(401, 'Tài khoản hoặc mật khẩu không đúng với thành viên của đơn vị tổ chức.');
  let person: (Partial<IUser> & { password?: string }) | null = null;
  if (normalized.includes("@")) {
    person = await UserModel.findOne({ email: normalized, companyCode: item.companyCode, isActive: { $ne: false } })
      .select('+password displayName email photoURL coverImage password')
      .lean();
  } else {
    const alternatives = /^0\d{9,10}$/.test(normalized)
      ? [normalized, "84" + normalized.slice(1), "+84" + normalized.slice(1)] : [normalized];
    const separator = "[\\s().-]*";
    const patterns = alternatives.map(value => [...value].map(char => char === "+" ? "\\+" : char).join(separator));
    const phone = new RegExp("^" + separator + "(?:" + patterns.join("|") + ")" + separator + "$");
    const users = await UserModel.find({ phone, companyCode: item.companyCode, isActive: { $ne: false } })
      .select('+password displayName email photoURL coverImage password')
      .limit(2)
      .lean();
    if (users.length > 1) {
      throw new MeetingError(400, "Số điện thoại được dùng cho nhiều tài khoản. Vui lòng check-in bằng email.");
    }
    person = users[0] || null;
  }
  if (!person?.password || !(await bcrypt.compare(input.password, person.password))) throw new MeetingError(401, 'Tài khoản hoặc mật khẩu không đúng với thành viên của đơn vị tổ chức.');
  const current = await resolveQrMeeting(token);
  if (String(current.item._id) !== String(item._id)) throw new MeetingError(409, 'Cuộc họp đã thay đổi. Vui lòng quét lại QR.');
  item = current.item;
  validateCheckInLocation(item, input);
  await checkIn(item, { userId: String(person._id) }, String(person._id), false);
  return { success: true, name: person.displayName, meetingId: String(item._id), meetingTitle: item.title };
}

export async function qrCheckInGuest(token: string, input: CheckInInput, avatar?: GuestAvatarFile, coverImage?: GuestAvatarFile) {
  let { item } = await resolveQrMeeting(token);
  validateCheckInLocation(item, input);
  const uploads: { field: 'photoURL' | 'coverImage'; asset: PublicMediaAsset }[] = [];
  for (const file of [avatar, coverImage]) {
    if (!file) continue;
    const error = guestAvatarError(file);
    if (error) throw new MeetingError(400, error.replace('Ảnh đại diện', 'Ảnh'));
  }
  if (item.speakers.length >= 1000) throw new MeetingError(400, 'Tối đa 1.000 người mỗi cuộc họp.');
  if (input.email && item.speakers.some((p) => p.email === input.email.toLowerCase())) {
    throw new MeetingError(409, 'Email này đã check-in.');
  }
  try {
    for (const [field, file] of [['photoURL', avatar], ['coverImage', coverImage]] as const) {
      if (!file) continue;
      let asset: PublicMediaAsset;
      try {
        asset = await cloudinaryService.uploadMediaAsset(
          `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
          `meetings/${item._id}/guests`
        );
      } catch {
        throw new MeetingError(502, 'Chưa tải được ảnh. Vui lòng thử lại hoặc bỏ ảnh để check-in.');
      }
      uploads.push({ field, asset });
      if (asset.resourceType !== 'image') throw new MeetingError(400, 'Tệp tải lên không phải ảnh hợp lệ.');
    }
    if (uploads.length) {
      // Recheck expiration, revocation, meeting time and location after uploading.
      const current = await resolveQrMeeting(token);
      if (String(current.item._id) !== String(item._id)) throw new MeetingError(409, 'Cuộc họp đã thay đổi. Vui lòng quét lại QR.');
      item = current.item;
      validateCheckInLocation(item, input);
    }
    await checkIn(item, {
      name: input.name, email: input.email, phone: input.phone, company: input.company,
      industry: input.industry, bio: input.bio,
      ...Object.fromEntries(uploads.map(({ field, asset }) => [field, asset.secureUrl])),
    }, 'public-qr', true);
    return { success: true, name: input.name, meetingId: String(item._id), meetingTitle: item.title };
  } catch (error) {
    for (const { field, asset } of uploads) {
      // Do not delete an image already persisted if a later notification fails.
      try {
        const saved = await MeetingModel.exists({ [`speakers.${field}`]: asset.secureUrl });
        if (!saved) await cloudinaryService.deletePublicMedia(asset.publicId, asset.resourceType);
      } catch { /* Preserve the original check-in error if cleanup is unavailable. */ }
    }
    throw error;
  }
}
