import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth, requirePermission, getEffectivePermissions, hasAnyPermission } from '../../middleware/auth';
import { MeetingModel } from './meeting.model';
import {
  MeetingError,
  assertVersion,
  checkIn,
  controlMeeting,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getMeeting,
  saveMeeting,
  updateLuckyDrawConfig,
  addOrUpdatePrize,
  deletePrize,
  spinLuckyDraw,
  redrawPrizeWinner,
  resetLuckyDrawWinners,
  createCheckInQr,
  autoStartDueMeetings,
} from './meeting.service';
import { checkinInput, controlInput, meetingInput, updateMeetingInput } from './meeting.validation';


export const meetingRouter = Router();
meetingRouter.use(requireAuth as any);

const company = (req: any) => String(req.user?.companyCode || '').toUpperCase();
const manage = requirePermission(['meetings:manage', 'access:manage']) as any;
const read = requirePermission(['meetings:read', 'meetings:manage', 'access:read', 'access:manage']) as any;
const sendError = (res: any, error: any) =>
  res.status(error instanceof MeetingError ? error.status : 500).json({
    message: error.message || 'Không thể xử lý cuộc họp.',
  });

meetingRouter.get('/', read, async (req: any, res) => {
  try {
    await autoStartDueMeetings();
    res.json({
      data: await MeetingModel.find({ companyCode: company(req) })
        .sort({ startsAt: -1 })
        .limit(100)
        .lean(),
    });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.get('/:id', read, async (req: any, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Mã cuộc họp không hợp lệ.' });
    }
    res.json({ data: await getMeeting(company(req), req.params.id) });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.post('/', manage, async (req: any, res) => {
  const { error, value } = meetingInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try {
    res.status(201).json({
      data: await createMeeting(company(req), req.user.id, value),
    });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.put('/:id', manage, async (req: any, res) => {
  const { error, value } = updateMeetingInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try {
    res.json({ data: await updateMeeting(company(req), req.params.id, value) });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.delete('/:id', manage, async (req: any, res) => {
  try {
    res.json({ data: await deleteMeeting(company(req), req.params.id) });
  } catch (e) {
    sendError(res, e);
  }
});


meetingRouter.post('/:id/checkin', requirePermission(['meetings:read', 'meetings:manage', 'access:read', 'access:manage']) as any, async (req: any, res) => {
  const { error, value } = checkinInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try {
    const item = await getMeeting(company(req), req.params.id);
    const canManage = hasAnyPermission(
      await getEffectivePermissions(req.user.id, req.user.role, req.user.companyCode),
      ['meetings:manage', 'access:manage']
    );
    if (!canManage) throw new MeetingError(403, "Vui lòng quét QR của buổi họp để xác nhận vị trí và check-in.");
    res.json({ data: await checkIn(item, value, req.user.id, canManage) });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.post('/:id/control', manage, async (req: any, res) => {
  const { error, value } = controlInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try {
    const item = await getMeeting(company(req), req.params.id);
    assertVersion(item, value.version);
    res.json({ data: await controlMeeting(item, value.action) });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.put('/:id/order', manage, async (req: any, res) => {
  try {
    const item = await getMeeting(company(req), req.params.id);
    assertVersion(item, req.body.version);
    if (
      item.status !== 'scheduled' ||
      !Array.isArray(req.body.speakerIds) ||
      req.body.speakerIds.length !== item.speakers.length ||
      new Set(req.body.speakerIds).size !== item.speakers.length ||
      req.body.speakerIds.some((id: string) => !item.speakers.some((p: any) => p.id === id))
    ) {
      throw new MeetingError(400, 'Thứ tự người nói không hợp lệ.');
    }
    item.speakers = req.body.speakerIds.map((id: string) =>
      item.speakers.find((p: any) => p.id === id)
    );
    item.speakers.forEach((p: any, i: number) => {
      let n = 0;
      for (const t of item.tiers) {
        n += t.count;
        if (i < n) {
          p.seconds = t.seconds;
          break;
        }
      }
      if (i >= item.tiers.reduce((s: number, t: any) => s + t.count, 0)) {
        p.seconds = item.fallbackSeconds;
      }
    });
    res.json({ data: await saveMeeting(item) });
  } catch (e) {
    sendError(res, e);
  }
});

// ==========================================
// LUCKY DRAW (QUAY THƯỞNG) ROUTES
// ==========================================

meetingRouter.get('/:id/lucky-draw', read, async (req: any, res) => {
  try {
    const item = await getMeeting(company(req), req.params.id);
    res.json({
      data: {
        meetingId: item._id,
        status: item.status,
        meetingStarted: item.status === 'live' || item.status === 'paused' || item.status === 'ended',
        attendeesCount: item.speakers.length,
        speakers: item.speakers,
        luckyDraw: item.luckyDraw || {
          enabled: true,
          allowRepeatWinners: false,
          drawMode: 'attendees',
          numberMin: 1,
          numberMax: 100,
          prizes: [],
        },
      },
    });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.put('/:id/lucky-draw/config', manage, async (req: any, res) => {
  try {
    const item = await getMeeting(company(req), req.params.id);
    const updated = await updateLuckyDrawConfig(item, req.body);
    res.json({ data: updated });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.post('/:id/lucky-draw/prizes', manage, async (req: any, res) => {
  try {
    const item = await getMeeting(company(req), req.params.id);
    const updated = await addOrUpdatePrize(item, req.body);
    res.json({ data: updated });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.delete('/:id/lucky-draw/prizes/:prizeId', manage, async (req: any, res) => {
  try {
    const item = await getMeeting(company(req), req.params.id);
    const updated = await deletePrize(item, req.params.prizeId);
    res.json({ data: updated });
  } catch (e) {
    sendError(res, e);
  }
});

/**
 * QUAY THƯỞNG: Yêu cầu bắt buộc cuộc họp đã bắt đầu!
 */
meetingRouter.post('/:id/lucky-draw/spin', manage, async (req: any, res) => {
  try {
    const item = await getMeeting(company(req), req.params.id);
    const { prizeId } = req.body;
    if (!prizeId) {
      return res.status(400).json({ message: 'Vui lòng chọn giải thưởng cần quay.' });
    }
    const result = await spinLuckyDraw(item, prizeId, req.user.id);
    res.json({ data: result });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.post('/:id/lucky-draw/redraw', manage, async (req: any, res) => {
  try {
    const item = await getMeeting(company(req), req.params.id);
    const { prizeId, winnerRecordId } = req.body;
    if (!prizeId || !winnerRecordId) {
      return res.status(400).json({ message: 'Thiếu thông tin giải thưởng hoặc người trúng giải.' });
    }
    const result = await redrawPrizeWinner(item, prizeId, winnerRecordId);
    res.json({ data: result });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.post('/:id/lucky-draw/reset', manage, async (req: any, res) => {
  try {
    const item = await getMeeting(company(req), req.params.id);
    const result = await resetLuckyDrawWinners(item, req.body?.prizeId);
    res.json({ data: result });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.post('/:id/checkin-qr', manage, async (req: any, res) => {
  try {
    const result = await createCheckInQr(company(req), req.params.id, Number(req.body?.hours));
    res.json({ data: { expiresAt: result.expiresAt, checkInUrl: `/meeting-checkin/${result.token}`, token: result.token } });
  } catch (e) { sendError(res, e); }
});