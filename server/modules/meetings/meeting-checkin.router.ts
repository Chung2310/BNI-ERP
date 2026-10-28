import { Router } from 'express';
import multer from 'multer';
import Joi from 'joi';
import { MAX_GUEST_AVATAR_BYTES } from './meeting-guest-avatar';
import { publicApiRateLimiter, authRateLimiter, loginAccountRateLimiter } from '../../middleware/rate-limit';
import { getPublicQrMeeting, getPublicQrMembers, qrCheckInGuest, qrCheckInMember, MeetingError, reportQrCheckInFailure } from './meeting.service';
import { qrGuestInput, qrMemberInput } from './meeting.validation';

const guestAvatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_GUEST_AVATAR_BYTES, files: 2, fields: 8, parts: 11, fieldSize: 4096 },
  fileFilter: (_req, file, callback) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) callback(null, true);
    else callback(new Error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP."));
  },
}).fields([{ name: "avatar", maxCount: 1 }, { name: "coverImage", maxCount: 1 }]);

export const meetingCheckInRouter = Router();
meetingCheckInRouter.use(publicApiRateLimiter);
const respondError = (res: import("express").Response, error: unknown) => res.status(error instanceof MeetingError ? error.status : 500).json({ message: (error instanceof Error ? error.message : '') || 'Không thể check-in.' });
meetingCheckInRouter.get('/:token', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json({ data: await getPublicQrMeeting(req.params.token) }); } catch (e) { respondError(res, e); }
});
meetingCheckInRouter.post('/:token/failure', async (req, res) => {
  const { error, value } = Joi.object({
    mode: Joi.string().valid('member', 'guest', 'app').required(),
    reason: Joi.string().valid('location_denied', 'location_unavailable', 'location_unsupported').required(),
  }).validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  const messages = {
    location_denied: 'Người tham dự chưa cấp quyền vị trí trên điện thoại.',
    location_unavailable: 'Điện thoại chưa lấy được vị trí GPS.',
    location_unsupported: 'Trình duyệt trên điện thoại không hỗ trợ lấy vị trí.',
  } as const;
  await reportQrCheckInFailure(req.params.token, value.mode, messages[value.reason as keyof typeof messages]);
  res.json({ success: true });
});
meetingCheckInRouter.get('/:token/members', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json({ data: await getPublicQrMembers(req.params.token) }); } catch (e) { respondError(res, e); }
});
meetingCheckInRouter.post('/:token/member', authRateLimiter, loginAccountRateLimiter, async (req, res) => {
  const { error, value } = qrMemberInput.validate(req.body);
  if (error) {
    await reportQrCheckInFailure(req.params.token, 'member', error.message);
    return res.status(400).json({ message: error.message });
  }
  try { res.json({ data: await qrCheckInMember(req.params.token, value) }); } catch (e) {
    await reportQrCheckInFailure(req.params.token, 'member', e instanceof MeetingError ? e.message : 'Không thể check-in. Vui lòng thử lại.');
    respondError(res, e);
  }
});
meetingCheckInRouter.post('/:token/guest', (req, res, next) => {
  guestAvatarUpload(req, res, error => {
    if (error) {
      const tooLarge = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
      const message = tooLarge ? "Mỗi ảnh tối đa 5 MB." : "Không nhận được ảnh. Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.";
      void reportQrCheckInFailure(req.params.token, 'guest', message);
      res.status(tooLarge ? 413 : 400).json({ message });
      return;
    }
    next();
  });
}, async (req, res) => {
  const { error, value } = qrGuestInput.validate(req.body);
  if (error) {
    await reportQrCheckInFailure(req.params.token, 'guest', error.message);
    return res.status(400).json({ message: error.message });
  }
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  try { res.json({ data: await qrCheckInGuest(req.params.token, value, files?.avatar?.[0], files?.coverImage?.[0]) }); } catch (e) {
    await reportQrCheckInFailure(req.params.token, 'guest', e instanceof MeetingError ? e.message : 'Không thể check-in. Vui lòng thử lại.');
    respondError(res, e);
  }
});
