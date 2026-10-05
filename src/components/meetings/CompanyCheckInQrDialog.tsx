import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { QrCode, X } from "lucide-react";
import { CompanyCheckInQrPanel, type CheckInQrApi } from "./CompanyCheckInQrPanel";

export function CompanyCheckInQrDialog({ api, companyCode, onClose }: {
  api: CheckInQrApi;
  companyCode?: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      id="company-checkin-qr"
      aria-labelledby="company-checkin-qr-title"
      aria-modal="true"
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/60 backdrop:backdrop-blur-xs"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-cyan-50 p-2 text-cyan-700"><QrCode className="h-5 w-5" aria-hidden="true" /></span>
            <h2 id="company-checkin-qr-title" className="text-lg font-bold">QR check-in chung</h2>
          </div>
          <button type="button" autoFocus onClick={onClose} aria-label="Đóng QR check-in chung" className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-cyan-600">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="overflow-y-auto p-3 sm:p-5">
          <CompanyCheckInQrPanel api={api} companyCode={companyCode} />
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
