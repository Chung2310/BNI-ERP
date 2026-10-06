// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MeetingFlowStepper, type MeetingFlowStep } from "./MeetingFlowStepper";

afterEach(cleanup);

function SelectorHarness() {
  const [current, setCurrent] = useState<MeetingFlowStep>("checkin");
  return <MeetingFlowStepper current={current} onSelect={setCurrent} />;
}

it("lets users open any meeting section without sequential step controls", () => {
  render(<SelectorHarness />);

  expect(screen.getAllByRole("tab")).toHaveLength(5);
  expect(screen.queryByText(/Bước \d/)).toBeNull();
  expect(screen.queryByRole("button", { name: /Quay lại|Tiếp tục/ })).toBeNull();

  fireEvent.click(screen.getByRole("tab", { name: "Quay thưởng" }));
  expect(screen.getByRole("tab", { name: "Quay thưởng" }).getAttribute("aria-selected")).toBe("true");

  fireEvent.click(screen.getByRole("tab", { name: "Tương tác" }));
  expect(screen.getByRole("tab", { name: "Tương tác" }).getAttribute("aria-selected")).toBe("true");

  fireEvent.click(screen.getByRole("tab", { name: "Thuyết trình" }));
  expect(screen.getByRole("tab", { name: "Thuyết trình" }).getAttribute("aria-selected")).toBe("true");
});

it("keeps meeting completion as an independent action", () => {
  const onFinish = vi.fn();
  render(<MeetingFlowStepper current="activeMembers" onSelect={vi.fn()} onFinish={onFinish} />);

  fireEvent.click(screen.getByRole("button", { name: "Kết thúc cuộc họp" }));
  expect(onFinish).toHaveBeenCalledOnce();
});
