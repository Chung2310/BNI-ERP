import * as XLSX from "xlsx";
import type { UserImportRow } from "../services/userImportService";

const headers: Record<string, keyof Omit<UserImportRow, "rowNumber">> = {
  "ho ten": "displayName", "ho va ten": "displayName", "displayname": "displayName", "email": "email",
  "dien thoai": "phone", "so dien thoai": "phone", "phone": "phone",
  "doanh nghiep": "companyName", "ten doanh nghiep": "companyName", "companyname": "companyName",
  "cong ty": "companyName", "ten cong ty": "companyName", "company": "companyName",
  "linh vuc kinh doanh": "industry", "anh dai dien": "photoURL", "photourl": "photoURL",
  "anh bia / banner": "coverImage", "anh bia": "coverImage", "banner": "coverImage", "coverimage": "coverImage",
  "linh vuc": "industry", "industry": "industry", "ngay sinh": "birthDate", "birthdate": "birthDate",
};
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").trim().toLowerCase().replace(/\s+/g, " ");
export function parseUserImportExcel(data: ArrayBuffer): UserImportRow[] {
  const book = XLSX.read(data, { type: "array", sheetRows: 202 });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet || !sheet["!ref"]) throw new Error("File Excel không có dữ liệu.");
  const range = XLSX.utils.decode_range(sheet["!fullref"] || sheet["!ref"]);
  if (range.e.r > 200 || range.e.c > 19) throw new Error("File tối đa 200 dòng dữ liệu và 20 cột. Hãy dùng file mẫu.");
  const columns: Array<{ index: number; field: keyof Omit<UserImportRow, "rowNumber"> }> = [];
  for (let col = 0; col <= range.e.c; col++) {
    const name = String(sheet[XLSX.utils.encode_cell({ r: 0, c: col })]?.v || "");
    const normalizedName = normalize(name);
    if (["stt", "stt.", "s.t.t", "s.t.t.", "so thu tu"].includes(normalizedName)) continue;
    const field = headers[normalizedName];
    if (!field) throw new Error("Cột không hỗ trợ: " + (name || "(trống)") + ". Hãy dùng file mẫu.");
    if (columns.some(c => c.field === field)) throw new Error("Tên cột bị trùng: " + name);
    columns.push({ index: col, field });
  }
  if (!columns.some(c => c.field === "displayName") || !columns.some(c => c.field === "email")) throw new Error("Thiếu cột Họ tên hoặc Email.");
  const rows: UserImportRow[] = [];
  for (let r = 1; r <= range.e.r; r++) {
    const row: UserImportRow = { rowNumber: r + 1, displayName: "", email: "", phone: "", companyName: "", industry: "", birthDate: "" };
    for (const col of columns) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c: col.index })];
      if (cell?.f) throw new Error("Dòng " + (r + 1) + " có công thức. Hãy dán giá trị thay cho công thức.");
      let text = String(cell?.v ?? "").trim();
      if (col.field === "phone") {
        text = String(cell?.w ?? cell?.v ?? "").trim().replace(/[\s().-]/g, "");
        if (/^[35789]\d{8}$/.test(text)) text = "0" + text;
      }
      if (col.field === "birthDate" && text) {
        if (typeof cell?.v === "number") {
          const date = XLSX.SSF.parse_date_code(cell.v, { date1904: book.Workbook?.WBProps?.date1904 });
          if (date) text = String(date.y).padStart(4,"0") + "-" + String(date.m).padStart(2,"0") + "-" + String(date.d).padStart(2,"0");
        } else {
          const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
          if (parts) text = parts[3] + "-" + parts[2].padStart(2,"0") + "-" + parts[1].padStart(2,"0");
        }
      }
      row[col.field] = text;
    }
    if (Object.entries(row).some(([key, value]) => key !== "rowNumber" && value)) rows.push(row);
  }
  if (!rows.length) throw new Error("File chưa có tài khoản cần nhập.");
  return rows;
}
export function downloadUserImportTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([["STT", "Họ tên", "Email", "Điện thoại", "Doanh nghiệp", "Lĩnh vực", "Ngày sinh"],
    [1, "Nguyễn Văn An", "an@example.com", "0901234567", "Công ty ABC", "Công nghệ", "15/08/1990"]]);
  sheet["!cols"] = [8, 25, 32, 18, 30, 25, 18].map(wch => ({ wch }));
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Tai khoan");
  XLSX.writeFile(book, "mau-nhap-tai-khoan.xlsx");
}
