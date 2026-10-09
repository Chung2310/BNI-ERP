import { describe, expect, it } from "vitest";
import { buildMediaDownloadUrl } from "./mediaDownload";

describe("buildMediaDownloadUrl", () => {
  it("sends the original filename through the authenticated download proxy", () => {
    const result = buildMediaDownloadUrl(
      "https://res.cloudinary.com/acme/raw/upload/njfym86cjph6urjw3ufh",
      "Báo cáo tháng 10.xlsx",
    );
    const parsed = new URL(result, "https://erp.test");

    expect(parsed.pathname).toBe("/api/v1/media/download");
    expect(parsed.searchParams.get("url")).toContain("njfym86cjph6urjw3ufh");
    expect(parsed.searchParams.get("filename")).toBe("Báo cáo tháng 10.xlsx");
    expect(parsed.searchParams.has("token")).toBe(false);
  });
});
