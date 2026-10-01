import React, { useEffect } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

type ConfirmDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  tone?: "danger" | "warning";
};

const toneStyles = {
  danger: {
    badge: "bg-rose-50 text-rose-600 ring-8 ring-rose-50/70",
    button: "bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20 focus:ring-rose-500",
  },
  warning: {
    badge: "bg-amber-50 text-amber-600 ring-8 ring-amber-50/70",
    button: "bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-600/20 focus:ring-amber-500",
  },
};

export function ConfirmDialog({
  cancelLabel = "Hủy",
  confirmLabel = "Xác nhận",
  description,
  isOpen,
  isSubmitting = false,
  onClose,
  onConfirm,
  title,
  tone = "danger",
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const styles = toneStyles[tone] || toneStyles.danger;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Centered Icon */}
        <div className="flex justify-center">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-transform ${styles.badge}`}>
            <AlertTriangle className="h-7 w-7" />
          </div>
        </div>

        {/* Content */}
        <div className="mt-4 text-center">
          <h3
            id="confirm-dialog-title"
            className="text-lg font-extrabold text-slate-900 tracking-tight"
          >
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 max-w-sm mx-auto">
            {description}
          </p>
        </div>

        {/* Action Buttons - Centered and Balanced */}
        <div className="mt-6 grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 py-2.5 px-4 text-xs font-bold transition shadow-2xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isSubmitting}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-bold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{isSubmitting ? "Đang xử lý..." : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
