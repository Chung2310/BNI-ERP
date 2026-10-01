import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseUserImportExcel } from "./userImportExcel";
function book(rows: unknown[][], transform?: (sheet: XLSX.WorkSheet, book: XLSX.WorkBook) => void) {
  const sheet = XLSX.utils.aoa_to_sheet(rows), workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Members"); transform?.(sheet, workbook);
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}
describe("member Excel import", () => {
  it("ignores STT including formulas and STT-only rows, preserves Excel row numbers and restores phone zero", () => {
    const data = book([["STT","Họ tên","Email","Điện thoại","Ngày sinh","Công ty"],[1,"An","an@example.com",901234567,"15/08/1990","Công ty ABC"],[2],[99,"Bình","binh@example.com","+84901234567","2000-01-02","Công ty XYZ"]], sheet => { sheet.A2.f = "ROW()-1"; });
    expect(parseUserImportExcel(data)).toEqual([
      {rowNumber:2,displayName:"An",email:"an@example.com",phone:"0901234567",birthDate:"1990-08-15",companyName:"Công ty ABC",industry:""},
      {rowNumber:4,displayName:"Bình",email:"binh@example.com",phone:"+84901234567",birthDate:"2000-01-02",companyName:"Công ty XYZ",industry:""},
    ]);
  });
  it("reads the BNI member export columns and ignores empty rows", () => {
    const rows = parseUserImportExcel(book([
      ["Họ tên", "Công ty", "Lĩnh vực kinh doanh", "Điện thoại", "Ngày sinh", "Ảnh đại diện", "Ảnh bìa / Banner", "Email"],
      ["An", "ABC", "Công nghệ", "0901 234 567", "", "https://example.com/avatar.jpg", "https://example.com/banner.jpg", ""],
      ["", "", "", "", "", "", "", ""],
    ]));
    expect(rows).toEqual([{ rowNumber: 2, displayName: "An", companyName: "ABC", industry: "Công nghệ", phone: "0901234567", birthDate: "", photoURL: "https://example.com/avatar.jpg", coverImage: "https://example.com/banner.jpg", email: "" }]);
  });
  it("handles Excel date cells", () => {
    const rows = parseUserImportExcel(book([["Họ tên","Email","Ngày sinh"],["An","an@example.com",new Date(1990,7,15)]]));
    expect(rows[0].birthDate).toBe("1990-08-15");
  });
  it("rejects formulas, unsupported or duplicate headers and missing mandatory columns", () => {
    expect(() => parseUserImportExcel(book([["Họ tên","Email"],["An","an@example.com"]], sheet => { sheet.A2.f = '"An"'; }))).toThrow(/công thức/);
    expect(() => parseUserImportExcel(book([["Họ tên","Email","Role"],["An","an@example.com","admin"]]))).toThrow(/Cột không hỗ trợ/);
    expect(() => parseUserImportExcel(book([["Họ tên","Email","email"]]))).toThrow(/trùng/);
    expect(() => parseUserImportExcel(book([["Họ tên"],["An"]]))).toThrow(/Thiếu/);
  });
  it("rejects empty and oversized workbooks rather than silently truncating them", () => {
    expect(() => parseUserImportExcel(book([["Họ tên","Email"]]))).toThrow(/chưa có/);
    expect(() => parseUserImportExcel(book([["Họ tên","Email"],...Array.from({length:201},()=>["An","an@example.com"])]))).toThrow(/200/);
  });
});
