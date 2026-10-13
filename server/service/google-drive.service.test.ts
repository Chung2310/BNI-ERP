import { afterEach, describe, expect, it, vi } from "vitest";
import { googleDriveService } from "./google-drive.service";

describe("googleDriveService.downloadFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads a regular Drive file with OAuth and alt=media", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await googleDriveService.downloadFile("access-token", {
      id: "drive-file-id",
      name: "bao-cao.pdf",
      mimeType: "application/pdf",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.googleapis.com/drive/v3/files/drive-file-id?alt=media&supportsAllDrives=true",
      { headers: { Authorization: "Bearer access-token" } }
    );
    expect(result.filename).toBe("bao-cao.pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect([...result.buffer]).toEqual([1, 2, 3]);
  });

  it("exports Google Docs as DOCX and adds the extension", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("docx-content", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await googleDriveService.downloadFile("access-token", {
      id: "google-doc-id",
      name: "Hop dong",
      mimeType: "application/vnd.google-apps.document",
    });

    expect(fetchMock.mock.calls[0][0]).toContain("/google-doc-id/export?mimeType=");
    expect(result.filename).toBe("Hop dong.docx");
    expect(result.mimeType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("rejects folders because they must use ZIP download", async () => {
    await expect(
      googleDriveService.downloadFile("access-token", {
        id: "folder-id",
        name: "Tai lieu",
        mimeType: "application/vnd.google-apps.folder",
      })
    ).rejects.toThrow("tải ZIP");
  });
});
