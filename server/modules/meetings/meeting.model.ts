import { Schema, model } from 'mongoose';
import { defaultSpeakingTimeSlots } from "../../../src/utils/meetingSpeakingTime";

const speaker = new Schema(
  {
    id: { type: String, required: true },
    userId: String,
    name: { type: String, required: true },
    email: String,
    phone: String,
    company: String,
    industry: String,
    bio: String,
    photoURL: String,
    coverImage: String,
    slideProfile: {
      type: new Schema({
        name: String, company: String, photoURL: String, coverImage: String,
        phone: String, email: String, industry: String, bio: String,
      }, { _id: false }),
      default: undefined,
    },
    checkedInAt: { type: Date, required: true },
    seconds: { type: Number, required: true },
    spokenSeconds: Number,
    deferred: Boolean,
  },
  { _id: false }
);

const luckyDrawWinner = new Schema(
  {
    id: { type: String, required: true },
    prizeId: { type: String, required: true },
    prizeName: { type: String, required: true },
    winnerId: { type: String, required: true },
    source: { type: String, enum: ['wheel', 'bingo', 'draw'], default: 'draw' },
    reward: String,
    userId: String,
    name: { type: String, required: true },
    email: String,
    photoURL: String,
    coverImage: String,
    ticketNumber: Number,
    wonAt: { type: Date, default: Date.now },
    drawnBy: String,
    verificationHash: String,
    seed: String,
    timestamp: String,
  },
  { _id: false }
);

const luckyDrawPrize = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    reward: { type: String, default: '' },
    quantity: { type: Number, default: 1, min: 1 },
    order: { type: Number, default: 1 },
    imageUrl: { type: String, default: '' },
    color: { type: String, default: '#6366f1' },
    winners: { type: [luckyDrawWinner], default: [] },
  },
  { _id: false }
);

const luckyDrawConfig = new Schema(
  {
    enabled: { type: Boolean, default: true },
    allowRepeatWinners: { type: Boolean, default: false },
    drawMode: { type: String, enum: ['attendees', 'numbers'], default: 'attendees' },
    numberMin: { type: Number, default: 1 },
    numberMax: { type: Number, default: 100 },
    prizes: { type: [luckyDrawPrize], default: [] },
  },
  { _id: false }
);

const meeting = new Schema(
  {
    companyCode: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    location: String,
    latitude: Number,
    longitude: Number,
    gpsRadiusMeters: { type: Number, default: 200 },
    checkInQrTokenHash: String,
    checkInQrTokenEncrypted: { type: String, select: false },
    checkInQrExpiresAt: Date,

    coverImage: String,
    startsAt: { type: Date, required: true },
    endsAt: Date,
    startedAt: Date,
    seriesId: String,
    originalStartsAt: Date,
    createdBy: String,
    reminderDays: { type: Number, default: 1 },
    reminderMinutes: { type: Number, default: 60 },
    reminderAt: { type: Date, required: true },
    revision: { type: Number, default: 1 },
    tiers: {
      type: [{ startTime: String, endTime: String, count: Number, seconds: Number, _id: false }],
      default: defaultSpeakingTimeSlots,
    },
    fallbackSeconds: { type: Number, default: 20 },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'paused', 'ended', 'cancelled'],
      default: 'scheduled',
    },
    speakers: { type: [speaker], default: [] },
    presentation: {
      type: new Schema({
        view: { type: String, enum: ["checkin", "speaker", "luckyDraw", "activeMembers", "waiting"], default: "checkin" },
        autoAdvance: { type: Boolean, default: false },
        autoAdvanceDelay: { type: Number, default: 3, min: 0, max: 3600 },
        drawWinnerId: String, drawStartedAt: Date, drawRevealsAt: Date,
      }, { _id: false }),
      default: () => ({}),
    },
    currentIndex: { type: Number, default: -1 },
    speakerStartedAt: Date,
    speechesCompletedAt: Date,
    elapsedSeconds: { type: Number, default: 0 },
    endedAt: Date,
    gameWinners: { type: [luckyDrawWinner], default: [] },
    luckyDraw: {
      type: luckyDrawConfig,
      default: () => ({
        enabled: true,
        allowRepeatWinners: false,
        drawMode: 'attendees',
        numberMin: 1,
        numberMax: 100,
        prizes: [],
      }),
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

meeting.index({ companyCode: 1, startsAt: -1 });
meeting.index({ companyCode: 1, seriesId: 1 });
meeting.index({ status: 1, reminderAt: 1 });
meeting.index({ status: 1, "presentation.autoAdvance": 1 });

export const MeetingModel = model('Meeting', meeting);

// A reusable QR belongs to the company, independent of individual meetings.
const checkInQr = new Schema({
  companyCode: { type: String, required: true, unique: true },
  tokenHash: { type: String, unique: true, sparse: true },
  tokenEncrypted: { type: String, select: false },
  expiresAt: { type: Date, default: null },
  revokedAt: Date,
}, { timestamps: true });
export const MeetingCheckInQrModel = model('MeetingCheckInQr', checkInQr);

const delivery = new Schema(
  {
    companyCode: { type: String, required: true },
    meetingId: { type: String, required: true },
    revision: { type: Number, required: true },
    email: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'failed'],
      default: 'pending',
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    leaseUntil: Date,
    claimToken: String,
    error: String,
    sentAt: Date,
  },
  { timestamps: true }
);

delivery.index({ meetingId: 1, revision: 1, email: 1 }, { unique: true });
delivery.index({ status: 1, nextAttemptAt: 1 });

export const MeetingDeliveryModel = model('MeetingDelivery', delivery);
