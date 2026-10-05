import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Minimize2 } from "lucide-react";

export function CheckInQrFullscreen({ image, fullscreenRequest, onClose }: {
  image: string;
  fullscreenRequest: Promise<boolean>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    mounted.current = true;
    let ownsFullscreen = false;
    const exitFullscreen = () => {
      if (document.fullscreenElement === document.documentElement) {
        void document.exitFullscreen?.().catch(() => {});
      }
    };
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("button")?.focus();
    document.body.style.overflow = "hidden";
    void fullscreenRequest.then(entered => {
      ownsFullscreen = entered;
      if (!mounted.current && entered) exitFullscreen();
    });
    const onFullscreenChange = () => {
      if (ownsFullscreen && !document.fullscreenElement) onClose();
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      mounted.current = false;
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (ownsFullscreen) exitFullscreen();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [fullscreenRequest, onClose]);

  return createPortal(
    <dialog ref={dialogRef} aria-label="Mã QR check-in toàn màn hình" aria-modal="true"
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-white p-4 text-slate-900 sm:p-6"
      onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
      <div className="flex h-full min-h-0 flex-col gap-4">
        <header className="flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-lg font-semibold sm:text-2xl">Check-in cuộc họp</h2>
          <button type="button" onClick={onClose} aria-label="Thu nhỏ mã QR"
            className="flex items-center gap-2 rounded-xl bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-100 focus-visible:outline-2 focus-visible:outline-cyan-600">
            <Minimize2 className="h-5 w-5" aria-hidden="true" />Thu nhỏ
          </button>
        </header>
        <div className="min-h-0 flex-1">
          <img src={image} alt="Mã QR check-in phóng to" className="h-full w-full object-contain" style={{ imageRendering: "pixelated" }} />
        </div>
        <p className="shrink-0 text-center text-sm text-slate-600 sm:text-lg">Sử dụng Zalo để quét mã</p>
      </div>
    </dialog>,
    document.fullscreenElement && document.fullscreenElement !== document.documentElement ? document.fullscreenElement : document.body,
  );
}
