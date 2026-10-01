import { UserModel } from '../../model/user.model';
import { assertVersion, getMeeting, MeetingError, saveMeeting } from './meeting.service';

const fields = ['name', 'company', 'photoURL', 'coverImage', 'birthDate', 'industry', 'bio'] as const;

export function buildProfileSlide(speaker: any, profile?: any) {
  const date = profile?.birthDate ? new Date(profile.birthDate) : null;
  const result: Record<string, string> = {
    id: speaker.id,
    kind: speaker.userId ? 'member' : 'guest',
    name: profile?.displayName ?? speaker.name ?? '',
    company: profile?.companyName ?? speaker.company ?? '',
    photoURL: profile?.photoURL ?? speaker.photoURL ?? '',
    coverImage: profile?.coverImage ?? speaker.coverImage ?? '',
    birthDate: date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : '',
    industry: profile?.industry ?? '',
    bio: profile?.bio ?? '',
  };
  for (const field of fields) {
    if (typeof speaker.slideProfile?.[field] === 'string') result[field] = speaker.slideProfile[field];
  }
  return result;
}

export async function getMeetingSlides(companyCode: string, meetingId: string) {
  const meeting = await getMeeting(companyCode, meetingId);
  const userIds = meeting.speakers.map(s => s.userId).filter(Boolean);
  const profiles = userIds.length ? await UserModel.find({
    _id: { $in: userIds }, companyCode, isActive: { $ne: false },
  }).select('displayName companyName photoURL coverImage birthDate industry bio').lean() : [];
  const byId = new Map(profiles.map(p => [String(p._id), p]));
  return {
    version: meeting.__v,
    slides: meeting.speakers.map(s => buildProfileSlide(s, byId.get(s.userId))),
  };
}

export async function updateMeetingSlide(companyCode: string, meetingId: string, speakerId: string, input: any) {
  const meeting = await getMeeting(companyCode, meetingId);
  assertVersion(meeting, input.version);
  const speaker = meeting.speakers.find(s => s.id === speakerId);
  if (!speaker) throw new MeetingError(404, 'Không tìm thấy người tham gia.');
  // Null removes meeting-specific overrides and resumes using the member profile.
  speaker.set('slideProfile', input.profile === null ? undefined : input.profile);
  await saveMeeting(meeting);
  return getMeetingSlides(companyCode, meetingId);
}
