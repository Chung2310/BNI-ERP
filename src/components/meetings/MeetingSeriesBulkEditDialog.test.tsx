// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MeetingSeriesBulkEditDialog } from "./MeetingSeriesBulkEditDialog";

vi.mock("./MeetingCoverImageField", () => ({ MeetingCoverImageField: () => <div>Ảnh bìa</div> }));
vi.mock("./MeetingSpeakingTimeFields", () => ({ MeetingSpeakingTimeFields: () => <div>Thời lượng phát biểu</div> }));

afterEach(cleanup);

it("applies changed GPS coordinates and radius to the selected meetings", async () => {
  const onApply = vi.fn().mockResolvedValue(undefined);
  const meeting = {
    _id: "meeting-1", title: "Họp tuần", startsAt: "2030-01-02T00:00:00.000Z", endsAt: "2030-01-02T02:00:00.000Z",
    latitude: 10, longitude: 106, gpsRadiusMeters: 200, tiers: [{ startTime: "07:00", endTime: "08:00", seconds: 30 }], fallbackSeconds: 20,
  };
  render(<MeetingSeriesBulkEditDialog
    meeting={meeting}
    meetings={[meeting]}
    seed={{ location: "", gpsPoint: { latitude: 10, longitude: 106 }, gpsRadiusMeters: 200, coverImage: "", startsTime: "07:00", durationMinutes: 120, tiers: meeting.tiers, fallbackSeconds: 20 }}
    loading={false}
    saving={false}
    onClose={vi.fn()}
    onApply={onApply}
  />);

  fireEvent.change(screen.getByLabelText("Vĩ độ"), { target: { value: "10.75" } });
  fireEvent.change(screen.getByLabelText("Bán kính cho phép (m)"), { target: { value: "350" } });
  fireEvent.click(screen.getByRole("button", { name: /Chọn buổi áp dụng/ }));
  fireEvent.click(screen.getByLabelText("Chọn tất cả (1)"));
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

  await waitFor(() => expect(onApply).toHaveBeenCalledWith(["meeting-1"], {
    latitude: 10.75,
    longitude: 106,
    gpsRadiusMeters: 350,
  }));
});
