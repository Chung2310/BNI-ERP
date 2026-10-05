export type SpeakingTimeSlot = { startTime: string; endTime: string; seconds: number };
// count is retained only to read schedules saved before time slots were introduced.
export type SpeakingTier = { startTime?: string; endTime?: string; count?: number; seconds: number };

export function defaultSpeakingTimeSlots(): SpeakingTimeSlot[] {
  return [
    { startTime: "07:00", endTime: "08:00", seconds: 30 },
    { startTime: "08:00", endTime: "09:00", seconds: 20 },
  ];
}

export function speakingTimeSlotsForEdit(tiers?: SpeakingTier[]): SpeakingTimeSlot[] {
  if (!tiers?.length || tiers.some(tier => !tier.startTime || !tier.endTime)) return defaultSpeakingTimeSlots();
  return tiers.map(tier => ({ startTime: tier.startTime!, endTime: tier.endTime!, seconds: tier.seconds }));
}

export function validateSpeakingTimeSlots(slots: SpeakingTimeSlot[]): string {
  if (!slots.length || slots.length > 20) return "Vui lòng cấu hình từ 1 đến 20 khung giờ.";
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const slot of slots) {
    if (!time.test(slot.startTime) || !time.test(slot.endTime)) return "Vui lòng nhập đầy đủ giờ bắt đầu và kết thúc.";
    if (slot.startTime >= slot.endTime) return "Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.";
    if (!Number.isInteger(slot.seconds) || slot.seconds < 1 || slot.seconds > 3600) return "Thời lượng phát biểu phải từ 1 đến 3600 giây.";
  }
  const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (sorted.some((slot, index) => index > 0 && slot.startTime < sorted[index - 1].endTime)) return "Các khung giờ check-in không được chồng nhau.";
  return "";
}
