/**
 * Full-text search using MiniSearch.
 * Replaces Python Whoosh-based search from sidecar/src/doc_md/search.py.
 */

import MiniSearch from "minisearch";
import type { SearchResult } from "../types";
import { extractTitle } from "./parser";

export class SearchIndex {
  private index: MiniSearch;
  private contentMap = new Map<string, string>();

  constructor() {
    this.index = this.createIndex();
  }

  private createIndex(): MiniSearch {
    return new MiniSearch({
      fields: ["title", "content"],
      storeFields: ["title", "path"],
      idField: "path",
      searchOptions: {
        boost: { title: 2 },
        prefix: true,
        fuzzy: 0.2,
      },
    });
  }

  /** Build the search index from a list of files. */
  buildIndex(files: { path: string; name: string; content: string }[]) {
    this.index = this.createIndex();
    this.contentMap.clear();

    const documents = files.map((f) => ({
      path: f.path,
      title: extractTitle(f.content, f.name.replace(/\.(md|markdown)$/, "")),
      content: f.content,
    }));

    this.index.addAll(documents);

    for (const f of files) {
      this.contentMap.set(f.path, f.content);
    }
  }

  /** Update a single file in the index. */
  updateFile(path: string, name: string, content: string) {
    // Remove old entry if it exists
    try {
      this.index.discard(path);
    } catch {
      // Not in index yet — fine
    }

    this.index.add({
      path,
      title: extractTitle(content, name.replace(/\.(md|markdown)$/, "")),
      content,
    });

    this.contentMap.set(path, content);
  }

  /** Remove a file from the index. */
  removeFile(path: string) {
    try {
      this.index.discard(path);
    } catch {
      // Not in index
    }
    this.contentMap.delete(path);
  }

  /** Search for a query string. Returns ranked results with snippets. */
  search(query: string, limit = 20): SearchResult[] {
    if (!query.trim()) return [];

    const results = this.index.search(query, { limit });

    return results.map((hit) => {
      const content = this.contentMap.get(hit.id as string) ?? "";
      const snippet = this.generateSnippet(content, query);
      return {
        path: hit.id as string,
        title: (hit as any).title ?? "",
        snippet,
        score: Math.round(hit.score * 100) / 100,
      };
    });
  }

  /** Generate a context snippet with <mark> highlighting around matching terms. */
  private generateSnippet(content: string, query: string, maxLength = 200): string {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1);
    if (terms.length === 0) return "";

    const lines = content.split("\n");
    // Find the first line containing a match
    let bestLine = -1;
    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      if (terms.some((t) => lower.includes(t))) {
        bestLine = i;
        break;
      }
    }

    if (bestLine === -1) return content.slice(0, maxLength);

    // Build snippet from surrounding lines
    const start = Math.max(0, bestLine - 1);
    const end = Math.min(lines.length, bestLine + 3);
    let snippet = lines.slice(start, end).join(" ").slice(0, maxLength);

    // Escape HTML first, then highlight terms
    snippet = escapeHtml(snippet);
    for (const term of terms) {
      const re = new RegExp(`(${escapeRegex(term)})`, "gi");
      snippet = snippet.replace(re, "<mark>$1</mark>");
    }

    return snippet;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Module-level singleton. */
export const searchIndex = new SearchIndex();
