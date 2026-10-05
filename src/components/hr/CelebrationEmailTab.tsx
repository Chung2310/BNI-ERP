import TemplateVariablePalette, { TEMPLATE_VARIABLE_MIME } from "../template-editor/TemplateVariablePalette";
import { CHIP_SELECTOR, createVariableChip, renderVariableChips, serializeVariableChips, dropRangeAtPoint } from "./celebrationEditorTokens";
import { getVietnameseHolidays, resolveCelebrationHolidays } from "../../utils/vietnameseHolidays";
import React from "react";
import { Mail, Cake, CalendarDays, Clock, Settings2, Eye, Loader2, Save, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Image as ImageIcon, X } from "lucide-react";
import { companyEmailApi } from "../../services/companyEmailService";
import { toast } from "../../pages/Toast";
import { authService } from "../../services/authService";
import type { TemplateVariableConfig } from "../template-editor/templateEditorTypes";
import { toFriendlyTokens } from "../template-editor/templateTokenCodec";
import { HR_BIRTHDAY_TEMPLATE_VARIABLES, HR_HOLIDAY_TEMPLATE_VARIABLES } from "./hrCelebrationVariableRegistry";

export function RichTextEditor({
  value,
  onChange,
  onUpload,
  variables,
  label,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onUpload?: (token: string) => void;
  variables: TemplateVariableConfig[];
}) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editorRef.current && serializeVariableChips(editorRef.current, variables) !== value) {
      editorRef.current.innerHTML = renderVariableChips(value || "", variables);
    }
  }, [value, variables]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(serializeVariableChips(editorRef.current, variables));
    }
  };

  const execCmd = (command: string, arg: string = "") => {
    document.execCommand(command, false, arg);
    handleInput();
  };


  const savedRangeRef = React.useRef<Range | null>(null);
  const draggedChipRef = React.useRef<HTMLElement | null>(null);
  const [draggingOver, setDraggingOver] = React.useState(false);

  const rememberCaret = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const insertVariable = (key: string, dropRange?: Range | null, moving?: HTMLElement | null) => {
    const editor = editorRef.current;
    const variable = variables.find((item) => item.key === key);
    if (!editor || !variable) return;
    let range = dropRange || savedRangeRef.current;
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    const chip = moving && editor.contains(moving) ? moving : createVariableChip(variable);
    range.deleteContents();
    range.insertNode(chip);
    range.setStartAfter(chip);
    range.collapse(true);
    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    savedRangeRef.current = range.cloneRange();
    handleInput();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setDraggingOver(false);
    const key = event.dataTransfer.getData(TEMPLATE_VARIABLE_MIME);
    if (!key) return;
    event.preventDefault();
    if (!variables.some((variable) => variable.key === key)) return;
    const editor = editorRef.current!;
    const range = dropRangeAtPoint(editor, event.clientX, event.clientY);
    // If dropped on editor padding or a browser has no point-to-caret API, append safely.
    const fallback = document.createRange();
    fallback.selectNodeContents(editor);
    fallback.collapse(false);
    insertVariable(key, range || fallback, draggedChipRef.current);
    draggedChipRef.current = null;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await authService.uploadManagedFile(file, "hr.celebration");
      editorRef.current?.focus();
      execCmd("insertHTML", `<img src="${uploaded.url}" class="max-w-full my-2 rounded-lg" style="max-height: 250px; object-fit: contain;" />`);
      onUpload?.(uploaded.uploadToken);
      toast.success("Đã chèn hình ảnh.");
    } catch (err) {
      toast.error(err.message || "Tải hình ảnh thất bại");
    }
  };

  return (
    <div className="border border-slate-200 bg-white rounded-lg overflow-hidden flex flex-col">
      <div onMouseDown={(event) => event.preventDefault()} className="flex flex-wrap items-center gap-1 bg-slate-50 border-b border-slate-200 p-1.5 text-slate-600 select-none">
        <button
          type="button"
          onClick={() => execCmd("bold")}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-700"
          title="In đậm"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd("italic")}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-700"
          title="In nghiêng"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd("underline")}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-700"
          title="Gạch chân"
        >
          <Underline className="h-3.5 w-3.5" />
        </button>
        <div className="h-4 w-px bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={() => execCmd("justifyLeft")}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-700"
          title="Căn lề trái"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd("justifyCenter")}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-700"
          title="Căn giữa"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd("justifyRight")}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-700"
          title="Căn lề phải"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </button>
        <div className="h-4 w-px bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-700 flex items-center gap-0.5"
          title="Chèn ảnh"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <div className="h-4 w-px bg-slate-200 mx-1" />

      </div>
      <TemplateVariablePalette variables={variables} disabled={false} activeTarget="html" onInsert={insertVariable} />
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        onInput={handleInput}
        onMouseUp={rememberCaret}
        onKeyUp={rememberCaret}
        onBlur={rememberCaret}
        onDragStart={(event) => {
          const chip = (event.target as HTMLElement).closest<HTMLElement>(CHIP_SELECTOR);
          if (!chip) return;
          draggedChipRef.current = chip;
          event.dataTransfer.setData(TEMPLATE_VARIABLE_MIME, chip.dataset.celebrationVariable!);
          event.dataTransfer.effectAllowed = "copyMove";
        }}
        onDragEnd={() => { draggedChipRef.current = null; setDraggingOver(false); }}
        onDragOver={(event) => {
          if (Array.from(event.dataTransfer.types).includes(TEMPLATE_VARIABLE_MIME)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = draggedChipRef.current ? "move" : "copy";
            setDraggingOver(true);
          }
        }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingOver(false); }}
        onDrop={handleDrop}
        style={draggingOver ? { boxShadow: "inset 0 0 0 2px #06b6d4", backgroundColor: "#ecfeff" } : undefined}
        className="min-h-[220px] max-h-[380px] overflow-y-auto p-4 text-sm outline-none leading-relaxed prose prose-sm max-w-none bg-white"
        {...({ placeholder: "Nhập nội dung thư chúc mừng..." })}
      />
    </div>
  );
}

const defaults = {
  birthdayEnabled: false,
  holidayEnabled: false,
  vietnameseHolidaysEnabled: true,
  disabledVietnameseHolidays: [],
  sendTime: "08:00",
  birthdayTemplate: {
    subject: "Chúc mừng sinh nhật {{employeeName}}",
    html: "<p>Chúc mừng sinh nhật {{employeeName}}!</p>",
  },
  holidayTemplate: {
    subject: "Chúc mừng {{holidayName}}",
    html: "<p>{{companyName}} kính chúc bạn một kỳ nghỉ vui vẻ.</p>",
  },
  holidayOverrides: [],
};

export default function CelebrationEmailTab() {
  const currentVietnamYear = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()));
  const [holidayYear, setHolidayYear] = React.useState(currentVietnamYear);
  const automaticHolidays = React.useMemo(() => getVietnameseHolidays(holidayYear), [holidayYear]);
  const [config, setConfig] = React.useState<import("../../services/companyEmailService").CelebrationConfig>(defaults);
  const [history, setHistory] = React.useState<import("../../services/companyEmailService").CelebrationHistory[]>([]);
  const [savedConfig, setSavedConfig] = React.useState("");
  const [loadError, setLoadError] = React.useState("");
  const [historyFilter, setHistoryFilter] = React.useState("all");
  const [loaded, setLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [holidaySettingsOpen, setHolidaySettingsOpen] = React.useState(false);
  const [newHoliday, setNewHoliday] = React.useState<{ name: string; date: string; enabled: boolean } | null>(null);
  const [newHolidayError, setNewHolidayError] = React.useState("");
  const newHolidayDialogRef = React.useRef<HTMLElement>(null);
  const busyRef = React.useRef(busy);
  React.useLayoutEffect(() => { busyRef.current = busy; }, [busy]);
  const holidayDialogRef = React.useRef<HTMLElement>(null);
  const previewDialogRef = React.useRef<HTMLDivElement>(null);
  const [preview, setPreview] = React.useState<import("../../services/companyEmailService").CelebrationPreview | null>(null);
  const [uploadTokens, setUploadTokens] = React.useState<string[]>([]);

  const hasChanges = loaded && (JSON.stringify(config) !== savedConfig || uploadTokens.length > 0);
  const scheduledHolidays = React.useMemo(() => resolveCelebrationHolidays(currentVietnamYear, config), [currentVietnamYear, config]);
  const vietnamToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const nextHoliday = [...scheduledHolidays, ...resolveCelebrationHolidays(currentVietnamYear + 1, config)].find((holiday) => holiday.date >= vietnamToday);
  const visibleHistory = history.filter((row) => historyFilter === "all" || row.status === historyFilter);

  const load = React.useCallback(
    () =>
      Promise.all([companyEmailApi.getCelebration(), companyEmailApi.history()])
        .then(([c, h]) => {
          const nextConfig = { ...defaults, ...(c || {}), holidayOverrides: c?.holidayOverrides || [] };
          setConfig(nextConfig);
          setSavedConfig(JSON.stringify(nextConfig));
          setLoadError("");
          setLoaded(true);
          setHistory(h);
        })
        .catch((e) => { setLoadError(e.message); toast.error(e.message); }),
    [],
  );

  React.useEffect(() => {
    void load();
  }, [load]);


  React.useEffect(() => {
    if (!holidaySettingsOpen && !preview && !newHoliday) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = preview ? previewDialogRef.current : newHoliday ? newHolidayDialogRef.current : holidayDialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (preview) setPreview(null);
        else if (newHoliday) setNewHoliday(null);
        else if (!busyRef.current) setHolidaySettingsOpen(false);
      }
      if (event.key === "Tab") {
        const elements = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]') || []);
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [holidaySettingsOpen, !!preview, !!newHoliday]);

  const template = (key: "birthdayTemplate" | "holidayTemplate", field: "subject" | "html", value: string) =>
    setConfig((c) => ({ ...c, [key]: { ...c[key], [field]: value } }));


  const addHoliday = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newHoliday) return;
    if (!newHoliday.name.trim() || !newHoliday.date) {
      setNewHolidayError("Vui lòng nhập tên và ngày gửi.");
      return;
    }
    const parsed = new Date(newHoliday.date + "T00:00:00Z");
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== newHoliday.date) {
      setNewHolidayError("Ngày gửi không hợp lệ.");
      return;
    }
    if (config.holidayOverrides.some((holiday) => holiday.date === newHoliday.date)) {
      setNewHolidayError("Đã có ngày lễ bổ sung vào ngày này. Vui lòng sửa ngày lễ hiện có hoặc chọn ngày khác.");
      return;
    }
    setConfig((current) => ({ ...current, holidayOverrides: [...current.holidayOverrides, { ...newHoliday, name: newHoliday.name.trim() }] }));
    setNewHoliday(null);
  };

  const save = async () => {
    const holidays = config.holidayOverrides || [];
    const dates = new Set<string>();
    for (const holiday of holidays) {
      if (!holiday.name?.trim() || !holiday.date) {
        toast.error("Vui lòng nhập tên và ngày gửi cho từng ngày lễ.");
        return;
      }
      if (dates.has(holiday.date)) {
        toast.error("Mỗi ngày chỉ cấu hình một email chúc mừng ngày lễ.");
        return;
      }
      dates.add(holiday.date);
    }
    if (config.holidayEnabled && !resolveCelebrationHolidays(holidayYear, config).length && !holidays.some((holiday) => holiday.enabled)) {
      toast.error("Hãy thêm và bật ít nhất một ngày lễ để tự động gửi.");
      return;
    }
    setBusy(true);
    try {
      await companyEmailApi.saveCelebration({ ...config, uploadTokens });
      setSavedConfig(JSON.stringify(config));
      setUploadTokens([]);
      setHolidaySettingsOpen(false);
      toast.success("Đã lưu cấu hình email chúc mừng.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const showPreview = async (value: import("../../services/companyEmailService").CelebrationPreview) => {
    try {
      setPreview(await companyEmailApi.preview(value));
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6" inert={holidaySettingsOpen || !!preview} aria-hidden={holidaySettingsOpen || preview ? true : undefined}>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700"><Mail className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Email chúc mừng</h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span role="status" className={"text-xs font-semibold " + (hasChanges ? "text-amber-700" : "text-slate-500")}>
              {!loaded ? "Chưa tải xong cấu hình" : busy ? "Đang lưu..." : hasChanges ? "Có thay đổi chưa lưu" : "Đã đồng bộ cấu hình"}
            </span>
            <button type="button" onClick={save} disabled={busy || !loaded}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Lưu cấu hình
            </button>
          </div>
        </div>
        {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span>Không tải được cấu hình: {loadError}</span>
          <button type="button" onClick={() => void load()} className="rounded-lg border border-rose-200 bg-white px-3 py-2 font-semibold">Thử lại</button>
        </div>}

        <section aria-labelledby="sending-schedule-title" className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-800">1</span>
            <div>
              <h3 id="sending-schedule-title" className="font-bold text-slate-800">Chọn lịch gửi</h3>
              <p className="text-xs text-slate-500">Các thay đổi chỉ có hiệu lực sau khi lưu. Email sử dụng cấu hình SMTP của công ty.</p>
            </div>
          </div>
          <fieldset disabled={!loaded || busy} className="grid min-w-0 gap-4 lg:grid-cols-3">
            <div className={"rounded-2xl border bg-white p-5 " + (config.birthdayEnabled ? "border-cyan-200" : "border-slate-200")}>
              <div className="mb-4 flex items-center justify-between"><Cake className="h-5 w-5 text-pink-500" /><span className={"rounded-full px-2 py-1 text-xs font-semibold " + (config.birthdayEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{config.birthdayEnabled ? "Đã bật" : "Đang tắt"}</span></div>
              <Toggle label="Tự động sinh nhật" checked={config.birthdayEnabled} onChange={(value: boolean) => setConfig((current) => ({ ...current, birthdayEnabled: value }))} />
              <p className="mt-3 text-sm leading-relaxed text-slate-500">Gửi lời chúc vào ngày sinh nhật theo hồ sơ của từng thành viên.</p>
            </div>
            <div className={"rounded-2xl border bg-white p-5 " + (config.holidayEnabled ? "border-cyan-200" : "border-slate-200")}>
              <div className="mb-4 flex items-center justify-between"><CalendarDays className="h-5 w-5 text-cyan-600" /><span className={"rounded-full px-2 py-1 text-xs font-semibold " + (config.holidayEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{config.holidayEnabled ? "Đã bật" : "Đang tắt"}</span></div>
              <Toggle label="Tự động lễ/Tết" checked={config.holidayEnabled} onChange={(value: boolean) => setConfig((current) => ({ ...current, holidayEnabled: value }))} />
              <p className="mt-3 text-sm text-slate-500">{scheduledHolidays.length} ngày được chọn trong năm {currentVietnamYear}.</p>
              <button type="button" disabled={!loaded || busy} onClick={() => setHolidaySettingsOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800 hover:bg-cyan-100 disabled:opacity-40">
                <Settings2 className="h-4 w-4" />Cấu hình ngày lễ
              </button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <Clock className="mb-4 h-5 w-5 text-amber-500" />
              <label className="block text-sm font-semibold text-slate-700">Giờ gửi tự động
                <input type="time" value={config.sendTime} onChange={(event) => setConfig((current) => ({ ...current, sendTime: event.target.value }))}
                  className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
              </label>
              <p className="mt-2 text-xs text-slate-500">Giờ Việt Nam (UTC+7), áp dụng cho cả hai loại email.</p>
              {config.holidayEnabled && nextHoliday && <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600">Ngày lễ sắp tới theo cấu hình: <strong>{nextHoliday.name}</strong> · {nextHoliday.date.split("-").reverse().join("/")}</p>}
            </div>
          </fieldset>
        </section>
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-800">2</span>
          <div><h3 className="font-bold text-slate-800">Soạn nội dung email</h3><p className="text-xs text-slate-500">Chỉnh mẫu tương ứng và xem trước nội dung trước khi lưu.</p></div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Template
            title="Mẫu thư chúc mừng sinh nhật"
            value={config.birthdayTemplate}
            variables={HR_BIRTHDAY_TEMPLATE_VARIABLES}
            onChange={(f, v: string) => template("birthdayTemplate", f, v)}
            onPreview={() => showPreview(config.birthdayTemplate)}
            onUpload={(token: string) => setUploadTokens((current) => [...current, token])}
          />
          <Template
            title="Mẫu thư chúc mừng lễ/Tết"
            value={config.holidayTemplate}
            variables={HR_HOLIDAY_TEMPLATE_VARIABLES}
            onChange={(f, v: string) => template("holidayTemplate", f, v)}
            onPreview={() => showPreview({ ...config.holidayTemplate, holidayName: "Ngày lễ" })}
            onUpload={(token: string) => setUploadTokens((current) => [...current, token])}
          />
        </div>



        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600">Trạng thái gửi
              <select value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <option value="all">Tất cả</option><option value="sent">Đã gửi</option><option value="failed">Gửi thất bại</option><option value="sending">Đang gửi</option>
              </select>
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 font-bold">
                  <th className="py-2.5">Nhân sự nhận</th>
                  <th>Phân loại</th>
                  <th>Ngày thực hiện</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visibleHistory.map((row) => (
                  <tr key={row._id} className="text-slate-650 hover:bg-slate-50/50">
                    <td className="py-2.5 font-medium">{row.recipientEmail}</td>
                    <td className="capitalize">{row.eventType === "birthday" ? "Sinh nhật" : "Ngày lễ"}</td>
                    <td>{row.eventDate?.split("-").reverse().join("/")}</td>
                    <td>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${row.status === "sent"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-250"
                          : row.status === "failed" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                      >
                        {row.status === "sent" ? "Đã gửi" : row.status === "failed" ? "Gửi thất bại" : row.status === "sending" ? "Đang gửi" : "Chờ gửi"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!visibleHistory.length && <tr><td colSpan={4} className="py-10 text-center text-sm text-slate-500">{!loaded ? "Đang tải lịch sử..." : history.length ? "Không có email ở trạng thái này." : "Chưa có email được gửi. Lịch sử sẽ xuất hiện sau lần gửi đầu tiên."}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {holidaySettingsOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-6" inert={!!preview || !!newHoliday} aria-hidden={preview || newHoliday ? true : undefined}
          onClick={(event) => { if (event.target === event.currentTarget && !busy) setHolidaySettingsOpen(false); }}>
          <section ref={holidayDialogRef} role="dialog" aria-modal="true" aria-labelledby="holiday-settings-title" tabIndex={-1} className="max-h-[90dvh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-4 space-y-4 shadow-2xl sm:p-6">
            <div className="flex items-center justify-end">
              <button type="button" disabled={busy} onClick={() => setHolidaySettingsOpen(false)} aria-label="Đóng cấu hình ngày lễ" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 id="holiday-settings-title" className="text-sm font-bold text-slate-800">Cấu hình ngày lễ</h3>
                <p className="mt-1 text-xs text-slate-500">Ngày lễ Việt Nam được tính sẵn theo năm, gồm cả âm lịch. Có thể bổ sung ngày riêng; cấu hình riêng được ưu tiên khi trùng ngày. Mỗi ngày gửi tối đa một email lễ/Tết cho mỗi thành viên.</p>
                <p className="mt-1 text-xs text-slate-500">Gửi lúc {config.sendTime} (giờ Việt Nam) khi bật “Tự động lễ/Tết”, ngày lễ được bật và SMTP đã được cấu hình. Dùng mẫu thư lễ/Tết trên trang email; tên ngày lễ được điền tự động.</p>
              </div>
              <button type="button" disabled={!loaded || busy}
                onClick={() => { setNewHolidayError(""); setNewHoliday({ name: "", date: "", enabled: true }); }}
                className="rounded-lg bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100 disabled:opacity-40">Thêm ngày lễ</button>
            </div>

            <div className="space-y-3 rounded-xl border border-cyan-100 bg-cyan-50/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Toggle label="Tự động lấy ngày lễ Việt Nam" checked={config.vietnameseHolidaysEnabled}
                  onChange={(value: boolean) => setConfig((current) => ({ ...current, vietnameseHolidaysEnabled: value }))} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">Năm xem lịch
                  <select value={holidayYear} onChange={(event) => setHolidayYear(Number(event.target.value))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    {Array.from({ length: 7 }, (_, index) => currentVietnamYear - 1 + index).map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </label>
              </div>
              <p className="text-xs text-slate-500">Lịch lễ và các dịp kỷ niệm phổ biến tự cập nhật hằng năm. Tết gửi vào mùng 1; không gửi thêm vào ngày nghỉ bù. Bật/tắt từng dịp áp dụng cho các năm sau.</p>
              <div className="grid gap-3 md:grid-cols-2">
                {automaticHolidays.map((holiday) => {
                  const enabled = !config.disabledVietnameseHolidays.includes(holiday.id);
                  const custom = config.holidayOverrides.find((item) => item.date === holiday.date);
                  return (
                    <div key={holiday.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3">
                      <label className="flex min-w-0 items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-1" checked={enabled} disabled={!loaded || busy || !config.vietnameseHolidaysEnabled}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setConfig((current) => ({
                              ...current,
                              disabledVietnameseHolidays: checked
                                ? current.disabledVietnameseHolidays.filter((id: string) => id !== holiday.id)
                                : [...current.disabledVietnameseHolidays, holiday.id],
                            }));
                          }} />
                        <span>
                          <span className="block font-semibold text-slate-700">{holiday.name}</span>
                          <span className="block text-xs text-slate-500">{holiday.date.split("-").reverse().join("/")}
                            {holiday.lunar ? " · " + holiday.day + "/" + holiday.month + " âm lịch" : ""}
                          </span>
                          {custom && <span className="block text-xs text-amber-700">Dùng cấu hình riêng: {custom.name || "Ngày lễ"}{custom.enabled ? "" : " (đã tắt)"}</span>}
                        </span>
                      </label>
                      <button type="button" aria-label={"Xem trước " + holiday.name}
                        onClick={() => showPreview({ subject: custom?.subject || config.holidayTemplate.subject, html: custom?.html || config.holidayTemplate.html, holidayName: custom?.name || holiday.name })}
                        className="rounded-lg p-2 text-cyan-700 hover:bg-cyan-50"><Eye className="h-4 w-4" /></button>
                    </div>
                  );
                })}
              </div>
            </div>
            <h4 className="text-sm font-semibold text-slate-700">Ngày lễ bổ sung</h4>
            {!config.holidayOverrides.length && <p className="text-sm text-slate-500">Chưa có ngày lễ bổ sung. Lịch Việt Nam ở trên vẫn được áp dụng khi bật.</p>}
            {config.holidayOverrides.map((holiday, index: number) => {
              const update = (field: string, value: string | boolean) => setConfig((current) => ({
                ...current, holidayOverrides: current.holidayOverrides.map((item, i: number) => i === index ? { ...item, [field]: value } : item),
              }));
              return (
                <fieldset key={index} disabled={busy} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <legend className="text-xs font-semibold text-slate-500">Ngày lễ {index + 1}</legend>
                  <label className="min-w-0 flex-1 text-xs font-semibold text-slate-600">Tên ngày lễ
                    <input value={holiday.name || ""} maxLength={150} onChange={(e) => update("name", e.target.value)} placeholder="Ví dụ: Quốc khánh"
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">Ngày gửi
                    <input type="date" value={holiday.date} onChange={(e) => update("date", e.target.value)}
                      className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2" />
                  </label>
                  <div className="py-2"><Toggle label="Bật gửi ngày lễ" checked={holiday.enabled} onChange={(value: boolean) => update("enabled", value)} /></div>
                  <button type="button" onClick={() => showPreview({ subject: holiday.subject || config.holidayTemplate.subject, html: holiday.html || config.holidayTemplate.html, holidayName: holiday.name || "Ngày lễ" })}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">Xem trước ngày lễ</button>
                  <button type="button" aria-label={"Xóa ngày lễ " + (index + 1)}
                    onClick={() => setConfig((current) => ({ ...current, holidayOverrides: current.holidayOverrides.filter((_, i: number) => i !== index) }))}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50">Xóa</button>
                </fieldset>
              );
            })}
            <p className="text-xs text-slate-500">Đóng popup vẫn giữ bản chỉnh sửa trên trang. Nhấn “Lưu cấu hình” để áp dụng.</p>
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white pt-4">
              <button type="button" disabled={busy} onClick={() => setHolidaySettingsOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold disabled:opacity-40">Đóng</button>
              <button type="button" disabled={busy || !loaded} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-700 disabled:opacity-40">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Lưu cấu hình
              </button>
            </div>
          </section>
        </div>
      )}

      {newHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={(event) => { if (event.target === event.currentTarget) setNewHoliday(null); }}>
          <section ref={newHolidayDialogRef} role="dialog" aria-modal="true" aria-labelledby="add-holiday-title" tabIndex={-1}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 id="add-holiday-title" className="font-bold text-slate-800">Thêm ngày lễ</h3>
              <button type="button" aria-label="Đóng thêm ngày lễ" onClick={() => setNewHoliday(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={addHoliday} className="space-y-4">
              <label className="block text-xs font-semibold text-slate-600">Tên ngày lễ
                <input required maxLength={150} value={newHoliday.name}
                  onChange={(event) => { setNewHoliday({ ...newHoliday, name: event.target.value }); setNewHolidayError(""); }}
                  placeholder="Ví dụ: Ngày thành lập công ty"
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">Ngày gửi
                <input required type="date" value={newHoliday.date}
                  onChange={(event) => { setNewHoliday({ ...newHoliday, date: event.target.value }); setNewHolidayError(""); }}
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <Toggle label="Bật gửi ngày lễ" checked={newHoliday.enabled} onChange={(enabled: boolean) => setNewHoliday({ ...newHoliday, enabled })} />
              {newHolidayError && <p role="alert" className="text-sm text-rose-600">{newHolidayError}</p>}
              <p className="text-xs text-slate-500">Sau khi thêm, nhấn “Lưu cấu hình” trong popup cấu hình ngày lễ để áp dụng.</p>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setNewHoliday(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold">Hủy</button>
                <button type="submit" className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-700">Thêm vào danh sách</button>
              </div>
            </form>
          </section>
        </div>
      )}
      {preview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div ref={previewDialogRef} role="dialog" aria-modal="true" aria-label="Xem trước email" tabIndex={-1} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[calc(100vh-4rem)] animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block" />
                </div>
                <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 ml-2">XEM TRƯỚC EMAIL GỬI ĐI</span>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-slate-50 border-b border-slate-200/80 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-400 w-16 text-right">Từ (From):</span>
                <span className="text-slate-800 font-medium">Hệ thống gửi tự động &lt;no-reply@igen.vn&gt;</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-400 w-16 text-right">Đến (To):</span>
                <span className="text-slate-800 font-medium">nhanvien@company.com</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-400 w-16 text-right">Tiêu đề:</span>
                <span className="text-slate-900 font-bold">{preview.subject}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50 flex justify-center">
              <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl p-6 shadow-sm min-h-[250px] prose prose-sm max-w-none text-slate-800" dangerouslySetInnerHTML={{ __html: preview.html }} />
            </div>

            <div className="bg-slate-50 border-t border-slate-200/80 p-3 flex justify-end">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="bg-slate-800 hover:bg-slate-950 text-white rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-xs"
              >
                Đóng bản xem trước
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-slate-650 select-none cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
      />
      {label}
    </label>
  );
}

function Template({
  title,
  value,
  variables,
  onChange,
  onPreview,
  onUpload,
}: {
  title: string;
  value: { subject: string; html: string };
  variables: TemplateVariableConfig[];
  onChange: (field: "subject" | "html", value: string) => void;
  onPreview: () => void;
  onUpload: (token: string) => void;
}) {
  const subjectId = React.useId();
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
      <h3 className="font-bold text-base text-slate-800">{title}</h3>
      <div className="space-y-1">
        <label htmlFor={subjectId} className="text-xs font-semibold text-slate-600">Tiêu đề email</label>
        <input
          id={subjectId}
          value={value.subject}
          onChange={(e) => onChange("subject", e.target.value)}
          className="w-full border bg-white rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
          placeholder="Nhập tiêu đề email..."
        />
        <p className="text-[11px] text-slate-500">Thông tin tự động: {toFriendlyTokens(value.subject, variables)}</p>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nội dung thư</label>
        <RichTextEditor
          label={"Nội dung " + title.toLowerCase()}
          value={value.html}
          onChange={(val: string) => onChange("html", val)}
          onUpload={onUpload}
          variables={variables}
        />
      </div>
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center gap-2 bg-white border border-slate-250 hover:bg-slate-50 hover:border-slate-300 rounded-lg px-3.5 py-1.5 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs"
        >
          <Eye className="h-4 w-4 text-slate-500" />
          Bản xem trước
        </button>
      </div>
    </section>
  );
}
