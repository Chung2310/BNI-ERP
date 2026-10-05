import React, { useRef, useState } from "react";
import { Upload, ImagePlus, Loader2, X, RefreshCw } from "lucide-react";
import { authService } from "../../services/authService";
import { toast } from "../../pages/Toast";

interface MeetingCoverImageFieldProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export function MeetingCoverImageField({ value, onChange, disabled }: MeetingCoverImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleUploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn tệp tin hình ảnh hợp lệ (PNG, JPG, WEBP,...)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Kích thước hình ảnh tối đa là 10MB");
      return;
    }

    setUploading(true);
    try {
      const url = await authService.uploadFile(file, "igen_erp/meetings");
      onChange(url);
      toast.success("Đã tải ảnh bìa lên thành công!");
    } catch (error: any) {
      console.error("[MeetingCoverImageField] Upload error:", error);
      toast.error(error?.message || "Tải ảnh bìa thất bại.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      handleUploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !uploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUploadFile(file);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      <div className="flex items-center justify-between">
        <label className="block font-bold text-slate-700 text-xs">Ảnh bìa sự kiện</label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-600 hover:text-cyan-700 cursor-pointer disabled:opacity-50 transition"
        >
          {uploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Đang tải lên...</span>
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" />
              <span>Tải ảnh lên từ máy</span>
            </>
          )}
        </button>
      </div>

      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 group bg-slate-100 h-36 shadow-xs">
          <img
            src={value}
            alt="Ảnh bìa sự kiện"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              className="px-3 py-1.5 bg-white/95 hover:bg-white text-slate-800 rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5 transition cursor-pointer"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span>Đổi ảnh</span>
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={disabled || uploading}
              className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5 transition cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>Xóa</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition ${
            isDragging
              ? "border-cyan-500 bg-cyan-50/50"
              : "border-slate-200 bg-slate-50/50 hover:border-cyan-500 hover:bg-cyan-50/20"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="p-2.5 rounded-full bg-white shadow-xs text-slate-500 group-hover:text-cyan-600">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
            ) : (
              <ImagePlus className="h-5 w-5 text-cyan-600" />
            )}
          </div>
          <p className="text-xs font-semibold text-slate-700">
            {uploading ? "Đang tải ảnh lên hệ thống..." : "Nhấn để chọn ảnh hoặc kéo thả vào đây"}
          </p>
          <p className="text-[11px] text-slate-400">PNG, JPG, WEBP, GIF (tối đa 10MB)</p>
        </div>
      )}
    </div>
  );
}
