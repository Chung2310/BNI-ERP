import { createHash, randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "../../security/crypto";
import { emitToCompany } from "../../socket";
import { MeetingModel } from "./meeting.model";
import { MeetingError } from "./meeting.service";
import { MeetingInteractionModel, MeetingInteractionResponseModel } from "./meeting-interaction.model";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

async function requireMeeting(companyCode: string, meetingId: string) {
  const meeting = await MeetingModel.findOne({ _id: meetingId, companyCode });
  if (!meeting) throw new MeetingError(404, "Không tìm thấy cuộc họp.");
  return meeting;
}

async function loadSession(companyCode: string, meetingId: string) {
  return MeetingInteractionModel.findOne({ companyCode, meetingId }).select("+tokenHash +tokenEncrypted");
}

function participationToken(session: { tokenEncrypted?: string; tokenHash?: string }) {
  if (!session.tokenEncrypted || !session.tokenHash) throw new MeetingError(409, "Không thể đọc mã tham gia tương tác.");
  try {
    const token = decryptSecret(session.tokenEncrypted);
    if (tokenHash(token) !== session.tokenHash) throw new Error("Token mismatch");
    return token;
  } catch {
    throw new MeetingError(409, "Mã tham gia tương tác không hợp lệ.");
  }
}

async function managedPayload(session: Awaited<ReturnType<typeof loadSession>>) {
  if (!session) return { session: null, responses: [] };
  const responses = await MeetingInteractionResponseModel.find({ interactionId: session._id }).sort({ createdAt: 1 }).lean();
  const token = participationToken(session);
  return {
    session: {
      id: String(session._id), meetingId: String(session.meetingId), question: session.question,
      status: session.status, requireName: session.requireName, showNames: session.showNames,
      moderationEnabled: session.moderationEnabled, allowMultipleResponses: session.allowMultipleResponses,
      participationUrl: "/meeting-interaction/" + token,
      responseCount: responses.length,
      approvedCount: responses.filter(response => response.status === "approved").length,
    },
    responses: responses.map(response => ({
      id: String(response._id), participantId: response.participantId, name: response.name,
      answer: response.answer, status: response.status, createdAt: response.createdAt,
    })),
  };
}

export async function getManagedMeetingInteraction(companyCode: string, meetingId: string) {
  await requireMeeting(companyCode, meetingId);
  return managedPayload(await loadSession(companyCode, meetingId));
}

export async function saveMeetingInteraction(companyCode: string, meetingId: string, actorId: string, input: {
  question: string; requireName: boolean; showNames: boolean; moderationEnabled: boolean; allowMultipleResponses: boolean;
}) {
  const meeting = await requireMeeting(companyCode, meetingId);
  if (["ended", "cancelled"].includes(meeting.status)) throw new MeetingError(409, "Cuộc họp đã đóng, không thể sửa câu hỏi tương tác.");
  let session = await loadSession(companyCode, meetingId);
  const changedQuestion = Boolean(session && session.question !== input.question);
  if (!session) {
    const token = randomBytes(32).toString("base64url");
    session = new MeetingInteractionModel({
      meetingId, companyCode, createdBy: actorId, question: input.question,
      tokenHash: tokenHash(token), tokenEncrypted: encryptSecret(token),
      requireName: input.requireName, showNames: input.showNames,
      moderationEnabled: input.moderationEnabled, allowMultipleResponses: input.allowMultipleResponses,
    });
  } else {
    session.question = input.question;
    session.requireName = input.requireName;
    session.showNames = input.showNames;
    session.moderationEnabled = input.moderationEnabled;
    session.allowMultipleResponses = input.allowMultipleResponses;
    if (changedQuestion) {
      session.status = "draft";
      session.openedAt = undefined;
      session.closedAt = undefined;
      await MeetingInteractionResponseModel.deleteMany({ interactionId: session._id });
    }
  }
  await session.save();
  emitToCompany(companyCode, "meeting_interaction_updated", { meetingId, interactionId: String(session._id) });
  return managedPayload(session);
}

export async function setMeetingInteractionStatus(companyCode: string, meetingId: string, status: "open" | "closed") {
  const meeting = await requireMeeting(companyCode, meetingId);
  if (["ended", "cancelled"].includes(meeting.status)) throw new MeetingError(409, "Cuộc họp đã đóng.");
  const session = await loadSession(companyCode, meetingId);
  if (!session) throw new MeetingError(404, "Hãy tạo câu hỏi trước khi mở nhận câu trả lời.");
  session.status = status;
  if (status === "open") { session.openedAt = new Date(); session.closedAt = undefined; }
  else session.closedAt = new Date();
  await session.save();
  emitToCompany(companyCode, "meeting_interaction_updated", { meetingId, interactionId: String(session._id) });
  return managedPayload(session);
}

export async function moderateMeetingInteractionResponse(companyCode: string, meetingId: string, responseId: string, status: "approved" | "hidden" | "rejected") {
  const session = await loadSession(companyCode, meetingId);
  if (!session) throw new MeetingError(404, "Không tìm thấy phiên tương tác.");
  const response = await MeetingInteractionResponseModel.findOneAndUpdate(
    { _id: responseId, interactionId: session._id }, { $set: { status } }, { new: true }
  );
  if (!response) throw new MeetingError(404, "Không tìm thấy câu trả lời.");
  emitToCompany(companyCode, "meeting_interaction_updated", { meetingId, interactionId: String(session._id), responseId });
  return managedPayload(session);
}

async function resolvePublicSession(token: string) {
  const session = await MeetingInteractionModel.findOne({ tokenHash: tokenHash(token) }).select("+tokenHash");
  if (!session) throw new MeetingError(410, "Mã tương tác không hợp lệ hoặc đã hết hiệu lực.");
  const meeting = await MeetingModel.findById(session.meetingId).lean();
  if (!meeting || ["ended", "cancelled"].includes(meeting.status)) throw new MeetingError(410, "Cuộc họp đã kết thúc.");
  return { session, meeting };
}

export async function getPublicMeetingInteraction(token: string) {
  const { session, meeting } = await resolvePublicSession(token);
  return {
    meetingTitle: meeting.title, question: session.question, status: session.status,
    requireName: session.requireName, allowMultipleResponses: session.allowMultipleResponses,
  };
}

export async function submitMeetingInteractionResponse(token: string, input: { participantId: string; name?: string; answer: string }) {
  const { session, meeting } = await resolvePublicSession(token);
  if (session.status !== "open") throw new MeetingError(409, "Phiên tương tác hiện chưa mở nhận câu trả lời.");
  const name = String(input.name || "Ẩn danh").trim() || "Ẩn danh";
  if (session.requireName && name === "Ẩn danh") throw new MeetingError(400, "Vui lòng nhập tên của bạn.");
  if (!session.allowMultipleResponses) {
    const exists = await MeetingInteractionResponseModel.exists({ interactionId: session._id, participantId: input.participantId });
    if (exists) throw new MeetingError(409, "Bạn đã gửi câu trả lời cho câu hỏi này.");
  }
  let response;
  try {
    response = await MeetingInteractionResponseModel.create({
      interactionId: session._id, meetingId: session.meetingId, participantId: input.participantId,
      dedupeKey: session.allowMultipleResponses ? undefined : `${session._id}:${input.participantId}`,
      name, answer: input.answer, status: session.moderationEnabled ? "pending" : "approved",
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new MeetingError(409, "Bạn đã gửi câu trả lời cho câu hỏi này.");
    throw error;
  }
  emitToCompany(session.companyCode, "meeting_interaction_updated", {
    meetingId: String(session.meetingId), interactionId: String(session._id), responseId: String(response._id),
  });
  return { id: String(response._id), status: response.status, meetingTitle: meeting.title };
}
