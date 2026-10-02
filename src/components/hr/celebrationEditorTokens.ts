import type { TemplateVariableConfig } from "../template-editor/templateEditorTypes";

export const CHIP_SELECTOR = "span[data-celebration-variable]";

export function createVariableChip(variable: TemplateVariableConfig) {
  const chip = document.createElement("span");
  chip.dataset.celebrationVariable = variable.key;
  chip.contentEditable = "false";
  chip.setAttribute("contenteditable", "false");
  chip.draggable = true;
  chip.className = "mx-0.5 inline-flex cursor-grab select-none rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-800 align-baseline";
  chip.textContent = "[" + variable.label + "]";
  chip.title = "Kéo để di chuyển · " + variable.key;
  return chip;
}

export function renderVariableChips(html: string, variables: TemplateVariableConfig[]) {
  const root = document.createElement("div");
  root.innerHTML = html;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const text of nodes) {
    if (text.parentElement?.closest("script, style, " + CHIP_SELECTOR)) continue;
    const pattern = /{{\s*([a-zA-Z]+)\s*}}/g;
    const fragment = document.createDocumentFragment();
    let offset = 0;
    let matched = false;
    for (const match of text.data.matchAll(pattern)) {
      const variable = variables.find((item) => item.key === match[1]);
      if (!variable) continue;
      matched = true;
      fragment.append(text.data.slice(offset, match.index), createVariableChip(variable));
      offset = match.index! + match[0].length;
    }
    if (matched) {
      fragment.append(text.data.slice(offset));
      text.replaceWith(fragment);
    }
  }
  return root.innerHTML;
}

export function serializeVariableChips(editor: HTMLElement, variables: TemplateVariableConfig[]) {
  const copy = editor.cloneNode(true) as HTMLElement;
  copy.querySelectorAll<HTMLElement>(CHIP_SELECTOR).forEach((chip) => {
    const key = chip.dataset.celebrationVariable;
    if (variables.some((variable) => variable.key === key)) chip.replaceWith(document.createTextNode("{{" + key + "}}"));
    else chip.replaceWith(document.createTextNode(chip.textContent || ""));
  });
  return copy.innerHTML;
}

export function dropRangeAtPoint(editor: HTMLElement, x: number, y: number): Range | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const position = doc.caretPositionFromPoint?.(x, y);
  let range: Range | null = null;
  if (position) {
    range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
  } else range = doc.caretRangeFromPoint?.(x, y) || null;
  if (!range || !editor.contains(range.startContainer)) return null;
  const element = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
  const chip = element?.closest(CHIP_SELECTOR);
  if (chip) {
    const rect = chip.getBoundingClientRect();
    if (x < rect.left + rect.width / 2) range.setStartBefore(chip);
    else range.setStartAfter(chip);
  }
  range.collapse(true);
  return range;
}
