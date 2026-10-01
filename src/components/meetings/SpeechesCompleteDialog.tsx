import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function SpeechesCompleteMessage() {
  return <div className="space-y-6 text-center">
    <img src="/bni-logo.png" alt="BNI" className="mx-auto h-16 w-auto object-contain" />
    <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Các thành viên BNI đã hoàn tất bài phát biểu của mình</h2>
  </div>;
}

export function SpeechesCompleteDialog({ onClose }: { onClose: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    button.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === "Tab") { event.preventDefault(); button.current?.focus(); }
    };
    document.addEventListener("keydown", keydown, true);
    return () => { document.removeEventListener("keydown", keydown, true); previous?.focus(); };
  }, [onClose]);
  return createPortal(<div data-speeches-complete className="fixed inset-0 z-[11000] grid place-items-center bg-slate-950/60 p-6">
    <section role="dialog" aria-modal="true" aria-label="Hoàn tất phần phát biểu" className="w-full max-w-xl space-y-6 rounded-3xl bg-white p-8 shadow-2xl">
      <SpeechesCompleteMessage />
      <p className="text-center text-sm text-slate-500">Cuộc họp vẫn đang tiếp tục.</p>
      <button ref={button} type="button" onClick={onClose} className="w-full rounded-xl bg-red-700 px-5 py-3 font-bold text-white">Tiếp tục cuộc họp</button>
    </section>
  </div>, document.body);
}
