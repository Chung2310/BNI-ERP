// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MeetingScheduleActions } from "./MeetingScheduleActions";

afterEach(cleanup);

it.each(["cancelled", "ended"])("shows only a clear delete action for a %s meeting", (status) => {
  const onDelete = vi.fn();
  render(
    <MeetingScheduleActions
      status={status}
      onCancel={vi.fn()}
      onReschedule={vi.fn()}
      onDelete={onDelete}
    />,
  );

  expect(screen.queryByRole("button", { name: "Hủy" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Dời lịch" })).toBeNull();
  const remove = screen.getByRole("button", { name: "Xóa cuộc họp" });
  expect(remove.textContent).toContain("Xóa cuộc họp");
  fireEvent.click(remove);
  expect(onDelete).toHaveBeenCalledOnce();
});
