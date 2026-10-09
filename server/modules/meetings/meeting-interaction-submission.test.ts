import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { setRateLimitRedisClientForTesting } from "../../infrastructure/rate-limit-redis";

setRateLimitRedisClientForTesting({ eval: async () => [1, 1000], decr: async () => 0, del: async () => 0 });

const { submitMeetingInteractionResponse } = await import("./meeting-interaction.service");
const { MeetingModel } = await import("./meeting.model");
const { MeetingInteractionModel, MeetingInteractionResponseModel } = await import("./meeting-interaction.model");

test("submitting one of several questions stores only that answer", async t => {
  const token = "valid-participation-token";
  const session = MeetingInteractionModel.hydrate({
    _id: "507f1f77bcf86cd799439011",
    meetingId: "507f1f77bcf86cd799439012",
    companyCode: "ACME",
    question: "Question one",
    questions: [
      { id: "q1", text: "Question one" },
      { id: "q2", text: "Question two" },
    ],
    activeQuestionId: "q1",
    durationSeconds: 60,
    status: "open",
    closesAt: new Date(Date.now() + 60_000),
    tokenHash: createHash("sha256").update(token).digest("hex"),
    allowMultipleResponses: false,
    moderationEnabled: false,
    requireName: false,
  });
  t.mock.method(MeetingInteractionModel, "findOne", () => ({ select: async () => session }));
  t.mock.method(MeetingModel, "findById", () => ({ lean: async () => ({ title: "Meeting", status: "live" }) }));
  t.mock.method(MeetingInteractionResponseModel, "exists", async () => null);
  const inserted: Array<{ questionId: string; answer: string }> = [];
  t.mock.method(MeetingInteractionResponseModel, "insertMany", async (rows: typeof inserted) => {
    inserted.push(...rows);
    return rows.map((row, index) => ({ ...row, _id: String(index + 1) }));
  });

  const result = await submitMeetingInteractionResponse(token, {
    participantId: "participant-1",
    answers: [{ questionId: "q1", answer: "  Great  " }],
  });

  assert.deepEqual(inserted.map(({ questionId, answer }) => ({ questionId, answer })), [
    { questionId: "q1", answer: "Great" },
  ]);
  assert.equal(result.answerCount, 1);
  assert.equal(result.status, "approved");

  await assert.rejects(
    submitMeetingInteractionResponse(token, {
      participantId: "participant-2",
      answers: [{ questionId: "unknown", answer: "Invalid" }],
    }),
    { status: 400 },
  );
  assert.equal(inserted.length, 1);
});
