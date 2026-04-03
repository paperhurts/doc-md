"""Link index: builds and queries forward links and backlinks across a vault."""

import logging
import os
from pathlib import Path
from typing import Any

from doc_md.parser import parse_note, extract_link_context

logger = logging.getLogger(__name__)


class LinkIndex:
    """Encapsulates the in-memory link/tag index for a vault."""

    def __init__(self) -> None:
        self.forward_links: dict[str, list[str]] = {}   # note path -> [target names]
        self.backlinks: dict[str, list[str]] = {}        # lowercase target name -> [source paths]
        self.note_names: dict[str, str] = {}             # lowercase name -> path
        self.note_tags: dict[str, list[str]] = {}        # note path -> [tags]
        self.all_tags: dict[str, list[str]] = {}         # tag -> [note paths]

    def clear(self) -> None:
        """Reset all index state. Useful for test isolation."""
        self.forward_links.clear()
        self.backlinks.clear()
        self.note_names.clear()
        self.note_tags.clear()
        self.all_tags.clear()

    def _resolve_link(self, target: str) -> str | None:
        """Resolve a wiki-link target to a file path."""
        return self.note_names.get(target.lower())

    def index_vault(self, vault_path: str) -> dict[str, Any]:
        """Scan all markdown files in a vault and build the link index."""
        self.clear()

        vault = Path(vault_path)
        if not vault.is_dir():
            return {"error": f"Not a directory: {vault_path}"}

        md_files: list[Path] = []
        for root, dirs, files in os.walk(vault):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("node_modules", "target")]
            for f in files:
                if f.endswith((".md", ".markdown")):
                    md_files.append(Path(root) / f)

        # First pass: register all note names
        for path in md_files:
            key = path.stem.lower()
            if key in self.note_names:
                logger.warning("Name collision: '%s' maps to both %s and %s",
                               key, self.note_names[key], str(path))
            self.note_names[key] = str(path)

        # Second pass: parse links and tags
        for path in md_files:
            path_str = str(path)
            parsed = parse_note(path_str)
            if "error" in parsed:
                continue

            links = parsed.get("links", [])
            tags = parsed.get("tags", [])

            self.forward_links[path_str] = links
            self.note_tags[path_str] = tags

            for tag in tags:
                self.all_tags.setdefault(tag, []).append(path_str)

            for target in links:
                self.backlinks.setdefault(target.lower(), []).append(path_str)

        return {
            "notes_indexed": len(md_files),
            "total_links": sum(len(v) for v in self.forward_links.values()),
            "total_tags": len(self.all_tags),
        }

    def index_file(self, file_path: str) -> dict[str, Any]:
        """Re-index a single file (after it's been modified)."""
        path = Path(file_path)
        path_str = str(path)

        if not path.exists():
            # File was deleted — remove from index
            self.forward_links.pop(path_str, None)
            old_name = path.stem.lower()
            if self.note_names.get(old_name) == path_str:
                self.note_names.pop(old_name, None)
            for targets in self.backlinks.values():
                if path_str in targets:
                    targets.remove(path_str)
            for tag_paths in self.all_tags.values():
                if path_str in tag_paths:
                    tag_paths.remove(path_str)
            self.note_tags.pop(path_str, None)
            return {"action": "removed", "path": path_str}

        # Update name registry
        self.note_names[path.stem.lower()] = path_str

        # Remove old backlink entries for this file
        for targets in self.backlinks.values():
            if path_str in targets:
                targets.remove(path_str)
        for tag_paths in self.all_tags.values():
            if path_str in tag_paths:
                tag_paths.remove(path_str)

        # Re-parse
        parsed = parse_note(path_str)
        if "error" in parsed:
            return parsed

        links = parsed.get("links", [])
        tags = parsed.get("tags", [])

        self.forward_links[path_str] = links
        self.note_tags[path_str] = tags

        for tag in tags:
            self.all_tags.setdefault(tag, []).append(path_str)

        for target in links:
            self.backlinks.setdefault(target.lower(), []).append(path_str)

        return {"action": "updated", "path": path_str, "links": len(links), "tags": len(tags)}

    def get_backlinks(self, note_name: str) -> list[dict[str, Any]]:
        """Get all notes that link to the given note name, with context."""
        source_paths = self.backlinks.get(note_name.lower(), [])
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

    def get_forward_links(self, file_path: str) -> list[dict[str, Any]]:
        """Get all outgoing links from a file, with resolved paths."""
        targets = self.forward_links.get(file_path, [])
        results = []

        for target in targets:
            resolved = self._resolve_link(target)
            results.append({
                "target": target,
                "resolved_path": resolved,
                "exists": resolved is not None,
            })

        return results

    def get_all_note_names(self) -> list[dict[str, str]]:
        """Return all indexed note names and paths (for autocomplete)."""
        return [{"name": name, "path": path} for name, path in self.note_names.items()]

    def get_all_tags(self) -> dict[str, int]:
        """Return all tags with their note counts."""
        return {tag: len(paths) for tag, paths in self.all_tags.items()}

    def get_graph_data(self) -> dict[str, Any]:
        """Return nodes and edges for the graph view."""
        nodes = []
        node_ids: set[str] = set()

        for name, path in self.note_names.items():
            link_count = len(self.forward_links.get(path, [])) + len(self.backlinks.get(name, []))
            nodes.append({"id": path, "label": Path(path).stem, "links": link_count})
            node_ids.add(path)

        edges = []
        for source_path, targets in self.forward_links.items():
            if source_path not in node_ids:
                continue
            for target in targets:
                resolved = self._resolve_link(target)
                if resolved and resolved in node_ids:
                    edges.append({"source": source_path, "target": resolved})

        return {"nodes": nodes, "edges": edges}


# Module-level singleton — keeps existing RPC registrations working
_index = LinkIndex()


def index_vault(vault_path: str) -> dict[str, Any]:
    return _index.index_vault(vault_path)

def index_file(file_path: str) -> dict[str, Any]:
    return _index.index_file(file_path)

def get_backlinks(note_name: str) -> list[dict[str, Any]]:
    return _index.get_backlinks(note_name)

def get_forward_links(file_path: str) -> list[dict[str, Any]]:
    return _index.get_forward_links(file_path)

def get_all_note_names() -> list[dict[str, str]]:
    return _index.get_all_note_names()

def get_all_tags() -> dict[str, int]:
    return _index.get_all_tags()

def get_graph_data() -> dict[str, Any]:
    return _index.get_graph_data()
