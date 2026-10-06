import { expect, it } from "vitest";
import {
  meetingInteractionInput,
  meetingInteractionModerationInput,
  meetingInteractionQuestionInput,
  meetingInteractionStatusInput,
  presentationStateInput,
} from "./meeting.validation";
import { MeetingInteractionModel, MeetingInteractionResponseModel } from "./meeting-interaction.model";

it("validates interaction configuration and management actions", () => {
  expect(meetingInteractionInput.validate({ question: "Bạn học được gì?" }).value).toMatchObject({
    durationSeconds: 60,
    requireName: true,
    showNames: true,
    moderationEnabled: true,
    allowMultipleResponses: false,
  });
  expect(meetingInteractionInput.validate({ question: "" }).error).toBeDefined();
  expect(meetingInteractionInput.validate({ question: "x".repeat(301) }).error).toBeDefined();
  expect(meetingInteractionInput.validate({ question: "Câu hỏi", durationSeconds: 0 }).error).toBeDefined();
  expect(meetingInteractionQuestionInput.validate({ question: "Câu tiếp theo" }).value).toEqual({ question: "Câu tiếp theo" });
  expect(meetingInteractionQuestionInput.validate({ question: "Câu tiếp theo", durationSeconds: 60 }).error).toBeDefined();
  expect(meetingInteractionStatusInput.validate({ status: "open" }).error).toBeUndefined();
  expect(meetingInteractionStatusInput.validate({ status: "draft" }).error).toBeDefined();
  expect(meetingInteractionModerationInput.validate({ status: "approved" }).error).toBeUndefined();
  expect(meetingInteractionModerationInput.validate({ status: "pending" }).error).toBeDefined();
  expect(presentationStateInput.validate({ version: 0, view: "audienceResponses" }).error).toBeUndefined();
});

it("stores questions, deadlines, and per-question responses", () => {
  expect(MeetingInteractionModel.schema.path("questions")).toBeDefined();
  expect(MeetingInteractionModel.schema.path("activeQuestionId")).toBeDefined();
  expect(MeetingInteractionModel.schema.path("durationSeconds")).toBeDefined();
  expect(MeetingInteractionModel.schema.path("closesAt")).toBeDefined();
  expect(MeetingInteractionResponseModel.schema.path("questionId")).toBeDefined();
});