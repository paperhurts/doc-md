/**
 * In-memory mock backend used when the app runs outside Tauri (plain browser,
 * Vitest). Implements the same command surface as the Rust backend so the UI
 * and tests can exercise real flows without IPC.
 */
import type { VaultEntry } from "../types";

export const MOCK_VAULT_PATH = "C:\\demo-vault";
export const MOCK_VAULT_NAME = "demo-vault";

/** path -> text content for text files */
const textFiles = new Map<string, string>();
/** path -> binary content for pasted images etc. */
const binaryFiles = new Map<string, Uint8Array>();
/** explicit directories (dirs also implied by file paths) */
const dirs = new Set<string>();

const listeners = new Map<string, Set<(payload: unknown) => void>>();

function seed() {
  textFiles.clear();
  binaryFiles.clear();
  dirs.clear();
  const v = MOCK_VAULT_PATH;
  textFiles.set(
    `${v}\\Welcome.md`,
    `# Welcome to doc-md

This is a **demo vault** running in browser mode.

- [x] Try the *live preview* mode
- [ ] Link to [[Ideas]] and #tags
- [ ] Paste an image

> Blockquotes, \`inline code\`, and ~~strikethrough~~ all render.

## Section two

Some more text with a [link](https://example.com).
`,
  );
  textFiles.set(
    `${v}\\Ideas.md`,
    `# Ideas

Linked from [[Welcome]]. Has #ideas tag.
`,
  );
  textFiles.set(
    `${v}\\Project Board.md`,
    `---
kanban: true
---

## To Do

- [ ] Design sticky notes
- [ ] Write tests

## Doing

- [ ] Build kanban board

## Done

- [x] Set up project
`,
  );
  dirs.add(`${v}\\daily`);
}
seed();

/** Reset to the seeded demo state (used by tests). */
export function resetMock() {
  seed();
}

export function emitMockEvent(name: string, payload: unknown) {
  for (const cb of listeners.get(name) ?? []) cb(payload);
}

export function listenMock(
  name: string,
  cb: (payload: unknown) => void,
): () => void {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name)!.add(cb);
  return () => listeners.get(name)?.delete(cb);
}

function parentOf(path: string): string {
  const i = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return i === -1 ? "" : path.slice(0, i);
}

function nameOf(path: string): string {
  const i = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return i === -1 ? path : path.slice(i + 1);
}

/** All known directory paths under root, implied by files + explicit dirs. */
function allDirs(root: string): Set<string> {
  const out = new Set<string>();
  const addChain = (dir: string) => {
    let d = dir;
    while (d && d.length > root.length && d.startsWith(root)) {
      out.add(d);
      d = parentOf(d);
    }
  };
  for (const p of [...textFiles.keys(), ...binaryFiles.keys()]) addChain(parentOf(p));
  for (const d of dirs) addChain(d);
  return out;
}

export const mockBackend = {
  async getCurrentVault(): Promise<{ path: string; name: string } | null> {
    return { path: MOCK_VAULT_PATH, name: MOCK_VAULT_NAME };
  },

  async setCurrentVault(path: string): Promise<{ path: string; name: string }> {
    return { path, name: nameOf(path) || path };
  },

  async listFiles(vaultPath: string): Promise<VaultEntry[]> {
    const root = vaultPath;
    const dirSet = allDirs(root);
    const buildDir = (dir: string): VaultEntry[] => {
      const entries: VaultEntry[] = [];
      for (const d of dirSet) {
        if (parentOf(d) === dir) {
          entries.push({ name: nameOf(d), path: d, is_dir: true, children: buildDir(d) });
        }
      }
      for (const p of [...textFiles.keys(), ...binaryFiles.keys()]) {
        if (parentOf(p) === dir) {
          entries.push({ name: nameOf(p), path: p, is_dir: false });
        }
      }
      entries.sort((a, b) =>
        a.is_dir === b.is_dir ? a.name.localeCompare(b.name) : a.is_dir ? -1 : 1,
      );
      return entries;
    };
    if (!dirSet.has(root) && ![...textFiles.keys()].some((p) => p.startsWith(root))) {
      throw new Error(`Directory not found: ${root}`);
    }
    return buildDir(root);
  },

  async readFile(filePath: string): Promise<string> {
    const content = textFiles.get(filePath);
    if (content === undefined) throw new Error(`File not found: ${filePath}`);
    return content;
  },

  async writeFile(filePath: string, content: string): Promise<void> {
    textFiles.set(filePath, content);
  },

  async writeBinaryFile(filePath: string, contentsBase64: string): Promise<void> {
    const bin = Uint8Array.from(atob(contentsBase64), (c) => c.charCodeAt(0));
    binaryFiles.set(filePath, bin);
  },

  async deleteFile(filePath: string): Promise<void> {
    if (!textFiles.delete(filePath) && !binaryFiles.delete(filePath)) {
      dirs.delete(filePath);
    }
  },

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const text = textFiles.get(oldPath);
    if (text !== undefined) {
      textFiles.delete(oldPath);
      textFiles.set(newPath, text);
      return;
    }
    const bin = binaryFiles.get(oldPath);
    if (bin !== undefined) {
      binaryFiles.delete(oldPath);
      binaryFiles.set(newPath, bin);
      return;
    }
    throw new Error(`File not found: ${oldPath}`);
  },

  async createDirectory(dirPath: string): Promise<void> {
    dirs.add(dirPath);
  },

  async startWatching(_vaultPath: string): Promise<void> {},
  async stopWatching(): Promise<void> {},

  /** Test/browser helper: read binary file back. */
  getBinaryFile(filePath: string): Uint8Array | undefined {
    return binaryFiles.get(filePath);
  },
};
