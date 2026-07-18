import { invoke } from "@tauri-apps/api/core";
import type { VaultEntry } from "../types";
import { isTauri } from "./env";
import { mockBackend } from "./mock";

// Outside Tauri (plain browser, Vitest) every command is served by the
// in-memory mock backend so the full UI remains usable and testable.

// Vault commands
export async function getCurrentVault(): Promise<{ path: string; name: string } | null> {
  if (!isTauri()) return mockBackend.getCurrentVault();
  return await invoke("get_current_vault");
}

export async function setCurrentVault(path: string): Promise<{ path: string; name: string }> {
  if (!isTauri()) return mockBackend.setCurrentVault(path);
  return await invoke("set_current_vault", { path });
}

// File commands
export async function listFiles(vaultPath: string): Promise<VaultEntry[]> {
  if (!isTauri()) return mockBackend.listFiles(vaultPath);
  return await invoke("list_files", { vaultPath });
}

export async function readFile(filePath: string): Promise<string> {
  if (!isTauri()) return mockBackend.readFile(filePath);
  return await invoke("read_file", { filePath });
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  if (!isTauri()) return mockBackend.writeFile(filePath, content);
  return await invoke("write_file", { filePath, content });
}

/** Write binary content (base64-encoded) — used for pasted images. */
export async function writeBinaryFile(filePath: string, contentsBase64: string): Promise<void> {
  if (!isTauri()) return mockBackend.writeBinaryFile(filePath, contentsBase64);
  return await invoke("write_binary_file", { filePath, contentsBase64 });
}

export async function deleteFile(filePath: string): Promise<void> {
  if (!isTauri()) return mockBackend.deleteFile(filePath);
  return await invoke("delete_file", { filePath });
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  if (!isTauri()) return mockBackend.renameFile(oldPath, newPath);
  return await invoke("rename_file", { oldPath, newPath });
}

export async function createDirectory(dirPath: string): Promise<void> {
  if (!isTauri()) return mockBackend.createDirectory(dirPath);
  return await invoke("create_directory", { dirPath });
}

// Watcher commands
export async function startWatching(vaultPath: string): Promise<void> {
  if (!isTauri()) return mockBackend.startWatching(vaultPath);
  return await invoke("start_watching", { vaultPath });
}

export async function stopWatching(): Promise<void> {
  if (!isTauri()) return mockBackend.stopWatching();
  return await invoke("stop_watching");
}
