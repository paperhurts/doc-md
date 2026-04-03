/**
 * Markdown parser for extracting wiki-links, tags, and frontmatter.
 * Ported from Python sidecar/src/doc_md/parser.py.
 */

import type { ParsedNote } from "../types";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
const TAG_RE = /(?:^|\s)#([a-zA-Z][\w/-]*)/gm;
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

/** Parse simple YAML frontmatter (key: value pairs and tag lists). */
function parseFrontmatter(text: string): { metadata: Record<string, unknown>; body: string } {
  const match = text.match(FRONTMATTER_RE);
  if (!match) return { metadata: {}, body: text };

  const yamlBlock = match[1];
  const body = text.slice(match[0].length).trimStart();
  const metadata: Record<string, unknown> = {};

  for (const line of yamlBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value: unknown = trimmed.slice(colonIdx + 1).trim();

    // Handle YAML list format: [item1, item2] or bare comma-separated
    if (typeof value === "string") {
      const strVal = value as string;
      if (strVal.startsWith("[") && strVal.endsWith("]")) {
        value = strVal
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
      }
    }

    metadata[key] = value;
  }

  return { metadata, body };
}

/** Parse a markdown note and extract links, tags, and frontmatter. */
export function parseNote(content: string, filePath: string): ParsedNote {
  const pathParts = filePath.replace(/\\/g, "/").split("/");
  const fileName = pathParts[pathParts.length - 1] ?? "";
  const stem = fileName.replace(/\.(md|markdown)$/, "");

  const { metadata, body } = parseFrontmatter(content);

  // Extract wiki-links
  const links: string[] = [];
  let match: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((match = WIKILINK_RE.exec(body)) !== null) {
    links.push(match[1]);
  }

  // Extract tags from body
  const bodyTags: string[] = [];
  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(body)) !== null) {
    bodyTags.push(match[1]);
  }

  // Extract tags from frontmatter
  let fmTags: string[] = [];
  const rawTags = metadata.tags;
  if (Array.isArray(rawTags)) {
    fmTags = rawTags.map(String);
  } else if (typeof rawTags === "string") {
    fmTags = rawTags.split(",").map((t) => t.trim()).filter(Boolean);
  }

  const allTags = [...new Set([...bodyTags, ...fmTags])];

  return {
    path: filePath,
    name: stem,
    frontmatter: metadata,
    links,
    tags: allTags,
  };
}

/** Extract surrounding context lines for each occurrence of a link to target. */
export function extractLinkContext(content: string, target: string, contextLines = 2): string[] {
  const lines = content.split("\n");
  const contexts: string[] = [];
  const pattern = new RegExp(`\\[\\[${escapeRegex(target)}(?:\\|[^\\]]+)?\\]\\]`, "i");

  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length, i + contextLines + 1);
      contexts.push(lines.slice(start, end).join("\n"));
    }
  }

  return contexts;
}

/** Extract title from first heading or use filename stem as fallback. */
export function extractTitle(content: string, fallback: string): string {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      return trimmed.slice(2).trim();
    }
  }
  return fallback;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
