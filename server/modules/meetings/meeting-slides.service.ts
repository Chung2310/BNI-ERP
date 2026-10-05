import type { IUser } from '../../interface/user.interface';
import type { MeetingDocument } from './meeting.service';
type SlideSpeaker = { id: string; userId?: string; galleryImages?: string[]; slideProfile?: Partial<Record<(typeof fields)[number], string>> & { galleryImages?: string[] } } & Partial<Record<(typeof fields)[number], string>>;
import { UserModel } from '../../model/user.model';
import { assertMeetingEditable, assertVersion, getMeeting, MeetingError, saveMeeting } from './meeting.service';

const fields = ['name', 'company', 'photoURL', 'coverImage', 'phone', 'email', 'industry', 'bio', 'address', 'targetMarket'] as const;

export function buildProfileSlide(speaker: SlideSpeaker, profile?: Partial<IUser> & { bio?: string }) {
  const result: Record<string, string | string[]> = {
    id: speaker.id,
    kind: speaker.userId ? 'member' : 'guest',
    name: profile?.displayName ?? speaker.name ?? '',
    company: profile?.companyName ?? speaker.company ?? '',
    photoURL: profile?.photoURL ?? speaker.photoURL ?? '',
    coverImage: profile?.coverImage ?? speaker.coverImage ?? '',
    phone: profile?.phone ?? speaker.phone ?? '',
    email: profile?.email ?? speaker.email ?? '',
    industry: profile?.industry ?? speaker.industry ?? '',
    bio: profile?.bio ?? speaker.bio ?? '',
    address: profile?.address ?? speaker.address ?? '',
    targetMarket: profile?.targetMarket ?? speaker.targetMarket ?? '',
    galleryImages: (profile?.galleryImages ?? speaker.galleryImages ?? []).filter((url: unknown) => typeof url === 'string' && url.trim()).slice(0, 5),
  };
  for (const field of fields) {
    if (typeof speaker.slideProfile?.[field] === 'string') result[field] = speaker.slideProfile[field];
  }
  if (Array.isArray(speaker.slideProfile?.galleryImages)) {
    result.galleryImages = speaker.slideProfile.galleryImages.filter((url: unknown) => typeof url === 'string' && url.trim()).slice(0, 5);
  }
  const name = typeof result.name === 'string' ? result.name.trim() : '';
  if (speaker.userId && name && !/^(?:mr|mrs|ms)\.\s+/i.test(name)) {
    if (profile?.gender === 'female') result.name = `Ms. ${name}`;
    if (profile?.gender === 'male') result.name = `Mr. ${name}`;
  }
  return result;
}

export async function getMeetingSlides(companyCode: string, meetingId: string) {
  return buildMeetingSlides(await getMeeting(companyCode, meetingId));
}

export async function buildMeetingSlides(meeting: Pick<MeetingDocument, 'companyCode' | '__v' | 'speakers'>) {
  const companyCode = meeting.companyCode;
  const userIds = meeting.speakers.map(s => s.userId).filter(Boolean);
  const profiles = userIds.length ? await UserModel.find({
    _id: { $in: userIds }, companyCode, isActive: { $ne: false },
  }).select('displayName companyName photoURL coverImage phone email industry bio gender address targetMarket galleryImages').lean() : [];
  const byId = new Map(profiles.map(p => [String(p._id), p]));
  return {
    version: meeting.__v,
    slides: meeting.speakers.map(s => buildProfileSlide(s, byId.get(s.userId))),
  };
}

export async function updateMeetingSlide(companyCode: string, meetingId: string, speakerId: string, input: { version: number; profile: SlideSpeaker['slideProfile'] | null }) {
  const meeting = await getMeeting(companyCode, meetingId);
  assertMeetingEditable(meeting);
  assertVersion(meeting, input.version);
  const speaker = meeting.speakers.find(s => s.id === speakerId);
  if (!speaker) throw new MeetingError(404, 'Không tìm thấy người tham gia.');
  // Null removes meeting-specific overrides and resumes using the member profile.
  speaker.set('slideProfile', input.profile === null ? undefined : input.profile);
  await saveMeeting(meeting);
  return getMeetingSlides(companyCode, meetingId);
}
