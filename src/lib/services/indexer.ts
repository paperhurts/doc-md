/**
 * Link index: builds and queries forward links and backlinks across a vault.
 * Ported from Python sidecar/src/doc_md/indexer.py.
 */

import type { Backlink, ForwardLink, NoteName, GraphData } from "../types";
import { parseNote, extractLinkContext } from "./parser";
import { readFile } from "./tauri";

export class LinkIndex {
  forwardLinks = new Map<string, string[]>();   // path -> [target names]
  backlinks = new Map<string, string[]>();       // lowercase target -> [source paths]
  noteNames = new Map<string, string>();         // lowercase stem -> path
  noteTags = new Map<string, string[]>();        // path -> [tags]
  allTags = new Map<string, string[]>();         // tag -> [note paths]

  /** Cache of file contents for context extraction. */
  private contentCache = new Map<string, string>();

  clear() {
    this.forwardLinks.clear();
    this.backlinks.clear();
    this.noteNames.clear();
    this.noteTags.clear();
    this.allTags.clear();
    this.contentCache.clear();
  }

  /** Collect all .md/.markdown file paths from the vault tree. */
  private collectMarkdownPaths(
    entries: { path: string; name: string; is_dir: boolean; children?: any[] }[],
  ): string[] {
    const paths: string[] = [];
    for (const entry of entries) {
      if (entry.is_dir && entry.children) {
        paths.push(...this.collectMarkdownPaths(entry.children));
      } else if (entry.name.endsWith(".md") || entry.name.endsWith(".markdown")) {
        paths.push(entry.path);
      }
    }
    return paths;
  }

  /** Build the full index for a vault. Reads all files via Rust IPC. */
  async indexVault(
    tree: { path: string; name: string; is_dir: boolean; children?: any[] }[],
  ): Promise<{ notesIndexed: number; totalLinks: number; totalTags: number }> {
    this.clear();

    const mdPaths = this.collectMarkdownPaths(tree);

    // First pass: register all note names
    for (const filePath of mdPaths) {
      const parts = filePath.replace(/\\/g, "/").split("/");
      const fileName = parts[parts.length - 1] ?? "";
      const stem = fileName.replace(/\.(md|markdown)$/, "");
      this.noteNames.set(stem.toLowerCase(), filePath);
    }

    // Second pass: read and parse each file
    for (const filePath of mdPaths) {
      try {
        const content = await readFile(filePath);
        this.contentCache.set(filePath, content);
        const parsed = parseNote(content, filePath);

        this.forwardLinks.set(filePath, parsed.links);
        this.noteTags.set(filePath, parsed.tags);

        for (const tag of parsed.tags) {
          const existing = this.allTags.get(tag) ?? [];
          existing.push(filePath);
          this.allTags.set(tag, existing);
        }

        for (const target of parsed.links) {
          const key = target.toLowerCase();
          const existing = this.backlinks.get(key) ?? [];
          existing.push(filePath);
          this.backlinks.set(key, existing);
        }
      } catch (e) {
        console.error(`[indexer] Failed to index ${filePath}:`, e);
      }
    }

    return {
      notesIndexed: mdPaths.length,
      totalLinks: [...this.forwardLinks.values()].reduce((s, v) => s + v.length, 0),
      totalTags: this.allTags.size,
    };
  }

  /** Re-index a single file after it's been modified or created. */
  async indexFile(filePath: string, content: string) {
    const parts = filePath.replace(/\\/g, "/").split("/");
    const fileName = parts[parts.length - 1] ?? "";
    const stem = fileName.replace(/\.(md|markdown)$/, "");

    // Update name registry
    this.noteNames.set(stem.toLowerCase(), filePath);

    // Remove old entries for this file
    for (const [key, sources] of this.backlinks) {
      const filtered = sources.filter((s) => s !== filePath);
      if (filtered.length > 0) this.backlinks.set(key, filtered);
      else this.backlinks.delete(key);
    }
    for (const [tag, paths] of this.allTags) {
      const filtered = paths.filter((p) => p !== filePath);
      if (filtered.length > 0) this.allTags.set(tag, filtered);
      else this.allTags.delete(tag);
    }

    // Re-parse
    this.contentCache.set(filePath, content);
    const parsed = parseNote(content, filePath);

    this.forwardLinks.set(filePath, parsed.links);
    this.noteTags.set(filePath, parsed.tags);

    for (const tag of parsed.tags) {
      const existing = this.allTags.get(tag) ?? [];
      existing.push(filePath);
      this.allTags.set(tag, existing);
    }

    for (const target of parsed.links) {
      const key = target.toLowerCase();
      const existing = this.backlinks.get(key) ?? [];
      existing.push(filePath);
      this.backlinks.set(key, existing);
    }
  }

  getBacklinks(noteName: string): Backlink[] {
    const sourcePaths = [...new Set(this.backlinks.get(noteName.toLowerCase()) ?? [])];
    return sourcePaths.map((srcPath) => {
      const content = this.contentCache.get(srcPath) ?? "";
      const contexts = extractLinkContext(content, noteName);
      const parts = srcPath.replace(/\\/g, "/").split("/");
      const fileName = parts[parts.length - 1] ?? "";
      const stem = fileName.replace(/\.(md|markdown)$/, "");
      return { path: srcPath, name: stem, contexts };
    });
  }

  getForwardLinks(filePath: string): ForwardLink[] {
    const targets = this.forwardLinks.get(filePath) ?? [];
    return targets.map((target) => {
      const resolved = this.noteNames.get(target.toLowerCase()) ?? null;
      return { target, resolved_path: resolved, exists: resolved !== null };
    });
  }

  getAllNoteNames(): NoteName[] {
    return [...this.noteNames.entries()].map(([name, path]) => ({ name, path }));
  }

  getAllTags(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [tag, paths] of this.allTags) {
      result[tag] = paths.length;
    }
    return result;
  }

  getGraphData(): GraphData {
    const nodes: GraphData["nodes"] = [];
    const nodeIds = new Set<string>();

    for (const [name, path] of this.noteNames) {
      const linkCount =
        (this.forwardLinks.get(path)?.length ?? 0) +
        (this.backlinks.get(name)?.length ?? 0);
      const parts = path.replace(/\\/g, "/").split("/");
      const fileName = parts[parts.length - 1] ?? "";
      const label = fileName.replace(/\.(md|markdown)$/, "");
      nodes.push({ id: path, label, links: linkCount });
      nodeIds.add(path);
    }

    const edges: GraphData["edges"] = [];
    for (const [sourcePath, targets] of this.forwardLinks) {
      if (!nodeIds.has(sourcePath)) continue;
      for (const target of targets) {
        const resolved = this.noteNames.get(target.toLowerCase());
        if (resolved && nodeIds.has(resolved)) {
          edges.push({ source: sourcePath, target: resolved });
        }
      }
    }

    return { nodes, edges };
  }
}

/** Module-level singleton. */
export const linkIndex = new LinkIndex();
