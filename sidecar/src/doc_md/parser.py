"""Markdown parser for extracting wiki-links, tags, and frontmatter."""

import re
from pathlib import Path
from typing import Any

import frontmatter

WIKILINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]")
TAG_RE = re.compile(r"(?:^|\s)#([a-zA-Z][\w/-]*)", re.MULTILINE)


def parse_note(file_path: str) -> dict[str, Any]:
    """Parse a markdown file and extract metadata, links, and tags."""
    path = Path(file_path)
    if not path.exists() or not path.is_file():
        return {"error": f"File not found: {file_path}"}

    text = path.read_text(encoding="utf-8", errors="replace")

    # Parse frontmatter
    post = frontmatter.loads(text)
    fm = dict(post.metadata) if post.metadata else {}
    body = post.content

    # Extract wiki-links
    links = WIKILINK_RE.findall(body)

    # Extract tags from body and frontmatter
    body_tags = TAG_RE.findall(body)
    fm_tags = fm.get("tags", [])
    if isinstance(fm_tags, str):
        fm_tags = [t.strip() for t in fm_tags.split(",")]
    all_tags = list(set(body_tags + fm_tags))

    return {
        "path": str(path),
        "name": path.stem,
        "frontmatter": fm,
        "links": links,
        "tags": all_tags,
    }


def extract_link_context(file_path: str, target: str, context_lines: int = 2) -> list[str]:
    """Extract surrounding context for each occurrence of a link to target."""
    path = Path(file_path)
    if not path.exists():
        return []

    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.split("\n")
    contexts = []

    pattern = re.compile(rf"\[\[{re.escape(target)}(?:\|[^\]]+)?\]\]")
    for i, line in enumerate(lines):
        if pattern.search(line):
            start = max(0, i - context_lines)
            end = min(len(lines), i + context_lines + 1)
            snippet = "\n".join(lines[start:end])
            contexts.append(snippet)

    return contexts
