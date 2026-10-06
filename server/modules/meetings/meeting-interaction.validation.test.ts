import { expect, it } from "vitest";
import { meetingInteractionInput, meetingInteractionModerationInput, meetingInteractionStatusInput, presentationStateInput } from "./meeting.validation";
import { MeetingInteractionModel, MeetingInteractionResponseModel } from "./meeting-interaction.model";

it("validates interaction configuration and management actions", () => {
  expect(meetingInteractionInput.validate({ question: "Bạn học được gì?" }).value).toMatchObject({ requireName: true, showNames: true, moderationEnabled: true, allowMultipleResponses: false });
  expect(meetingInteractionInput.validate({ question: "" }).error).toBeDefined();
  expect(meetingInteractionInput.validate({ question: "x".repeat(301) }).error).toBeDefined();
  expect(meetingInteractionStatusInput.validate({ status: "open" }).error).toBeUndefined();
  expect(meetingInteractionStatusInput.validate({ status: "draft" }).error).toBeDefined();
  expect(meetingInteractionModerationInput.validate({ status: "approved" }).error).toBeUndefined();
  expect(meetingInteractionModerationInput.validate({ status: "pending" }).error).toBeDefined();
  expect(presentationStateInput.validate({ version: 0, view: "audienceResponses" }).error).toBeUndefined();
});