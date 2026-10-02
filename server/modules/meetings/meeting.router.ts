import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth, requirePermission, getEffectivePermissions, hasAnyPermission } from '../../middleware/auth';
import { MeetingModel } from './meeting.model';
import {
  MeetingError,
  assertVersion,
  checkInFromModule,
  controlMeeting,
  startMeetingPresentation,
  reorderMeetingSpeakers,
  deferMeetingSpeaker,
  deferMeetingSpeakers,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getMeeting,
  saveMeeting,
  updateLuckyDrawConfig,
  addOrUpdatePrize,
  deletePrize,
  spinLuckyDraw,
  recordGameWinner,
  redrawPrizeWinner,
  resetLuckyDrawWinners,
  createCheckInQr,
  getCheckInQr,
  autoStartDueMeetings,
} from './meeting.service';
import { checkinInput, controlInput, meetingInput, updateMeetingInput, slideProfileInput, gameWinnerInput } from './meeting.validation';
import { getMeetingSlides, updateMeetingSlide } from './meeting-slides.service';


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

meetingRouter.get('/:id/slides', read, async (req: any, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Mã cuộc họp không hợp lệ.' });
    res.json({ data: await getMeetingSlides(company(req), req.params.id) });
  } catch (e) { sendError(res, e); }
});

meetingRouter.put('/:id/slides/:speakerId', manage, async (req: any, res) => {
  const { error, value } = slideProfileInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Mã cuộc họp không hợp lệ.' });
    res.json({ data: await updateMeetingSlide(company(req), req.params.id, req.params.speakerId, value) });
  } catch (e) { sendError(res, e); }
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
    res.json({ data: await checkInFromModule(item, value, req.user.id, canManage) });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.post('/:id/presentation', manage, async (req: any, res) => {
  if (typeof req.body?.speakerId !== 'string' || !req.body.speakerId) return res.status(400).json({ message: 'Chọn người thuyết trình.' });
  try {
    const item = await getMeeting(company(req), req.params.id);
    assertVersion(item, req.body.version);
    res.json({ data: await startMeetingPresentation(item, req.body.speakerId) });
  } catch (e) { sendError(res, e); }
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

meetingRouter.post('/:id/defer', manage, async (req: any, res) => {
  if (req.body?.speakerIds === undefined && (typeof req.body?.speakerId !== 'string' || !req.body.speakerId)) return res.status(400).json({ message: 'Chọn người cần để cuối lượt.' });
  try {
    const item = await getMeeting(company(req), req.params.id);
    assertVersion(item, req.body.version);
    res.json({ data: req.body.speakerIds !== undefined ? await deferMeetingSpeakers(item, req.body.speakerIds) : await deferMeetingSpeaker(item, req.body.speakerId) });
  } catch (e) { sendError(res, e); }
});

meetingRouter.put('/:id/order', manage, async (req: any, res) => {
  try {
    const item = await getMeeting(company(req), req.params.id);
    assertVersion(item, req.body.version);
    res.json({ data: await reorderMeetingSpeakers(item, req.body.speakerIds) });
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
meetingRouter.post('/:id/lucky-draw/results', manage, async (req: any, res) => {
  try {
    const { error, value } = gameWinnerInput.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    const item = await getMeeting(company(req), req.params.id);
    res.json({ data: await recordGameWinner(item, value, req.user.id) });
  } catch (e) { sendError(res, e); }
});

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

meetingRouter.get('/:id/checkin-qr', manage, async (req: any, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ data: await getCheckInQr(company(req), req.params.id) });
  } catch (e) { sendError(res, e); }
});

meetingRouter.put('/:id/checkin-qr', manage, async (req: any, res) => {
  try {
    if (typeof req.body?.token !== 'string') throw new MeetingError(400, 'Thiếu mã QR cần khôi phục.');
    res.set('Cache-Control', 'no-store');
    res.json({ data: await getCheckInQr(company(req), req.params.id, req.body.token) });
  } catch (e) { sendError(res, e); }
});

meetingRouter.post('/:id/checkin-qr', manage, async (req: any, res) => {
  try {
    const result = await createCheckInQr(company(req), req.params.id, Number(req.body?.hours));
    res.json({ data: { expiresAt: result.expiresAt, checkInUrl: `/meeting-checkin/${result.token}`, token: result.token } });
  } catch (e) { sendError(res, e); }
});
