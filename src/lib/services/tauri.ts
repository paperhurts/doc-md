import { invoke } from "@tauri-apps/api/core";
import type { VaultEntry } from "../types";

export async function sidecarPing(): Promise<string> {
  return await invoke<string>("sidecar_ping");
}

export async function sidecarRequest(
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  return await invoke("sidecar_request", { method, params: params ?? {} });
}

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

// Sidecar link index commands
export async function indexVault(vaultPath: string): Promise<unknown> {
  return await sidecarRequest("index_vault", { vault_path: vaultPath });
}

export async function indexFile(filePath: string): Promise<unknown> {
  return await sidecarRequest("index_file", { file_path: filePath });
}

export interface Backlink {
  path: string;
  name: string;
  contexts: string[];
}

export async function getBacklinks(noteName: string): Promise<Backlink[]> {
  return (await sidecarRequest("get_backlinks", { note_name: noteName })) as Backlink[];
}

export interface ForwardLink {
  target: string;
  resolved_path: string | null;
  exists: boolean;
}

export async function getForwardLinks(filePath: string): Promise<ForwardLink[]> {
  return (await sidecarRequest("get_forward_links", { file_path: filePath })) as ForwardLink[];
}

export interface NoteName {
  name: string;
  path: string;
}

export async function getAllNoteNames(): Promise<NoteName[]> {
  return (await sidecarRequest("get_all_note_names")) as NoteName[];
}

export async function getAllTags(): Promise<Record<string, number>> {
  return (await sidecarRequest("get_all_tags")) as Record<string, number>;
}

// Search commands
export async function buildSearchIndex(vaultPath: string): Promise<unknown> {
  return await sidecarRequest("build_search_index", { vault_path: vaultPath });
}

export async function updateSearchIndex(vaultPath: string, filePath: string): Promise<unknown> {
  return await sidecarRequest("update_search_index", { vault_path: vaultPath, file_path: filePath });
}

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

export async function searchVault(
  vaultPath: string,
  query: string,
  limit: number = 20,
): Promise<SearchResult[]> {
  return (await sidecarRequest("search", { vault_path: vaultPath, query, limit })) as SearchResult[];
}
