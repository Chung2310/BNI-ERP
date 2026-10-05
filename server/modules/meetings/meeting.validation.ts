import Joi from 'joi';
import { validateSpeakingTimeSlots } from "../../../src/utils/meetingSpeakingTime";
export const presentationStateInput = Joi.object({
  version: Joi.number().integer().min(0).required(),
  view: Joi.string().valid("checkin", "speaker", "luckyDraw", "activeMembers", "waiting"),
  autoAdvance: Joi.boolean(),
  autoAdvanceDelay: Joi.number().integer().min(0).max(3600),
}).or("view", "autoAdvance", "autoAdvanceDelay");
export const presentationDrawInput = Joi.object({
  version: Joi.number().integer().min(0).required(),
  prizeId: Joi.string().max(100).required(),
});
export const gameWinnerInput = Joi.object({
  id: Joi.string().max(100).required(),
  winnerId: Joi.string().max(150).required(),
  source: Joi.string().valid('wheel', 'bingo').required(),
  name: Joi.string().trim().max(150).required(),
  prizeName: Joi.string().trim().max(200).required(),
  photoURL: Joi.string().uri({ scheme: ['http', 'https'] }).max(2000).allow(''),
  ticketNumber: Joi.number().integer().min(1),
  wonAt: Joi.date().iso().required(),
});
export const slideProfileInput = Joi.object({
  version: Joi.number().integer().min(0).required(),
  profile: Joi.object({
    name: Joi.string().trim().min(1).max(150).required(),
    company: Joi.string().trim().max(150).allow('').required(),
    photoURL: Joi.string().uri({ scheme: ['http', 'https'] }).max(2000).allow('').required(),
    coverImage: Joi.string().uri({ scheme: ['http', 'https'] }).max(2000).allow('').required(),
    phone: Joi.string().trim().max(40).allow('').required(),
    email: Joi.string().trim().email().max(254).allow(''),
    industry: Joi.string().trim().max(150).allow('').required(),
    bio: Joi.string().trim().max(1000).allow('').required(),
  }).allow(null).required(),
});
const speakingTimeSlots = Joi.array().items(Joi.object({
  startTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
  endTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
  seconds: Joi.number().integer().min(1).max(3600).required(),
})).min(1).max(20).custom((value, helpers) => {
  const message = validateSpeakingTimeSlots(value);
  return message ? helpers.error("any.custom", { message }) : value;
}).messages({ "any.custom": "{{#message}}" });
const image = Joi.string().uri({ scheme: ['https', 'http'] }).max(2000).allow('').default('');
// Accept the retired check-in option from older clients without persisting it.
export const meetingInput = Joi.object({ allowDirectCheckIn: Joi.boolean().strip(), title: Joi.string().trim().max(200).required(), description: Joi.string().max(4000).allow('').default(''), location: Joi.string().trim().max(500).allow('').default(''), latitude: Joi.number().min(-90).max(90), longitude: Joi.number().min(-180).max(180), gpsRadiusMeters: Joi.number().integer().min(50).max(5000).default(200), coverImage: image, startsAt: Joi.date().iso().required(), endsAt: Joi.date().iso().greater(Joi.ref('startsAt')), reminderDays: Joi.number().integer().min(0).max(365).default(1), tiers: speakingTimeSlots.required(), fallbackSeconds: Joi.number().integer().min(1).max(3600).required() });
export const updateMeetingInput = Joi.object({ version: Joi.number().integer().min(0), allowDirectCheckIn: Joi.boolean().strip(), title: Joi.string().trim().max(200), description: Joi.string().max(4000).allow(''), location: Joi.string().trim().max(500).allow(''), latitude: Joi.number().min(-90).max(90).allow(null), longitude: Joi.number().min(-180).max(180).allow(null), gpsRadiusMeters: Joi.number().integer().min(50).max(5000), coverImage: image, startsAt: Joi.date().iso(), endsAt: Joi.date().iso(), reminderDays: Joi.number().integer().min(0).max(365), tiers: speakingTimeSlots, fallbackSeconds: Joi.number().integer().min(1).max(3600) });
export const checkinInput = Joi.object({ latitude: Joi.number().min(-90).max(90), longitude: Joi.number().min(-180).max(180), userId: Joi.string().hex().length(24), name: Joi.string().trim().max(150), email: Joi.string().email().max(254).allow('').default(''), photoURL: image, coverImage: image });
export const controlInput = Joi.object({ action: Joi.string().valid('start', 'pause', 'resume', 'next', 'previous', 'finish', 'cancel', 'start_speaker', 'reset_speaker').required(), version: Joi.number().integer().min(0).required() });


export const qrMemberInput = Joi.object({ email: Joi.string().email().max(254).required(), password: Joi.string().min(1).max(200).required(), latitude: Joi.number().min(-90).max(90).required(), longitude: Joi.number().min(-180).max(180).required() });
export const qrGuestInput = Joi.object({ name: Joi.string().trim().min(2).max(150).required(), email: Joi.string().email().max(254).allow('').default(''), phone: Joi.string().trim().max(40).allow('').default(''), company: Joi.string().trim().max(150).allow('').default(''), industry: Joi.string().trim().max(150).allow('').default(''), bio: Joi.string().trim().max(1000).allow('').default(''), latitude: Joi.number().min(-90).max(90).required(), longitude: Joi.number().min(-180).max(180).required() });

export const recurringMeetingInput = meetingInput.fork(["startsAt", "endsAt"], () => Joi.forbidden()).keys({
  recurrence: Joi.object({ durationMinutes: Joi.number().integer().min(1).max(1440).default(120), startDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(), months: Joi.number().integer().min(1).max(12).required(), weekday: Joi.number().integer().min(0).max(6).required(), time: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required() }).required(),
});
