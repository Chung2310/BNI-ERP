import { meetingMonthRange } from "../../../src/utils/meetingRecurrence";
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
  createRecurringMeetings,
  updateMeeting,
  bulkUpdateMeetingSeries,
  deleteMeeting,
  getMeeting,
  updateLuckyDrawConfig,
  addOrUpdatePrize,
  deletePrize,
  spinLuckyDraw,
  recordGameWinner,
  redrawPrizeWinner,
  resetLuckyDrawWinners,
  getCompanyCheckInQr,
  getManagedCheckInQr,
  autoStartDueMeetings,
} from './meeting.service';
import { recurringMeetingInput, checkinInput, controlInput, meetingInput, updateMeetingInput, bulkUpdateMeetingSeriesInput, slideProfileInput, gameWinnerInput } from './meeting.validation';
import { updatePresentationState } from './meeting-presentation.service';
import { presentationStateInput, presentationStartInput, presentationDrawInput } from './meeting.validation';
import { buildMeetingSlides, getMeetingSlides, updateMeetingSlide } from './meeting-slides.service';


export const meetingRouter = Router();
meetingRouter.use(requireAuth);

const company = (req: import("express").Request) => String(req.user?.companyCode || '').toUpperCase();
const manage = requirePermission(['meetings:manage', 'access:manage']);
const read = requirePermission(['meetings:read', 'meetings:manage', 'access:read', 'access:manage']);
const sendError = (res: import("express").Response, error: unknown) =>
  res.status(error instanceof MeetingError ? error.status : 500).json({
    message: (error instanceof Error ? error.message : '') || 'Không thể xử lý cuộc họp.',
  });

meetingRouter.get('/', read, async (req, res) => {
  try {
    await autoStartDueMeetings();
    const filter: Record<string, unknown> = { companyCode: company(req) };
    if (req.query.month !== undefined) {
      try {
        const range = meetingMonthRange(String(req.query.month));
        filter.startsAt = { $gte: range.from, $lt: range.to };
      } catch { return res.status(400).json({ message: 'Tháng không hợp lệ.' }); }
    }
    const query = MeetingModel.find(filter).sort({ startsAt: req.query.month ? 1 : -1 });
    // A selected month must include every occurrence, not the old latest-100 subset.
    if (!req.query.month && req.query.history !== "all") query.limit(100);
    res.json({ data: await query.lean() });
  } catch (e) {
    sendError(res, e);
  }
});

// Register before /:id so the shared QR is available without selecting a meeting.
meetingRouter.get('/checkin-qr', manage, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ data: await getCompanyCheckInQr(company(req)) });
  } catch (e) { sendError(res, e); }
});

meetingRouter.get('/:id', read, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Mã cuộc họp không hợp lệ.' });
    }
    res.json({ data: await getMeeting(company(req), req.params.id) });
  } catch (e) {
    sendError(res, e);
  }
});

// Both devices read the same snapshot, scoped to the organizer's company.
meetingRouter.get('/:id/live/state', manage, async (req: import("express").Request, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Mã cuộc họp không hợp lệ.' });
    const serverReceivedAt = Date.now();
    const meeting = await getMeeting(company(req), req.params.id);
    res.set('Cache-Control', 'no-store');
    res.json({ data: { meeting, serverReceivedAt, serverNow: Date.now() } });
  } catch (error) { sendError(res, error); }
});
meetingRouter.get('/:id/live', manage, async (req: import("express").Request, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Mã cuộc họp không hợp lệ.' });
    const serverReceivedAt = Date.now();
    const meeting = await getMeeting(company(req), req.params.id);
    const deck = await buildMeetingSlides(meeting);
    res.set('Cache-Control', 'no-store');
    res.json({ data: { meeting, slides: deck.slides, serverReceivedAt, serverNow: Date.now() } });
  } catch (error) { sendError(res, error); }
});

meetingRouter.patch('/:id/presentation-state', manage, async (req: import("express").Request, res) => {
  const { error, value } = presentationStateInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Mã cuộc họp không hợp lệ.' });
    const item = await getMeeting(company(req), req.params.id);
    const { version, ...state } = value;
    assertVersion(item, version);
    res.json({ data: await updatePresentationState(item, state) });
  } catch (error) { sendError(res, error); }
});

meetingRouter.post('/:id/presentation-draw', manage, async (req: import("express").Request, res) => {
  const { error, value } = presentationDrawInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Mã cuộc họp không hợp lệ.' });
    const item = await getMeeting(company(req), req.params.id);
    assertVersion(item, value.version);
    if (item.presentation?.drawRevealsAt && +item.presentation.drawRevealsAt > Date.now()) {
      throw new MeetingError(409, 'Đang quay thưởng. Vui lòng chờ công bố kết quả.');
    }
    res.json({ data: await spinLuckyDraw(item, value.prizeId, req.user.id, true) });
  } catch (error) { sendError(res, error); }
});

meetingRouter.get('/:id/slides', read, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Mã cuộc họp không hợp lệ.' });
    res.json({ data: await getMeetingSlides(company(req), req.params.id) });
  } catch (e) { sendError(res, e); }
});

meetingRouter.put('/:id/slides/:speakerId', manage, async (req, res) => {
  const { error, value } = slideProfileInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Mã cuộc họp không hợp lệ.' });
    res.json({ data: await updateMeetingSlide(company(req), req.params.id, req.params.speakerId, value) });
  } catch (e) { sendError(res, e); }
});

meetingRouter.post('/series', manage, async (req, res) => {
  const { error, value } = recurringMeetingInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try { res.status(201).json({ data: await createRecurringMeetings(company(req), req.user.id, value) }); }
  catch (error) { sendError(res, error); }
});

meetingRouter.post('/', manage, async (req, res) => {
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

meetingRouter.put('/:id', manage, async (req, res) => {
  const { error, value } = updateMeetingInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try {
    res.json({ data: await updateMeeting(company(req), req.params.id, value) });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.put('/:id/series', manage, async (req: any, res) => {
  const { error, value } = bulkUpdateMeetingSeriesInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try {
    res.json({ data: await bulkUpdateMeetingSeries(company(req), req.params.id, value) });
  } catch (e) { sendError(res, e); }
});

meetingRouter.delete('/:id', manage, async (req: any, res) => {
  try {
    res.json({ data: await deleteMeeting(company(req), req.params.id) });
  } catch (e) {
    sendError(res, e);
  }
});


meetingRouter.post('/:id/checkin', requirePermission(['meetings:read', 'meetings:manage', 'access:read', 'access:manage']), async (req, res) => {
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

meetingRouter.post('/:id/presentation', manage, async (req, res) => {
  const { error, value } = presentationStartInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try {
    const item = await getMeeting(company(req), req.params.id);
    assertVersion(item, value.version);
    res.json({ data: await startMeetingPresentation(item, value.speakerId, undefined, { autoAdvance: value.autoAdvance }) });
  } catch (e) { sendError(res, e); }
});

meetingRouter.post('/:id/control', manage, async (req, res) => {
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

meetingRouter.post('/:id/defer', manage, async (req, res) => {
  if (req.body?.speakerIds === undefined && (typeof req.body?.speakerId !== 'string' || !req.body.speakerId)) return res.status(400).json({ message: 'Chọn người cần để cuối lượt.' });
  try {
    const item = await getMeeting(company(req), req.params.id);
    assertVersion(item, req.body.version);
    res.json({ data: req.body.speakerIds !== undefined ? await deferMeetingSpeakers(item, req.body.speakerIds) : await deferMeetingSpeaker(item, req.body.speakerId) });
  } catch (e) { sendError(res, e); }
});

meetingRouter.put('/:id/order', manage, async (req, res) => {
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

meetingRouter.get('/:id/lucky-draw', read, async (req, res) => {
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

meetingRouter.put('/:id/lucky-draw/config', manage, async (req, res) => {
  try {
    const item = await getMeeting(company(req), req.params.id);
    const updated = await updateLuckyDrawConfig(item, req.body);
    res.json({ data: updated });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.post('/:id/lucky-draw/prizes', manage, async (req, res) => {
  try {
    const item = await getMeeting(company(req), req.params.id);
    const updated = await addOrUpdatePrize(item, req.body);
    res.json({ data: updated });
  } catch (e) {
    sendError(res, e);
  }
});

meetingRouter.delete('/:id/lucky-draw/prizes/:prizeId', manage, async (req, res) => {
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
meetingRouter.post('/:id/lucky-draw/results', manage, async (req, res) => {
  try {
    const { error, value } = gameWinnerInput.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    const item = await getMeeting(company(req), req.params.id);
    res.json({ data: await recordGameWinner(item, value, req.user.id) });
  } catch (e) { sendError(res, e); }
});

meetingRouter.post('/:id/lucky-draw/spin', manage, async (req, res) => {
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

meetingRouter.post('/:id/lucky-draw/redraw', manage, async (req, res) => {
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

meetingRouter.post('/:id/lucky-draw/reset', manage, async (req, res) => {
  try {
    const item = await getMeeting(company(req), req.params.id);
    const result = await resetLuckyDrawWinners(item, req.body?.prizeId);
    res.json({ data: result });
  } catch (e) {
    sendError(res, e);
  }
});

// Compatibility routes always return the same permanent company QR.
meetingRouter.route('/:id/checkin-qr')
  .get(manage, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.json({ data: await getManagedCheckInQr(company(req), req.params.id) });
    } catch (e) { sendError(res, e); }
  })
  .post(manage, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.json({ data: await getManagedCheckInQr(company(req), req.params.id) });
    } catch (e) { sendError(res, e); }
  })
  .put(manage, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.json({ data: await getManagedCheckInQr(company(req), req.params.id) });
    } catch (e) { sendError(res, e); }
  })
  .delete(manage, (_req, res) => {
    res.set('Allow', 'GET, POST, PUT').status(405).json({ message: 'QR check-in là mã cố định dùng chung vĩnh viễn, không thể hủy hoặc thay mã.' });
  });
