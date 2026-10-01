import { Router } from 'express';
import { publicApiRateLimiter, authRateLimiter, loginAccountRateLimiter } from '../../middleware/rate-limit';
import { getPublicQrMeeting, qrCheckInGuest, qrCheckInMember, MeetingError } from './meeting.service';
import { qrGuestInput, qrMemberInput } from './meeting.validation';

export const meetingCheckInRouter = Router();
meetingCheckInRouter.use(publicApiRateLimiter);
const respondError = (res: any, error: any) => res.status(error instanceof MeetingError ? error.status : 500).json({ message: error.message || 'Không thể check-in.' });
meetingCheckInRouter.get('/:token', async (req, res) => {
  try { res.json({ data: await getPublicQrMeeting(req.params.token) }); } catch (e) { respondError(res, e); }
});
meetingCheckInRouter.post('/:token/member', authRateLimiter, loginAccountRateLimiter, async (req, res) => {
  const { error, value } = qrMemberInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try { res.json({ data: await qrCheckInMember(req.params.token, value) }); } catch (e) { respondError(res, e); }
});
meetingCheckInRouter.post('/:token/guest', async (req, res) => {
  const { error, value } = qrGuestInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try { res.json({ data: await qrCheckInGuest(req.params.token, value) }); } catch (e) { respondError(res, e); }
});