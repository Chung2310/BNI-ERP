import { useState } from "react";

export function SlideTransitionDelayInput({ value, onChange, disabled = false }: {
  value: number; onChange: (value: number) => void; disabled?: boolean;
}) {
  const [edit, setEdit] = useState<{ value: number; text: string } | null>(null);
  const draft = edit?.value === value ? edit.text : String(value);
  return <input aria-label="Số giây chờ chuyển slide sau khi hết giờ" type="number" inputMode="decimal" min={0} step="any"
    disabled={disabled} value={draft}
    className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-medium text-slate-700 shadow-2xs hover:border-slate-300 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    onChange={event => {
      const text = event.target.value;
      const next = Number(text);
      const valid = !!text.trim() && Number.isFinite(next) && next >= 0;
      setEdit({ value: valid ? next : value, text });
      if (valid) onChange(next);
    }}
    onBlur={() => setEdit(null)} />;
}
