import { invoke } from "@tauri-apps/api/core";
import type { VaultEntry } from "../types";

// Vault commands
export async function getCurrentVault(): Promise<{ path: string; name: string } | null> {
  return await invoke("get_current_vault");
}

export async function setCurrentVault(path: string): Promise<{ path: string; name: string }> {
  return await invoke("set_current_vault", { path });
}

// File commands
export async function listFiles(vaultPath: string): Promise<VaultEntry[]> {
  return await invoke("list_files", { vaultPath });
}

export async function readFile(filePath: string): Promise<string> {
  return await invoke("read_file", { filePath });
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  return await invoke("write_file", { filePath, content });
}

export async function deleteFile(filePath: string): Promise<void> {
  return await invoke("delete_file", { filePath });
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  return await invoke("rename_file", { oldPath, newPath });
}

export async function createDirectory(dirPath: string): Promise<void> {
  return await invoke("create_directory", { dirPath });
}

// Watcher commands
export async function startWatching(vaultPath: string): Promise<void> {
  return await invoke("start_watching", { vaultPath });
}

export async function stopWatching(): Promise<void> {
  return await invoke("stop_watching");
}
