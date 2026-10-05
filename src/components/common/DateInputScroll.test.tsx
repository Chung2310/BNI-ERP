// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DateInputScroll } from "./DateInputScroll";

afterEach(cleanup);
function Fixture({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return <><DateInputScroll value={value} onChange={setValue} ariaLabel="Ngày bắt đầu" /><output aria-label="Ngày đã lưu">{value}</output></>;
}
function choose(group: string, option: string) {
  fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("button", { name: option }));
}

it("clamps the day for shorter months, including leap years, and commits only on Done", () => {
  render(<Fixture initial="2028-01-31" />);
  fireEvent.click(screen.getByRole("button", { name: "Ngày bắt đầu" }));
  choose("Tháng", "02");
  const days = within(screen.getByRole("group", { name: "Ngày" }));
  expect(days.getAllByRole("button")).toHaveLength(29);
  expect(days.getByRole("button", { name: "29" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByLabelText("Ngày đã lưu").textContent).toBe("2028-01-31");
  choose("Năm", "2029");
  expect(days.getAllByRole("button")).toHaveLength(28);
  fireEvent.click(screen.getByRole("button", { name: "Xong" }));
  expect(screen.getByLabelText("Ngày đã lưu").textContent).toBe("2029-02-28");
  expect(screen.getByRole("button", { name: "Ngày bắt đầu" }).textContent).toBe("28/02/2029");
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("discards unfinished selection on Escape and reopens the saved date", () => {
  render(<Fixture initial="2030-12-31" />);
  const trigger = screen.getByRole("button", { name: "Ngày bắt đầu" });
  fireEvent.click(trigger);
  choose("Tháng", "01");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.getByLabelText("Ngày đã lưu").textContent).toBe("2030-12-31");
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  expect(within(screen.getByRole("group", { name: "Tháng" })).getByRole("button", { name: "12" }).getAttribute("aria-pressed")).toBe("true");
});
