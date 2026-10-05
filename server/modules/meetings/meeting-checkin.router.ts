import { Router } from 'express';
import multer from 'multer';
import { MAX_GUEST_AVATAR_BYTES } from './meeting-guest-avatar';
import { publicApiRateLimiter, authRateLimiter, loginAccountRateLimiter } from '../../middleware/rate-limit';
import { getPublicQrMeeting, qrCheckInGuest, qrCheckInMember, MeetingError } from './meeting.service';
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
const respondError = (res: any, error: any) => res.status(error instanceof MeetingError ? error.status : 500).json({ message: error.message || 'Không thể check-in.' });
meetingCheckInRouter.get('/:token', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json({ data: await getPublicQrMeeting(req.params.token) }); } catch (e) { respondError(res, e); }
});
meetingCheckInRouter.post('/:token/member', authRateLimiter, loginAccountRateLimiter, async (req, res) => {
  const { error, value } = qrMemberInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try { res.json({ data: await qrCheckInMember(req.params.token, value) }); } catch (e) { respondError(res, e); }
});
meetingCheckInRouter.post('/:token/guest', (req, res, next) => {
  guestAvatarUpload(req, res, error => {
    if (error) {
      const tooLarge = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
      res.status(tooLarge ? 413 : 400).json({ message: tooLarge ? "Mỗi ảnh tối đa 5 MB." : "Không nhận được ảnh. Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB." });
      return;
    }
    next();
  });
}, async (req, res) => {
  const { error, value } = qrGuestInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  try { res.json({ data: await qrCheckInGuest(req.params.token, value, files?.avatar?.[0], files?.coverImage?.[0]) }); } catch (e) { respondError(res, e); }
});
