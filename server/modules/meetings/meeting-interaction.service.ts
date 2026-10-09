import { createHash, randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "../../security/crypto";
import { emitToCompany } from "../../socket";
import { MeetingModel } from "./meeting.model";
import { MeetingError } from "./meeting.service";
import { MeetingInteractionModel, MeetingInteractionResponseModel } from "./meeting-interaction.model";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const questionId = () => randomBytes(12).toString("base64url");
type QuestionInput = { question: string };
type SettingsInput = QuestionInput & { durationSeconds: number; requireName: boolean; showNames: boolean; moderationEnabled: boolean; allowMultipleResponses: boolean };

async function requireMeeting(companyCode: string, meetingId: string) {
  const meeting = await MeetingModel.findOne({ _id: meetingId, companyCode });
  if (!meeting) throw new MeetingError(404, "Không tìm thấy cuộc họp.");
  return meeting;
}

async function loadSession(companyCode: string, meetingId: string) {
  return MeetingInteractionModel.findOne({ companyCode, meetingId }).select("+tokenHash +tokenEncrypted");
}
type SessionDocument = NonNullable<Awaited<ReturnType<typeof loadSession>>>;

function activeQuestion(session: SessionDocument) {
  return session.questions.find(item => item.id === session.activeQuestionId) || session.questions[0];
}

async function normalizeSession(session: SessionDocument) {
  let changed = false;
  if (!session.questions.length) {
    const id = questionId();
    session.questions.push({ id, text: session.question });
    session.activeQuestionId = id;
    await MeetingInteractionResponseModel.updateMany(
      { interactionId: session._id, questionId: { $exists: false } },
      { $set: { questionId: id }, $unset: { dedupeKey: 1 } },
    );
    changed = true;
  }
  if (!session.questions.some(item => item.id === session.activeQuestionId)) {
    session.activeQuestionId = session.questions[0].id;
    changed = true;
  }
  if (!session.durationSeconds) {
    session.durationSeconds = session.questions[0].durationSeconds || 60;
    changed = true;
  }
  const current = activeQuestion(session);
  if (current && session.question !== current.text) {
    session.question = current.text;
    changed = true;
  }
  if (changed) await session.save();
  return session;
}

async function expireIfDue(session: SessionDocument) {
  if (session.status !== "open" || !session.closesAt || +session.closesAt > Date.now()) return false;
  session.status = "closed";
  session.closedAt = session.closesAt;
  await session.save();
  emitToCompany(session.companyCode, "meeting_interaction_updated", {
    meetingId: String(session.meetingId),
    interactionId: String(session._id),
    expired: true,
  });
  return true;
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

async function managedPayload(rawSession: Awaited<ReturnType<typeof loadSession>>) {
  if (!rawSession) return { session: null, responses: [] };
  const session = await normalizeSession(rawSession);
  await expireIfDue(session);
  const allResponses = await MeetingInteractionResponseModel.find({ interactionId: session._id }).sort({ createdAt: 1 }).lean();
  const current = activeQuestion(session);
  const currentResponses = allResponses.filter(response => response.questionId === current.id);
  const token = participationToken(session);
  return {
    session: {
      id: String(session._id), meetingId: String(session.meetingId), question: current.text,
      activeQuestionId: current.id, durationSeconds: session.durationSeconds,
      questionNumber: session.questions.findIndex(item => item.id === current.id) + 1,
      totalQuestions: session.questions.length,
      questions: session.questions.map((item, index) => {
        const responses = allResponses.filter(response => response.questionId === item.id);
        return { id: item.id, text: item.text, order: index + 1, responseCount: responses.length, approvedCount: responses.filter(response => response.status === "approved").length };
      }),
      status: session.status, openedAt: session.openedAt, closesAt: session.closesAt,
      requireName: session.requireName, showNames: session.showNames,
      moderationEnabled: session.moderationEnabled, allowMultipleResponses: session.allowMultipleResponses,
      participationUrl: "/meeting-interaction/" + token,
      responseCount: currentResponses.length,
      approvedCount: currentResponses.filter(response => response.status === "approved").length,
    },
    responses: currentResponses.map(response => ({
      id: String(response._id), questionId: response.questionId, participantId: response.participantId, name: response.name,
      answer: response.answer, status: response.status, createdAt: response.createdAt,
    })),
    allResponses: allResponses.map(response => ({
      id: String(response._id), questionId: response.questionId, participantId: response.participantId, name: response.name,
      answer: response.answer, status: response.status, createdAt: response.createdAt,
    })),
  };
}

export async function getManagedMeetingInteraction(companyCode: string, meetingId: string) {
  await requireMeeting(companyCode, meetingId);
  return managedPayload(await loadSession(companyCode, meetingId));
}

export async function saveMeetingInteraction(companyCode: string, meetingId: string, actorId: string, input: SettingsInput) {
  const meeting = await requireMeeting(companyCode, meetingId);
  if (["ended", "cancelled"].includes(meeting.status)) throw new MeetingError(409, "Cuộc họp đã đóng, không thể sửa bài tương tác.");
  let session = await loadSession(companyCode, meetingId);
  if (!session) {
    const token = randomBytes(32).toString("base64url");
    const id = questionId();
    session = new MeetingInteractionModel({
      meetingId, companyCode, createdBy: actorId, question: input.question,
      questions: [{ id, text: input.question }], activeQuestionId: id, durationSeconds: input.durationSeconds,
      tokenHash: tokenHash(token), tokenEncrypted: encryptSecret(token),
      requireName: input.requireName, showNames: input.showNames,
      moderationEnabled: input.moderationEnabled, allowMultipleResponses: input.allowMultipleResponses,
    });
  } else {
    await normalizeSession(session);
    if (session.status === "open") throw new MeetingError(409, "Hãy đóng nhận câu trả lời trước khi sửa bài tương tác.");
    const current = activeQuestion(session);
    const changedQuestion = current.text !== input.question;
    current.text = input.question;
    session.question = input.question;
    session.durationSeconds = input.durationSeconds;
    session.requireName = input.requireName;
    session.showNames = input.showNames;
    session.moderationEnabled = input.moderationEnabled;
    session.allowMultipleResponses = input.allowMultipleResponses;
    if (changedQuestion) await MeetingInteractionResponseModel.deleteMany({ interactionId: session._id, questionId: current.id });
  }
  await session.save();
  emitToCompany(companyCode, "meeting_interaction_updated", { meetingId, interactionId: String(session._id) });
  return managedPayload(session);
}

export async function addMeetingInteractionQuestion(companyCode: string, meetingId: string, input: QuestionInput) {
  const meeting = await requireMeeting(companyCode, meetingId);
  if (["ended", "cancelled"].includes(meeting.status)) throw new MeetingError(409, "Cuộc họp đã đóng.");
  const session = await loadSession(companyCode, meetingId);
  if (!session) throw new MeetingError(404, "Hãy tạo câu hỏi đầu tiên trước.");
  await normalizeSession(session);
  if (session.status === "open") throw new MeetingError(409, "Hãy đóng nhận câu trả lời trước khi thêm câu hỏi.");
  if (session.questions.length >= 20) throw new MeetingError(409, "Mỗi bài tương tác chỉ được tạo tối đa 20 câu hỏi.");
  const id = questionId();
  session.questions.push({ id, text: input.question });
  session.activeQuestionId = id;
  session.question = input.question;
  await session.save();
  emitToCompany(companyCode, "meeting_interaction_updated", { meetingId, interactionId: String(session._id), questionId: id });
  return managedPayload(session);
}

export async function selectMeetingInteractionQuestion(companyCode: string, meetingId: string, id: string) {
  await requireMeeting(companyCode, meetingId);
  const session = await loadSession(companyCode, meetingId);
  if (!session) throw new MeetingError(404, "Không tìm thấy bài tương tác.");
  await normalizeSession(session);
  const selected = session.questions.find(item => item.id === id);
  if (!selected) throw new MeetingError(404, "Không tìm thấy câu hỏi.");
  session.activeQuestionId = id;
  session.question = selected.text;
  await session.save();
  emitToCompany(companyCode, "meeting_interaction_updated", { meetingId, interactionId: String(session._id), questionId: id });
  return managedPayload(session);
}

export async function deleteMeetingInteractionQuestion(companyCode: string, meetingId: string, id: string) {
  await requireMeeting(companyCode, meetingId);
  const session = await loadSession(companyCode, meetingId);
  if (!session) throw new MeetingError(404, "Không tìm thấy bài tương tác.");
  await normalizeSession(session);
  if (session.status === "open") throw new MeetingError(409, "Hãy đóng nhận câu trả lời trước khi xóa câu hỏi.");
  if (session.questions.length <= 1) throw new MeetingError(409, "Phải giữ lại ít nhất một câu hỏi.");
  const index = session.questions.findIndex(item => item.id === id);
  if (index < 0) throw new MeetingError(404, "Không tìm thấy câu hỏi.");
  session.questions.splice(index, 1);
  await MeetingInteractionResponseModel.deleteMany({ interactionId: session._id, questionId: id });
  if (session.activeQuestionId === id) session.activeQuestionId = session.questions[Math.min(index, session.questions.length - 1)].id;
  session.question = activeQuestion(session).text;
  await session.save();
  emitToCompany(companyCode, "meeting_interaction_updated", { meetingId, interactionId: String(session._id), questionId: session.activeQuestionId });
  return managedPayload(session);
}

export async function setMeetingInteractionStatus(companyCode: string, meetingId: string, status: "open" | "closed") {
  const meeting = await requireMeeting(companyCode, meetingId);
  if (["ended", "cancelled"].includes(meeting.status)) throw new MeetingError(409, "Cuộc họp đã đóng.");
  const session = await loadSession(companyCode, meetingId);
  if (!session) throw new MeetingError(404, "Hãy tạo bài tương tác trước khi mở nhận câu trả lời.");
  await normalizeSession(session);
  const now = new Date();
  session.status = status;
  if (status === "open") {
    session.openedAt = now;
    session.closesAt = new Date(+now + session.durationSeconds * 1000);
    session.closedAt = undefined;
  } else {
    session.closedAt = now;
    session.closesAt = undefined;
  }
  await session.save();
  emitToCompany(companyCode, "meeting_interaction_updated", { meetingId, interactionId: String(session._id) });
  return managedPayload(session);
}

export async function moderateMeetingInteractionResponse(companyCode: string, meetingId: string, responseId: string, status: "approved" | "hidden" | "rejected") {
  const session = await loadSession(companyCode, meetingId);
  if (!session) throw new MeetingError(404, "Không tìm thấy bài tương tác.");
  const response = await MeetingInteractionResponseModel.findOneAndUpdate(
    { _id: responseId, interactionId: session._id }, { $set: { status } }, { new: true },
  );
  if (!response) throw new MeetingError(404, "Không tìm thấy câu trả lời.");
  emitToCompany(companyCode, "meeting_interaction_updated", { meetingId, interactionId: String(session._id), responseId });
  return managedPayload(session);
}

async function resolvePublicSession(token: string) {
  const rawSession = await MeetingInteractionModel.findOne({ tokenHash: tokenHash(token) }).select("+tokenHash +tokenEncrypted");
  if (!rawSession) throw new MeetingError(410, "Mã tương tác không hợp lệ hoặc đã hết hiệu lực.");
  const session = await normalizeSession(rawSession);
  await expireIfDue(session);
  const meeting = await MeetingModel.findById(session.meetingId).lean();
  if (!meeting || ["ended", "cancelled"].includes(meeting.status)) throw new MeetingError(410, "Cuộc họp đã kết thúc.");
  return { session, meeting };
}

export async function getPublicMeetingInteraction(token: string) {
  const { session, meeting } = await resolvePublicSession(token);
  return {
    meetingTitle: meeting.title,
    questions: session.questions.map((item, index) => ({ id: item.id, text: item.text, order: index + 1 })),
    totalQuestions: session.questions.length,
    durationSeconds: session.durationSeconds,
    openedAt: session.openedAt,
    closesAt: session.closesAt,
    status: session.status,
    requireName: session.requireName,
    allowMultipleResponses: session.allowMultipleResponses,
  };
}

export async function submitMeetingInteractionResponse(token: string, input: { participantId: string; name?: string; answers: Array<{ questionId: string; answer: string }> }) {
  const { session, meeting } = await resolvePublicSession(token);
  if (session.status !== "open" || !session.closesAt || +session.closesAt <= Date.now()) throw new MeetingError(409, "Thời gian trả lời bài tương tác đã kết thúc.");
  const name = String(input.name || "Ẩn danh").trim() || "Ẩn danh";
  if (session.requireName && name === "Ẩn danh") throw new MeetingError(400, "Vui lòng nhập tên của bạn.");

  const answerMap = new Map(input.answers.map(item => [item.questionId, item.answer.trim()]));
  const answeredQuestions = session.questions.filter(item => answerMap.has(item.id));
  if (!answeredQuestions.length || answeredQuestions.length !== input.answers.length || answeredQuestions.some(item => !answerMap.get(item.id))) {
    throw new MeetingError(400, "Vui lòng trả lời ít nhất một câu hỏi hợp lệ.");
  }
  if (!session.allowMultipleResponses) {
    const exists = await MeetingInteractionResponseModel.exists({ interactionId: session._id, participantId: input.participantId });
    if (exists) throw new MeetingError(409, "Bạn đã gửi câu trả lời cho bài tương tác này.");
  }

  try {
    const responses = await MeetingInteractionResponseModel.insertMany(answeredQuestions.map(item => ({
      interactionId: session._id, meetingId: session.meetingId, questionId: item.id, participantId: input.participantId,
      dedupeKey: session.allowMultipleResponses ? undefined : `${session._id}:${item.id}:${input.participantId}`,
      name, answer: answerMap.get(item.id), status: session.moderationEnabled ? "pending" : "approved",
    })));
    emitToCompany(session.companyCode, "meeting_interaction_updated", { meetingId: String(session.meetingId), interactionId: String(session._id) });
    return {
      ids: responses.map(response => String(response._id)),
      status: session.moderationEnabled ? "pending" : "approved",
      meetingTitle: meeting.title,
      answerCount: responses.length,
    };
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new MeetingError(409, "Bạn đã gửi câu trả lời cho bài tương tác này.");
    throw error;
  }
}
