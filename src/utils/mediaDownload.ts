import { getAccessToken } from "../services/authService";

/** Build the authenticated same-origin URL that restores the original download filename. */
export function buildMediaDownloadUrl(fileUrl: string, filename: string): string {
  const params = new URLSearchParams({ url: fileUrl, filename });
  return `/api/v1/media/download?${params.toString()}`;
}

function responseFilename(response: Response, fallback: string): string {
  const disposition = response.headers.get("Content-Disposition") || "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (!encoded) return fallback;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return fallback;
  }
}

/** Download through fetch so the global 401 interceptor can refresh an expired access token. */
export async function downloadFileFromApi(downloadUrl: string, fallbackFilename: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(downloadUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.error || "Không thể tải tệp xuống.");
  }

  const blobUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = responseFilename(response, fallbackFilename);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export function downloadMediaFile(fileUrl: string, filename: string): Promise<void> {
  return downloadFileFromApi(buildMediaDownloadUrl(fileUrl, filename), filename);
}
