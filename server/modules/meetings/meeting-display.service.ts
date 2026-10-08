import { MeetingModel } from './meeting.model';
import { getMeeting, MeetingError } from './meeting.service';
import { buildMeetingSlides } from './meeting-slides.service';

export const DISPLAY_HEARTBEAT_INTERVAL_MS = 10_000;
export const DISPLAY_PRESENCE_TTL_MS = 30_000;

// Presence is a lease. A closed or disconnected browser stops renewing it, so
// stale state expires without relying on unload requests reaching the server.
export async function heartbeatMeetingDisplay(companyCode: string, meetingId: string, now = new Date()) {
  const meeting = await MeetingModel.findOneAndUpdate(
    { _id: meetingId, companyCode },
    { $set: { presentationDisplayHeartbeatAt: now } },
    { new: true, projection: { presentationDisplayHeartbeatAt: 1 } },
  );
  if (!meeting) throw new MeetingError(404, 'Không tìm thấy cuộc họp.');
  return { isOpen: true, lastSeenAt: meeting.presentationDisplayHeartbeatAt, expiresAt: new Date(now.getTime() + DISPLAY_PRESENCE_TTL_MS) };
}

export async function getMemberPresentation(companyCode: string, meetingId: string, now = new Date()) {
  const meeting = await getMeeting(companyCode, meetingId);
  const lastSeenAt = meeting.presentationDisplayHeartbeatAt ?? null;
  const isOpen = !!lastSeenAt && now.getTime() - lastSeenAt.getTime() < DISPLAY_PRESENCE_TTL_MS;
  const deck = await buildMeetingSlides(meeting);
  return {
    meetingId: String(meeting._id),
    isOpen,
    lastSeenAt,
    expiresAt: lastSeenAt ? new Date(lastSeenAt.getTime() + DISPLAY_PRESENCE_TTL_MS) : null,
    serverNow: now.toISOString(),
    meeting: {
      title: meeting.title,
      status: meeting.status,
      presentation: meeting.presentation,
      currentIndex: meeting.currentIndex,
      speakerStartedAt: meeting.speakerStartedAt,
      speechesCompletedAt: meeting.speechesCompletedAt,
      elapsedSeconds: meeting.elapsedSeconds,
      speakers: meeting.speakers.map(speaker => ({ id: speaker.id, name: speaker.name, checkedInAt: speaker.checkedInAt,
        seconds: speaker.seconds, spokenSeconds: speaker.spokenSeconds, deferred: speaker.deferred })),
    },
    slides: deck.slides,
    version: deck.version,
  };
}
