import { google } from "googleapis";
import { Readable } from "stream";

export class DriveFileService {
  public static async createFolder(auth: any, name: string): Promise<string> {
    const drive = google.drive({ version: "v3", auth });
    
    // Tìm xem thư mục đã tồn tại chưa để tránh tạo trùng
    const response = await drive.files.list({
      q: `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id)",
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id!;
    }

    const fileMetadata = {
      name,
      mimeType: "application/vnd.google-apps.folder",
    };

    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id",
    });

    return folder.data.id!;
  }

  /**
   * Tải tệp lên Google Drive
   */
  public static async uploadFile(
    auth: any,
    buffer: Buffer,
    name: string,
    mimeType: string,
    parentId: string
  ) {
    const drive = google.drive({ version: "v3", auth });
    
    // Đọc buffer dưới dạng stream Readable
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata = {
      name,
      parents: [parentId],
    };

    const media = {
      mimeType,
      body: stream,
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, name, mimeType, webViewLink, webContentLink, thumbnailLink, size",
    });

    // Cấp quyền đọc cho tất cả mọi người để có thể lấy link thumbnail và download trực tiếp hiển thị trên ERP
    try {
      await drive.permissions.create({
        fileId: file.data.id!,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });
    } catch (err: any) {
      console.warn("Không thể thiết lập quyền công khai cho file:", err.message);
    }

    return file.data;
  }

  /**
   * Xóa file khỏi Google Drive
   */
  public static async deleteFile(auth: any, fileId: string): Promise<void> {
    const drive = google.drive({ version: "v3", auth });
    await drive.files.delete({ fileId });
  }
}
