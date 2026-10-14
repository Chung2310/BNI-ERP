import { Schema, model } from "mongoose";

// Legacy uploads also need durable ownership, even if never attached to a message.
const schema = new Schema({
  userId: { type: String, required: true, index: true },
  publicId: { type: String, required: true, unique: true },
  resourceType: { type: String, required: true },
  url: { type: String, required: true },
}, { timestamps: true });
export const OwnedMediaModel = model("OwnedMedia", schema);
