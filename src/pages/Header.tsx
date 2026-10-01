/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useRef } from "react";
import {
  Bell, LogOut, Search, Settings, Wallet, Info, X, Image, Video, Volume2, FileText,
  Package, Megaphone, Sparkles, CheckCheck, ShoppingCart, AlertTriangle, Send, Sun, Moon,
  Briefcase, GraduationCap, LayoutGrid, LayoutDashboard, Users, MessageSquareShare,
  FolderOpen, MessageSquare, Shield, LineChart, Menu, FolderTree, Calendar, Clock, User,
  LogIn, LogOut as LogOutIcon, Handshake, BriefcaseBusiness, ChevronDown, Landmark, ContactRound, ExternalLink
} from "lucide-react";
import { TabType } from "../types";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { isTabHidden, filterEnabledTabs } from "../config/modules";
import { toast } from "./Toast";
import { notificationService, WebNotification } from "../services/notificationService";
import { socketService } from "../services/socketService";


interface HeaderProps {
  currentTab: TabType;
  onSearchSelect: (tab: TabType, subTab?: string) => void;
  onMenuClick?: () => void;
}

const searchIndex = [
  { label: "Tổng quan Doanh nghiệp", tab: "TỔNG QUAN" as TabType, keywords: "tong quan dashboard kpi hieu suat bieu do" },
  { label: "Sơ đồ tổ chức", tab: "NHÂN SỰ" as TabType, subTab: "SƠ ĐỒ TỔ CHỨC", keywords: "hr so do to chuc thanh vien doanh nghiep phong ban" },
  { label: "Email chúc mừng", tab: "NHÂN SỰ" as TabType, subTab: "EMAIL CHÚC MỪNG", keywords: "email chuc mung sinh nhat ky niem" },
  { label: "Quản lý tài nguyên", tab: "QUẢN LÝ TÀI NGUYÊN" as TabType, keywords: "tai lieu file drive upload tai nguyen" },
  { label: "Trò chuyện nội bộ", tab: "TRÒ CHUYỆN" as TabType, keywords: "chat tro chuyen tin nhan nhom" },
];

export default function Header({ currentTab, onSearchSelect, onMenuClick }: HeaderProps) {
  const { userProfile, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramLink, setTelegramLink] = useState<any>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [notifs, setNotifs] = useState<WebNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const loadTelegramLinkStatus = async () => {
    if (!userProfile) return;
    try {
      const data = await authService.getTelegramLinkStatus();
      setTelegramLink(data);
    } catch (error) {
      console.error("Lỗi lấy trạng thái Telegram:", error);
    }
  };

  // ─── helpers & API calls ────────────────────────────────────
  const fetchNotifications = async () => {
    if (!userProfile) return;
    try {
      const res = await notificationService.getNotifications({ limit: 20 });
      setNotifs(res.data);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      console.error("Lỗi khi tải thông báo từ API:", err);
    }
  };

  const formatNotifTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / (60 * 1000));
      if (diffMin < 1) return "Vừa xong";
      if (diffMin < 60) return `${diffMin} phút trước`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} giờ trước`;
      return d.toLocaleDateString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      });
    } catch {
      return "Vừa xong";
    }
  };

  const markRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifs(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Lỗi khi đánh dấu đã đọc thông báo:", err);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Lỗi khi đánh dấu đọc tất cả thông báo:", err);
    }
  };

  // Đồng bộ thông báo thời gian thực qua Socket.IO và sự kiện nội bộ
  useEffect(() => {
    if (!userProfile) return;

    fetchNotifications();

    // Lắng nghe thông báo mới từ socket
    const unsubSocket = socketService.on("new_notification", (notif: WebNotification) => {
      setNotifs((prev) => {
        // Tránh trùng lặp
        if (prev.some((n) => n._id === notif._id)) return prev;
        return [notif, ...prev];
      });
      if (!notif.read) {
        setUnreadCount((prev) => prev + 1);
      }
      // Kích hoạt CustomEvent để hiển thị popup nổi góc phải dưới
      window.dispatchEvent(new CustomEvent("new_notification_toast", { detail: notif }));
    });

    // Lắng nghe sự kiện đồng bộ từ các component khác
    const handleMutation = () => {
      fetchNotifications();
    };
    window.addEventListener("notification-mutation", handleMutation);

    return () => {
      unsubSocket();
      window.removeEventListener("notification-mutation", handleMutation);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid]);


  useEffect(() => {
    loadTelegramLinkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid]);

  useEffect(() => {
    if (!showTelegramModal || !userProfile) {
      return;
    }

    loadTelegramLinkStatus();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadTelegramLinkStatus();
      }
    };

    window.addEventListener("focus", loadTelegramLinkStatus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", loadTelegramLinkStatus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTelegramModal, userProfile?.uid]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredResults =
    normalizedQuery === ""
      ? []
      : searchIndex
        .filter((item) => {
          if (isTabHidden(item.tab)) {
            return false;
          }
          return true;
        })
        .filter(
          (item) =>
            item.label.toLowerCase().includes(normalizedQuery) ||
            item.keywords.toLowerCase().includes(normalizedQuery)
        );

  return (
    <>
      <header className="sticky top-0 z-40 flex h-18 min-w-0 items-center justify-between gap-2 border-b border-gray-100 bg-white px-3 shadow-xs sm:gap-4 sm:px-6" id="app_header">
        <div className="relative flex min-w-0 flex-1 items-center sm:max-w-2xl">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="mr-3 md:hidden p-2 rounded-xl text-gray-600 hover:bg-gray-50 active:scale-95 cursor-pointer shrink-0"
              title="Mở menu"
              id="header_menu_btn"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="relative hidden w-full sm:block" id="search_container">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm kiếm trong ERP..."
              className="block h-12 w-full rounded-full border border-gray-200 bg-white pl-12 pr-5 text-sm text-gray-900 shadow-[0_8px_24px_rgba(15,23,42,0.05)] outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              id="global_search_input"
            />

            {showResults && searchQuery.trim() !== "" && (
              <div className="absolute left-0 z-50 mt-3 w-full overflow-hidden rounded-2xl border border-gray-100 bg-white font-sans text-xs shadow-2xl">
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Kết quả tìm kiếm ({filteredResults.length})
                </div>
                {filteredResults.length > 0 ? (
                  <div className="max-h-72 overflow-y-auto">
                    {filteredResults.map((item, index) => (
                      <button
                        key={`${item.label}_${index}`}
                        onClick={() => {
                          onSearchSelect(item.tab, item.subTab);
                          setSearchQuery("");
                          setShowResults(false);
                        }}
                        className="flex w-full flex-col gap-1 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-blue-50/60"
                      >
                        <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                        <span className="text-[10px] text-gray-400">
                          {item.tab}
                          {item.subTab ? ` › ${item.subTab}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-5 text-center text-sm text-gray-500">Không tìm thấy phân mục phù hợp.</div>
                )}
              </div>
            )}
            {showResults && <div className="fixed inset-0 z-[-1]" onClick={() => setShowResults(false)} />}
          </div>
        </div>

        <div className="ml-1 flex shrink-0 items-center gap-1 sm:ml-6 sm:gap-2.5" id="header_controls">
          <a
            href="/wheel-of-names"
            target="_blank"
            rel="noopener noreferrer"
            title="Mở Vòng quay may mắn (Tab mới)"
            className="flex items-center gap-1.5 rounded-xl bg-linear-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 px-3 py-1.5 text-xs font-black shadow-xs shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-amber-300/80"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Vòng quay may mắn</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>

          <div className="relative" id="notification_dropdown_button">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-xl p-2.5 text-gray-600 transition-all hover:bg-gray-50 active:scale-95 hidden sm:block"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 font-mono text-[9px] font-bold text-white ring-2 ring-white animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="fixed inset-x-3 top-[4.75rem] z-50 max-h-[calc(100dvh-5.5rem)] overflow-hidden rounded-2xl border border-gray-100 bg-white font-sans shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-[calc(100vw-1.5rem)] sm:max-w-96">
                {/* Panel Header */}
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">Thông báo</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Xem tất cả
                  </button>
                </div>

                {/* Notification List */}
                <div className="max-h-[420px] divide-y divide-gray-50 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <Bell className="h-8 w-8 text-gray-200" />
                      <p className="text-sm font-medium text-gray-400">Không có thông báo</p>
                      <p className="text-xs text-gray-300">Mọi hoạt động sẽ xuất hiện tại đây</p>
                    </div>
                  ) : (
                    notifs.map((notif) => {
                      const ICON_MAP: Record<string, { icon: React.ElementType; bg: string; iconColor: string; badge: string }> = {
                        kho: { icon: Package, bg: "bg-amber-50", iconColor: "text-amber-600", badge: "bg-amber-500" },
                        task: { icon: Briefcase, bg: "bg-blue-50", iconColor: "text-blue-600", badge: "bg-blue-500" },
                        training: { icon: GraduationCap, bg: "bg-purple-50", iconColor: "text-purple-600", badge: "bg-purple-500" },
                        "he-thong": { icon: Bell, bg: "bg-gray-100", iconColor: "text-gray-500", badge: "bg-gray-400" },
                      };
                      const cfg = ICON_MAP[notif.type] || ICON_MAP["he-thong"];
                      const Icon = cfg.icon;
                      return (
                        <div
                          key={notif._id}
                          onClick={() => {
                            markRead(notif._id);
                            if (notif.action) {
                              onSearchSelect(notif.action.tab as any, notif.action.subTab);
                              setShowNotifications(false);
                            }
                          }}
                          className={`flex cursor-pointer items-start gap-3 p-4 transition-all duration-300 hover:bg-gray-50/80 ${notif.read ? "opacity-40" : ""
                            }`}
                        >
                          {/* Icon badge */}
                          <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
                            <Icon className={`h-5 w-5 ${cfg.iconColor}`} />
                            {!notif.read && (
                              <span className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ${cfg.badge} ring-2 ring-white`} />
                            )}
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs leading-snug ${notif.read ? "font-medium text-gray-500" : "font-bold text-gray-800"
                              }`}>{notif.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-gray-400">{notif.body}</p>
                            <span className="mt-1 block font-mono text-[10px] text-gray-300">{formatNotifTime(notif.createdAt)}</span>
                          </div>

                          {/* Unread dot */}
                          {!notif.read && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-2.5 text-center">
                  <p className="text-[10px] font-medium text-gray-400">
                    {unreadCount === 0 ? "✔ Tất cả đã được đọc" : `${unreadCount} thông báo chưa đọc`}
                  </p>
                </div>
              </div>
            )}
            {showNotifications && <div className="fixed inset-0 z-[-1]" onClick={() => setShowNotifications(false)} />}
          </div>

          <div className="relative" id="user_profile_container">
            <div
              className="flex cursor-pointer select-none items-center gap-3 border-l border-gray-200 pl-4 transition-transform active:scale-98"
              id="user_profile_box"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <div className="hidden text-right lg:block">
                <p className="text-sm font-semibold text-gray-800 transition-colors hover:text-blue-600">
                  {userProfile ? userProfile.displayName : "iGen Administrator"}
                </p>
              </div>
              {userProfile?.photoURL && (userProfile.photoURL.startsWith("http") || userProfile.photoURL.startsWith("/")) ? (
                <img
                  src={userProfile.photoURL}
                  alt={userProfile.displayName}
                  className="h-9 w-9 rounded-full border border-gray-200 object-cover shadow-md ring-2 ring-blue-50 transition-all hover:ring-blue-100"
                />
              ) : (
                <div className="flex h-9 w-9 select-none items-center justify-center rounded-full bg-blue-600 text-sm font-bold tracking-wide text-white shadow-md ring-2 ring-blue-50 transition-all hover:ring-blue-100">
                  {userProfile ? userProfile.displayName.slice(0, 2).toUpperCase() : "AD"}
                </div>
              )}
            </div>

            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 z-50 mt-3 w-56 rounded-2xl border border-gray-100 bg-white/95 py-2 font-sans shadow-2xl backdrop-blur-md">
                  <div className="border-b border-gray-100 px-4 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tài khoản</p>
                    <p className="mt-0.5 truncate text-sm font-bold text-gray-800">{userProfile?.displayName}</p>
                    <p className="truncate text-xs text-gray-500">{userProfile?.email}</p>
                    {userProfile?.role && (
                      <span className="mt-1 inline-block rounded-md border border-blue-100 bg-blue-50 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase text-blue-600">
                        {userProfile.role}
                      </span>
                    )}
                  </div>
                  <div className="p-1">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowNotifications(true);
                      }}
                      className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-gray-700 transition-colors hover:bg-blue-50/80 sm:hidden"
                    >
                      <Bell className="h-4 w-4 text-blue-500" />
                      <span className="flex-1">Thông báo</span>
                      {unreadCount > 0 && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
                    </button>

                  <button
                      onClick={() => {
                        onSearchSelect("CÀI ĐẶT" as TabType);
                        setShowProfileMenu(false);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-gray-700 transition-colors hover:bg-blue-50/80"
                    >
                      <Settings className="h-4 w-4 text-gray-500" />
                      <span>Cài đặt cá nhân</span>
                    </button>
                    <button
                      onClick={async () => {
                        setShowProfileMenu(false);
                        await logout();
                      }}
                      className="mt-1 flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-t border-gray-50 px-3 py-2 pt-2 text-left text-xs font-semibold text-red-600 transition-colors hover:bg-red-50/80"
                    >
                      <LogOut className="h-4 w-4 text-red-500" />
                      <span>Đăng xuất hệ thống</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>


        {showTelegramModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" onClick={() => setShowTelegramModal(false)}>
            <div className="relative w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-5 shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowTelegramModal(false)}
                className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-4">
                <div className="mb-2 inline-flex rounded-2xl bg-sky-50 p-2 text-sky-600">
                  <Send className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Liên kết Telegram</h3>
                <p className="mt-1 text-xs text-gray-500">Chỉ dùng link liên kết từ web, không dùng đăng nhập Telegram nữa.</p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-gray-600">Trạng thái</span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${telegramLink?.linked ? "bg-emerald-100 text-emerald-700" : "border border-gray-200 bg-white text-gray-500"}`}>
                    {telegramLink?.linked ? "Đã liên kết" : "Chưa liên kết"}
                  </span>
                </div>
                {telegramLink?.linked && (
                  <p className="mt-2 text-[11px] text-gray-500">Telegram đã được liên kết với tài khoản này.</p>
                )}
                {!telegramLink?.linked && telegramLink?.pendingCode && (
                  <p className="mt-2 text-[11px] text-gray-500">Web sẽ tự cập nhật ngay sau khi bạn liên kết xong trên Telegram.</p>
                )}
              </div>

              {!telegramLink?.linked && (
                <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                  <p className="text-[11px] font-semibold text-sky-700">1. Mở bot</p>
                  <a
                    href={`https://t.me/${telegramLink?.botUsername || "iGEN_ERP_Bot"}?start=${encodeURIComponent(telegramLink?.pendingCode || "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm font-bold text-sky-800 underline decoration-sky-300 underline-offset-4"
                  >
                    Mở @{telegramLink?.botUsername || "iGEN_ERP_Bot"}
                  </a>
                  <p className="mt-3 text-[11px] font-semibold text-sky-700">2. Mã dự phòng</p>
                  <div className="mt-1 rounded-xl bg-white px-3 py-2 font-mono text-sm font-bold text-gray-900">
                    /link {telegramLink?.pendingCode || "......"}
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500">Thông thường chỉ cần bấm link mở bot ở trên. Lệnh này chỉ là phương án dự phòng.</p>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                {!telegramLink?.linked && (
                  <button
                    onClick={async () => {
                      try {
                        setTelegramLoading(true);
                        const data = await authService.createTelegramLinkCode();
                        setTelegramLink(data);
                        toast.success("Đã tạo mã liên kết Telegram.");
                      } catch (error: any) {
                        toast.error(error.message || "Không thể tạo mã liên kết Telegram.");
                      } finally {
                        setTelegramLoading(false);
                      }
                    }}
                    className="flex-1 rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={telegramLoading}
                  >
                    {telegramLoading ? "Đang tạo..." : telegramLink?.pendingCode ? "Tạo lại mã" : "Tạo mã"}
                  </button>
                )}

                {telegramLink?.linked && (
                  <button
                    onClick={async () => {
                      try {
                        setTelegramLoading(true);
                        const data = await authService.unlinkTelegram();
                        setTelegramLink(data);
                        toast.success("Đã gỡ liên kết Telegram và tạo sẵn mã liên kết mới.");
                      } catch (error: any) {
                        toast.error(error.message || "Không thể gỡ liên kết Telegram.");
                      } finally {
                        setTelegramLoading(false);
                      }
                    }}
                    className="flex-1 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={telegramLoading}
                  >
                    {telegramLoading ? "Đang xử lý..." : "Gỡ liên kết"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
