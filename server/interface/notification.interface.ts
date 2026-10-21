import { Document } from "mongoose";

export type NotifType = "kho" | "task" | "training" | "he-thong";

export interface INotification extends Document {
  title: string;
  body: string;
  type: NotifType;
  companyCode: string;
  recipientUid: string;
  idempotencyKey?: string;
  read: boolean;
  action?: {
    tab: string;
    subTab?: string;
    feeId?: string;
    meetingId?: string;
    applicationId?: string;
    kind?: "meeting_started" | "draw_winner" | "chapter_approved";
  };
  createdAt: Date;
}
