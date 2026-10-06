import { Schema, model } from "mongoose";

const interactionQuestion = new Schema({
  id: { type: String, required: true },
  text: { type: String, required: true, maxlength: 300 },
  durationSeconds: { type: Number, min: 10, max: 3600 },
}, { _id: false });

const meetingInteraction = new Schema({
  meetingId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
  companyCode: { type: String, required: true, index: true },
  // Legacy aliases remain populated so existing documents and older deployments can be migrated safely.
  question: { type: String, required: true, maxlength: 300 },
  questions: { type: [interactionQuestion], default: [] },
  activeQuestionId: String,
  durationSeconds: { type: Number, required: true, min: 10, max: 3600, default: 60 },
  status: { type: String, enum: ["draft", "open", "closed"], default: "draft", index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  tokenEncrypted: { type: String, required: true, select: false },
  requireName: { type: Boolean, default: true },
  showNames: { type: Boolean, default: true },
  moderationEnabled: { type: Boolean, default: true },
  allowMultipleResponses: { type: Boolean, default: false },
  createdBy: { type: String, required: true },
  openedAt: Date,
  closesAt: Date,
  closedAt: Date,
}, { timestamps: true });

const meetingInteractionResponse = new Schema({
  interactionId: { type: Schema.Types.ObjectId, required: true, index: true },
  meetingId: { type: Schema.Types.ObjectId, required: true, index: true },
  questionId: { type: String, index: true },
  participantId: { type: String, required: true, maxlength: 100 },
  dedupeKey: { type: String, unique: true, sparse: true, select: false },
  name: { type: String, required: true, maxlength: 150 },
  answer: { type: String, required: true, maxlength: 200 },
  status: { type: String, enum: ["pending", "approved", "hidden", "rejected"], default: "pending", index: true },
}, { timestamps: true });

meetingInteractionResponse.index({ interactionId: 1, questionId: 1, createdAt: 1 });
meetingInteractionResponse.index({ interactionId: 1, questionId: 1, participantId: 1 });

export const MeetingInteractionModel = model("MeetingInteraction", meetingInteraction);
export const MeetingInteractionResponseModel = model("MeetingInteractionResponse", meetingInteractionResponse);