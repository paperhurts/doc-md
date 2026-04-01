"""Link index: builds and queries forward links and backlinks across a vault."""

import os
from pathlib import Path
from typing import Any

from doc_md.parser import parse_note, extract_link_context

# In-memory index
_forward_links: dict[str, list[str]] = {}  # note path -> [target names]
_backlinks: dict[str, list[str]] = {}      # target name -> [source paths]
_note_names: dict[str, str] = {}           # lowercase name -> path
_note_tags: dict[str, list[str]] = {}      # note path -> [tags]
_all_tags: dict[str, list[str]] = {}       # tag -> [note paths]


def _resolve_link(target: str) -> str | None:
    """Resolve a wiki-link target to a file path."""
    return _note_names.get(target.lower())


def index_vault(vault_path: str) -> dict[str, Any]:
    """Scan all markdown files in a vault and build the link index."""
    global _forward_links, _backlinks, _note_names, _note_tags, _all_tags

    _forward_links.clear()
    _backlinks.clear()
    _note_names.clear()
    _note_tags.clear()
    _all_tags.clear()

    vault = Path(vault_path)
    if not vault.is_dir():
        return {"error": f"Not a directory: {vault_path}"}

    md_files: list[Path] = []
    for root, dirs, files in os.walk(vault):
        # Skip hidden dirs and common non-note dirs
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("node_modules", "target")]
        for f in files:
            if f.endswith((".md", ".markdown")):
                md_files.append(Path(root) / f)

    # First pass: register all note names
    for path in md_files:
        _note_names[path.stem.lower()] = str(path)

    # Second pass: parse links and tags
    for path in md_files:
        path_str = str(path)
        parsed = parse_note(path_str)
        if "error" in parsed:
            continue

        links = parsed.get("links", [])
        tags = parsed.get("tags", [])

        _forward_links[path_str] = links
        _note_tags[path_str] = tags

        for tag in tags:
            _all_tags.setdefault(tag, []).append(path_str)

        for target in links:
            _backlinks.setdefault(target.lower(), []).append(path_str)

    return {
        "notes_indexed": len(md_files),
        "total_links": sum(len(v) for v in _forward_links.values()),
        "total_tags": len(_all_tags),
    }


def index_file(file_path: str) -> dict[str, Any]:
    """Re-index a single file (after it's been modified)."""
    path = Path(file_path)
    path_str = str(path)

    if not path.exists():
        # File was deleted — remove from index
        _forward_links.pop(path_str, None)
        old_name = path.stem.lower()
        if _note_names.get(old_name) == path_str:
            _note_names.pop(old_name, None)
        for targets in _backlinks.values():
            if path_str in targets:
                targets.remove(path_str)
        for tag_paths in _all_tags.values():
            if path_str in tag_paths:
                tag_paths.remove(path_str)
        _note_tags.pop(path_str, None)
        return {"action": "removed", "path": path_str}

    # Update name registry
    _note_names[path.stem.lower()] = path_str

    # Remove old backlink entries for this file
    for targets in _backlinks.values():
        if path_str in targets:
            targets.remove(path_str)
    for tag_paths in _all_tags.values():
        if path_str in tag_paths:
            tag_paths.remove(path_str)

    # Re-parse
    parsed = parse_note(path_str)
    if "error" in parsed:
        return parsed

    links = parsed.get("links", [])
    tags = parsed.get("tags", [])

    _forward_links[path_str] = links
    _note_tags[path_str] = tags

    for tag in tags:
        _all_tags.setdefault(tag, []).append(path_str)

    for target in links:
        _backlinks.setdefault(target.lower(), []).append(path_str)

    return {"action": "updated", "path": path_str, "links": len(links), "tags": len(tags)}


def get_backlinks(note_name: str) -> list[dict[str, Any]]:
    """Get all notes that link to the given note name, with context."""
    source_paths = _backlinks.get(note_name.lower(), [])
    results = []

    for src_path in source_paths:
        contexts = extract_link_context(src_path, note_name)
        src = Path(src_path)
        results.append({
            "path": src_path,
            "name": src.stem,
            "contexts": contexts,
        })

    return results


def get_forward_links(file_path: str) -> list[dict[str, Any]]:
    """Get all outgoing links from a file, with resolved paths."""
    targets = _forward_links.get(file_path, [])
    results = []

    for target in targets:
        resolved = _resolve_link(target)
        results.append({
            "target": target,
            "resolved_path": resolved,
            "exists": resolved is not None,
        })

    return results


def get_all_note_names() -> list[dict[str, str]]:
    """Return all indexed note names and paths (for autocomplete)."""
    return [{"name": name, "path": path} for name, path in _note_names.items()]


def get_all_tags() -> dict[str, int]:
    """Return all tags with their note counts."""
    return {tag: len(paths) for tag, paths in _all_tags.items()}
