import { Schema, model } from "mongoose";
import { MeetingModel } from "./meeting.model";

export const MeetingSequenceModel = model("MeetingSequence", new Schema({
  _id: { type: String, required: true },
  value: { type: Number, required: true, default: 0 },
}, { versionKey: false }));

/** Reserve an entire series atomically; allocated numbers are never recycled. */
export async function reserveMeetingNumbers(companyCode: string, count: number): Promise<number> {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("Số buổi họp không hợp lệ.");
  if (!await MeetingSequenceModel.exists({ _id: companyCode })) {
    const existing = await MeetingModel.find({ companyCode, title: /^BNI Chapter #[1-9]\d*$/ }).select("title").lean();
    const maximum = existing.reduce((max, meeting) => {
      const number = Number(meeting.title.slice("BNI Chapter #".length));
      return Number.isSafeInteger(number) ? Math.max(max, number) : max;
    }, 0);
    try {
      await MeetingSequenceModel.updateOne({ _id: companyCode }, { $setOnInsert: { value: maximum } }, { upsert: true });
    } catch (error) {
      // Another request may have initialized the same company counter first.
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
  const counter = await MeetingSequenceModel.findOneAndUpdate(
    { _id: companyCode }, { $inc: { value: count } }, { new: true },
  );
  if (!counter || !Number.isSafeInteger(counter.value)) throw new Error("Không thể cấp số cuộc họp.");
  return counter.value - count + 1;
}
