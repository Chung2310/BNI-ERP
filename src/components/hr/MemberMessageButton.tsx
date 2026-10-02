import React, { useRef, useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { internalChatService } from "../../services/internalChatService";
import { tabToPath } from "../../seo/seo-config";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";

export default function MemberMessageButton({ memberId, currentUserId, onOpened }: {
  memberId: string; currentUserId?: string; onOpened: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  if (!currentUserId || memberId === currentUserId) return null;
  const open = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try {
      const room = await internalChatService.createRoom({ isGroup: false, memberIds: [memberId] });
      const url = new URL(tabToPath("TRÒ CHUYỆN"), window.location.origin);
      url.searchParams.set("room", room._id);
      window.history.pushState(null, "", url.pathname + url.search);
      onOpened();
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể mở cuộc trò chuyện. Vui lòng thử lại."));
    } finally { pending.current = false; setBusy(false); }
  };
  return <button type="button" disabled={busy} onClick={() => void open()}
    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-cyan-800 disabled:opacity-50">
    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
    {busy ? "Đang mở..." : "Nhắn tin"}
  </button>;
}
