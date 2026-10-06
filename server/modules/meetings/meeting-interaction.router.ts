import { Router } from "express";
import Joi from "joi";
import { publicApiRateLimiter } from "../../middleware/rate-limit";
import { MeetingError } from "./meeting.service";
import { getPublicMeetingInteraction, submitMeetingInteractionResponse } from "./meeting-interaction.service";

const responseInput = Joi.object({
  participantId: Joi.string().trim().min(8).max(100).required(),
  name: Joi.string().trim().max(150).allow(""),
  answer: Joi.string().trim().min(1).max(200).required(),
});

export const meetingInteractionPublicRouter = Router();
meetingInteractionPublicRouter.use(publicApiRateLimiter);
const sendError = (res: import("express").Response, error: unknown) => res.status(error instanceof MeetingError ? error.status : 500).json({
  message: (error instanceof Error ? error.message : "") || "Không thể xử lý tương tác.",
});

meetingInteractionPublicRouter.get("/:token", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try { res.json({ data: await getPublicMeetingInteraction(req.params.token) }); }
  catch (error) { sendError(res, error); }
});

meetingInteractionPublicRouter.post("/:token/responses", async (req, res) => {
  const { error, value } = responseInput.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try { res.status(201).json({ data: await submitMeetingInteractionResponse(req.params.token, value) }); }
  catch (submitError) { sendError(res, submitError); }
});
