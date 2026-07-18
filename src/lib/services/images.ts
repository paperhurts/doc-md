/**
 * Pasted-image handling: save clipboard images into the vault's attachment
 * folder and resolve vault-relative image paths for rendering.
 */
import { convertFileSrc } from "@tauri-apps/api/core";
import { isTauri } from "./env";
import { mockBackend } from "./mock";
import { writeBinaryFile } from "./tauri";

/** pasted-YYYYMMDD-HHmmss-mmm.png (millisecond suffix avoids collisions). */
export function imageFileName(now: Date = new Date(), ext = "png"): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}` +
    `-${pad(now.getMilliseconds(), 3)}`;
  return `pasted-${stamp}.${ext}`;
}

/** Extension for a clipboard MIME type (defaults to png). */
export function extForMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
  };
  return map[mime] ?? "png";
}

/** Markdown image link for a vault-relative path (spaces URL-encoded). */
export function markdownImageLink(relPath: string): string {
  const encoded = relPath.replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/");
  return `![](${encoded})`;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Save a pasted image blob into <vault>/<attachmentFolder>/ and return the
 * markdown to insert at the cursor.
 */
export async function savePastedImage(
  blob: Blob,
  vaultPath: string,
  attachmentFolder: string,
  now: Date = new Date(),
): Promise<{ relPath: string; markdown: string }> {
  const name = imageFileName(now, extForMime(blob.type));
  const relPath = `${attachmentFolder}/${name}`;
  const sep = vaultPath.includes("\\") ? "\\" : "/";
  const absPath = `${vaultPath}${sep}${attachmentFolder}${sep}${name}`;
  const base64 = await blobToBase64(blob);
  await writeBinaryFile(absPath, base64);
  return { relPath, markdown: markdownImageLink(relPath) };
}

// Object URLs for mock-mode images, keyed by absolute path
const mockUrlCache = new Map<string, string>();

/**
 * Resolve an image src from markdown to something the webview can display.
 * Absolute URLs (http/https/data/asset) pass through; vault-relative paths
 * are converted via the Tauri asset protocol (or a blob URL in mock mode).
 * Returns null when the path can't be resolved.
 */
export function resolveImageSrc(src: string, vaultPath: string): string | null {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(src)) return src; // already a URL
  if (!vaultPath) return null;
  const decoded = decodeURIComponent(src);
  const sep = vaultPath.includes("\\") ? "\\" : "/";
  const abs = `${vaultPath}${sep}${decoded.replace(/[/\\]/g, sep)}`;

  if (isTauri()) {
    return convertFileSrc(abs);
  }

  const cached = mockUrlCache.get(abs);
  if (cached) return cached;
  const bin = mockBackend.getBinaryFile(abs);
  if (!bin || typeof URL.createObjectURL !== "function") return null;
  const url = URL.createObjectURL(new Blob([new Uint8Array(bin)]));
  mockUrlCache.set(abs, url);
  return url;
}
