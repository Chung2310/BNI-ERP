// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MeetingLocationFields } from "./MeetingLocationFields";

afterEach(cleanup);

it("lets users clear and replace the GPS radius without prefixing zero", () => {
  const onRadiusChange = vi.fn();
  render(
    <MeetingLocationFields
      value={null}
      onChange={vi.fn()}
      radius={200}
      onRadiusChange={onRadiusChange}
    />,
  );

  const radius = screen.getByLabelText("Bán kính cho phép (m)") as HTMLInputElement;
  fireEvent.change(radius, { target: { value: "" } });
  expect(radius.value).toBe("");
  fireEvent.change(radius, { target: { value: "5" } });
  expect(radius.value).toBe("5");
  expect(onRadiusChange).toHaveBeenLastCalledWith(5);
});
