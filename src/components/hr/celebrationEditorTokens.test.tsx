// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RichTextEditor } from "./CelebrationEmailTab";
import { CHIP_SELECTOR, renderVariableChips, serializeVariableChips } from "./celebrationEditorTokens";
import { HR_BIRTHDAY_TEMPLATE_VARIABLES as variables } from "./hrCelebrationVariableRegistry";
import { TEMPLATE_VARIABLE_MIME } from "../template-editor/TemplateVariablePalette";

afterEach(() => {
  cleanup();
  delete (document as any).caretRangeFromPoint;
  delete (document as any).caretPositionFromPoint;
  window.getSelection()?.removeAllRanges();
});

function setup(html: string) {
  const changed = vi.fn();
  function Editor() {
    const [value, setValue] = React.useState(html);
    return <RichTextEditor label="Email body" value={value} variables={variables} onChange={(value) => { changed(value); setValue(value); }} />;
  }
  render(<Editor />);
  return { editor: screen.getByRole("textbox", { name: "Email body" }), changed };
}
function transfer(key: string) {
  return { types: [TEMPLATE_VARIABLE_MIME], getData: (type: string) => type === TEMPLATE_VARIABLE_MIME ? key : "", setData: vi.fn(), effectAllowed: "", dropEffect: "" };
}
function caret(node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  return range;
}

it("shows existing variables as chips and preserves image attributes and formatted HTML when serializing", () => {
  const raw = '<p style="text-align:center">Hi <strong>{{employeeName}}</strong>!</p><img src="/logo.png" style="width:100px"><a href="/{{companyName}}">Link</a>';
  const root = document.createElement("div");
  root.innerHTML = renderVariableChips(raw, variables);
  expect(root.querySelector(CHIP_SELECTOR)?.textContent).toBe("[Tên thành viên]");
  expect(root.querySelector(CHIP_SELECTOR)?.getAttribute("contenteditable")).toBe("false");
  expect(serializeVariableChips(root, variables)).toBe(raw);
});

it("inserts by clicking at the remembered caret including position zero", () => {
  const { editor, changed } = setup("<p>Hello</p>");
  const range = caret(editor.querySelector("p")!.firstChild!, 0);
  window.getSelection()?.addRange(range);
  fireEvent.mouseUp(editor);
  fireEvent.click(screen.getByRole("button", { name: "Tên thành viên" }));
  expect(changed).toHaveBeenLastCalledWith("<p>{{employeeName}}Hello</p>");
  expect(editor.querySelectorAll(CHIP_SELECTOR)).toHaveLength(1);
});

it("drops a palette chip at the pointer rather than the previous selection", () => {
  const { editor, changed } = setup("<p>Hello world</p>");
  const data = transfer("employeeName");
  fireEvent.dragStart(screen.getByRole("button", { name: "Tên thành viên" }), { dataTransfer: data });
  expect(data.setData).toHaveBeenCalledWith(TEMPLATE_VARIABLE_MIME, "employeeName");
  (document as any).caretPositionFromPoint = vi.fn(() => ({ offsetNode: editor.querySelector("p")!.firstChild!, offset: 6 }));
  fireEvent.drop(editor, { dataTransfer: data, clientX: 20, clientY: 30 });
  expect(changed).toHaveBeenLastCalledWith("<p>Hello {{employeeName}}world</p>");
  expect(changed.mock.lastCall?.[0]).not.toContain("data-celebration-variable");
});

it("moves a chip already in the body without duplicating its variable", () => {
  const { editor, changed } = setup("<p>{{employeeName}} hello world</p>");
  const chip = editor.querySelector<HTMLElement>(CHIP_SELECTOR)!;
  const data = transfer("employeeName");
  fireEvent.dragStart(chip, { dataTransfer: data });
  (document as any).caretRangeFromPoint = () => caret(editor.querySelector("p")!.lastChild!, 12);
  fireEvent.drop(editor, { dataTransfer: data, clientX: 20, clientY: 30 });
  expect(changed).toHaveBeenLastCalledWith("<p> hello world{{employeeName}}</p>");
  expect(editor.querySelectorAll(CHIP_SELECTOR)).toHaveLength(1);
});

it("rejects variables unavailable to this template and appends when no point API is available", () => {
  const { editor, changed } = setup("<p>Hello</p>");
  fireEvent.drop(editor, { dataTransfer: transfer("holidayName") });
  expect(changed).not.toHaveBeenCalled();
  fireEvent.drop(editor, { dataTransfer: transfer("companyName") });
  expect(changed).toHaveBeenLastCalledWith("<p>Hello</p>{{companyName}}");
});

it("serializes deleting an entire chip and keeps the remaining text", () => {
  const { editor, changed } = setup("<p>Hi {{employeeName}}!</p>");
  editor.querySelector(CHIP_SELECTOR)!.remove();
  fireEvent.input(editor);
  expect(changed).toHaveBeenLastCalledWith("<p>Hi !</p>");
});
