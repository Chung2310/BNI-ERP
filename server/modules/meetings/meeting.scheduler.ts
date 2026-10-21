import { randomUUID } from 'node:crypto';
import { MeetingModel, MeetingDeliveryModel } from './meeting.model';
import { UserModel } from '../../model/user.model';
import { companyEmailService } from '../../service/company-email.service';
import { autoEndMeetingByDeadline, autoStartDueMeetings } from './meeting.service';
import { advanceDuePresentations } from './meeting-presentation.service';
import { scheduleMeetingAutoEnd, setMeetingAutoEndHandler, stopMeetingAutoEndTimers } from './meeting-auto-end.scheduler';
export async function runMeetingReminderScan(now = new Date()) {
  const due = await MeetingModel.find({ status: 'scheduled', reminderAt: { $lte: now }, startsAt: { $gt: now } }).limit(100).lean(); let queued = 0;
  for (const meeting of due) {
    const members = await UserModel.find({ companyCode: meeting.companyCode, isActive: { $ne: false }, disabledAt: { $in: [null, undefined] }, email: { $type: 'string', $ne: '' } }).select('email').lean();
    const emails = new Set<string>(members.map((p) => String(p.email).toLowerCase()));
    for (const speaker of meeting.speakers) if (speaker.email) emails.add(String(speaker.email).toLowerCase());
    for (const email of emails) { try { const row = await MeetingDeliveryModel.create({ companyCode: meeting.companyCode, meetingId: String(meeting._id), revision: meeting.revision, email }); if (row) queued++; } catch (error) { if (error?.code !== 11000) throw error; } }
  }
  return { queued };
}
export async function runMeetingDeliveryScan(now = new Date(), batchSize = 100) {
  let sent = 0;
  for (let i = 0; i < batchSize; i++) {
    const claimToken = randomUUID();
    const row = await MeetingDeliveryModel.findOneAndUpdate({ $or: [{ status: 'pending', nextAttemptAt: { $lte: now } }, { status: 'sending', leaseUntil: { $lte: now } }] }, { $set: { status: 'sending', leaseUntil: new Date(now.getTime() + 60_000), claimToken }, $inc: { attempts: 1 } }, { returnDocument: 'after', sort: { nextAttemptAt: 1, _id: 1 } }).lean();
    if (!row) break;
    try {
      const meeting = await MeetingModel.findOne({ _id: row.meetingId, companyCode: row.companyCode, revision: row.revision, status: 'scheduled' }).lean();
      if (!meeting) { await MeetingDeliveryModel.updateOne({ _id: row._id, claimToken }, { $set: { status: 'failed', error: 'Meeting canceled or rescheduled.' }, $unset: { claimToken: 1, leaseUntil: 1 } }); continue; }
      const date = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(meeting.startsAt));
      const title = String(meeting.title).replace(/[&<>"']/g, (c: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
      const location = String(meeting.location || 'Not specified').replace(/[&<>"']/g, (c: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
      const info = await companyEmailService.send(row.companyCode, { to: row.email, subject: `Meeting reminder: ${meeting.title}`, html: `<h2>${title}</h2><p>${date}</p><p>Location: ${location}</p><p>${String(meeting.description || '').replace(/[&<>"']/g, '')}</p>` });
      await MeetingDeliveryModel.updateOne({ _id: row._id, claimToken }, { $set: { status: 'sent', sentAt: now, error: '' }, $unset: { claimToken: 1, leaseUntil: 1 } }); sent++; void info;
    } catch (error) { await MeetingDeliveryModel.updateOne({ _id: row._id, claimToken }, { $set: { status: row.attempts >= 5 ? 'failed' : 'pending', nextAttemptAt: new Date(now.getTime() + Math.min(60, 2 ** row.attempts) * 60_000), error: String(error?.message || error).slice(0, 500) }, $unset: { claimToken: 1, leaseUntil: 1 } }); }
  }
  return { sent };
}
export function startPresentationScheduler() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await advanceDuePresentations(); }
    catch (error) { console.error('[MeetingPresentationScheduler]', error); }
    finally { running = false; }
  }, 500);
  timer.unref();
  return () => clearInterval(timer);
}
export async function restoreMeetingAutoEndTimers() {
  const activeMeetings = await MeetingModel.find({
    status: { $in: ['scheduled', 'live', 'paused'] },
  }).select('_id status startsAt endsAt').lean();
  activeMeetings.forEach(scheduleMeetingAutoEnd);
  return activeMeetings.length;
}

export function startMeetingScheduler() {
  const stopPresentation = startPresentationScheduler();
  setMeetingAutoEndHandler(autoEndMeetingByDeadline);
  let stopped = false;
  let restoreRetryTimer: ReturnType<typeof setTimeout> | undefined;
  const restoreTimers = async () => {
    try {
      await restoreMeetingAutoEndTimers();
    } catch (error) {
      console.error('[MeetingAutoEnd] Failed to restore meeting timers', error);
      if (!stopped) {
        restoreRetryTimer = setTimeout(() => { void restoreTimers(); }, 30_000);
        restoreRetryTimer.unref();
      }
    }
  };
  void restoreTimers();

  let running = false;
  const runMaintenance = async () => {
    if (running) return;
    running = true;
    try {
      await autoStartDueMeetings();
      await runMeetingReminderScan();
      await runMeetingDeliveryScan();
    } catch (error) {
      console.error('[MeetingScheduler]', error);
    } finally {
      running = false;
    }
  };

  void runMaintenance();
  const timer = setInterval(() => { void runMaintenance(); }, 15_000);
  timer.unref();
  return () => {
    stopped = true;
    if (restoreRetryTimer) clearTimeout(restoreRetryTimer);
    clearInterval(timer);
    stopPresentation();
    stopMeetingAutoEndTimers();
    setMeetingAutoEndHandler(null);
  };
}
