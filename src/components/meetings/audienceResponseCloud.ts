import type { MeetingInteractionState } from "../../services/meetingInteractionService";

export type CloudTerm = { key: string; text: string; count: number; firstIndex: number };
export type CloudPlacement = CloudTerm & {
  displayText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  vertical: boolean;
  colorIndex: number;
};

type Rect = { x: number; y: number; width: number; height: number };

export function buildResponseCloud(state: MeetingInteractionState): CloudTerm[] {
  const terms = new Map<string, CloudTerm>();
  state.responses.filter(response => response.status === "approved").forEach((response, firstIndex) => {
    const text = response.answer.trim().replace(/\s+/g, " ");
    const key = text.toLocaleLowerCase("vi");
    const current = terms.get(key);
    if (current) current.count += 1;
    else if (text) terms.set(key, { key, text, count: 1, firstIndex });
  });
  return [...terms.values()].sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex).slice(0, 60);
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

function overlaps(candidate: Rect, placed: Rect[], gap: number) {
  return placed.some(rect => candidate.x < rect.x + rect.width + gap && candidate.x + candidate.width + gap > rect.x && candidate.y < rect.y + rect.height + gap && candidate.y + candidate.height + gap > rect.y);
}

function displayLabel(text: string) {
  return text.length > 48 ? text.slice(0, 45).trimEnd() + "…" : text;
}

function attemptLayout(terms: CloudTerm[], width: number, height: number, scale: number): CloudPlacement[] {
  const maxCount = Math.max(1, ...terms.map(term => term.count));
  const shortestSide = Math.min(width, height);
  const minFont = Math.max(11, Math.min(22, shortestSide * 0.038)) * scale;
  const maxFont = Math.max(minFont * 2.2, Math.min(width * 0.115, height * 0.24)) * scale;
  const occupied: Rect[] = [];
  const placements: CloudPlacement[] = [];
  const gap = Math.max(2, shortestSide * 0.008 * scale);

  for (let index = 0; index < terms.length; index++) {
    const term = terms[index];
    const frequency = term.count / maxCount;
    const label = displayLabel(term.text);
    const lengthAdjustment = Math.min(1, Math.pow(24 / Math.max(10, label.length), 0.24));
    const fontSize = (minFont + Math.pow(frequency, 0.68) * (maxFont - minFont)) * lengthAdjustment;
    const vertical = index > 0 && label.length <= 22 && stableHash(term.key) % 5 === 0;
    const horizontalWidth = Math.max(fontSize * 1.3, label.length * fontSize * 0.54);
    const boxWidth = vertical ? fontSize * 1.08 : horizontalWidth;
    const boxHeight = vertical ? horizontalWidth : fontSize * 1.12;
    if (boxWidth > width * 0.96 || boxHeight > height * 0.96) continue;

    let selected: Rect | null = null;
    const phase = (stableHash(term.key) % 360) * Math.PI / 180;
    for (let step = 0; step < 2200; step++) {
      const angle = phase + step * 0.39;
      const radius = 1.85 * Math.sqrt(step) * Math.max(1, shortestSide / 250);
      const x = width / 2 + Math.cos(angle) * radius - boxWidth / 2;
      const y = height / 2 + Math.sin(angle) * radius * 0.72 - boxHeight / 2;
      const candidate = { x, y, width: boxWidth, height: boxHeight };
      if (x < 2 || y < 2 || x + boxWidth > width - 2 || y + boxHeight > height - 2) continue;
      if (!overlaps(candidate, occupied, gap)) { selected = candidate; break; }
    }
    if (!selected) continue;
    occupied.push(selected);
    placements.push({ ...term, displayText: label, ...selected, fontSize, vertical, colorIndex: stableHash(term.key) % 8 });
  }
  return placements;
}

function centerLayout(placements: CloudPlacement[], width: number, height: number): CloudPlacement[] {
  if (!placements.length) return placements;
  const left = Math.min(...placements.map(term => term.x));
  const top = Math.min(...placements.map(term => term.y));
  const right = Math.max(...placements.map(term => term.x + term.width));
  const bottom = Math.max(...placements.map(term => term.y + term.height));
  const offsetX = (width - (right - left)) / 2 - left;
  const offsetY = (height - (bottom - top)) / 2 - top;
  return placements.map(term => ({ ...term, x: term.x + offsetX, y: term.y + offsetY }));
}
export function layoutResponseCloud(terms: CloudTerm[], width: number, height: number): CloudPlacement[] {
  if (!terms.length || width <= 0 || height <= 0) return [];
  let best: CloudPlacement[] = [];
  for (let scale = 1; scale >= 0.34; scale -= 0.06) {
    const result = attemptLayout(terms, width, height, scale);
    if (result.length > best.length) best = result;
    if (result.length === terms.length) return centerLayout(result, width, height);
  }
  return best;
}