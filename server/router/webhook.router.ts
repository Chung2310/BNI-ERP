import { Router } from "express";

export const webhookRouter = Router();

webhookRouter.post("/", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
