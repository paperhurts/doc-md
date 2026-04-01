"""Full-text search using Whoosh."""

import os
import tempfile
from pathlib import Path
from typing import Any

from whoosh import index as whoosh_index
from whoosh.fields import Schema, TEXT, ID, STORED
from whoosh.qparser import MultifieldParser, OrGroup
from whoosh.analysis import StemmingAnalyzer
from whoosh.highlight import ContextFragmenter, HtmlFormatter

_schema = Schema(
    path=ID(stored=True, unique=True),
    name=STORED(),
    title=TEXT(stored=True, analyzer=StemmingAnalyzer()),
    content=TEXT(stored=True, analyzer=StemmingAnalyzer()),
)

_ix: whoosh_index.Index | None = None
_index_dir: str | None = None


def _get_or_create_index(vault_path: str) -> whoosh_index.Index:
    global _ix, _index_dir

    cache_dir = os.path.join(vault_path, ".doc-md", "search-index")
    os.makedirs(cache_dir, exist_ok=True)

    if _ix is not None and _index_dir == cache_dir:
        return _ix

    if whoosh_index.exists_in(cache_dir):
        _ix = whoosh_index.open_dir(cache_dir)
    else:
        _ix = whoosh_index.create_in(cache_dir, _schema)

    _index_dir = cache_dir
    return _ix


def build_search_index(vault_path: str) -> dict[str, Any]:
    """Build or rebuild the full-text search index for a vault."""
    global _ix, _index_dir

    vault = Path(vault_path)
    if not vault.is_dir():
        return {"error": f"Not a directory: {vault_path}"}

    # Recreate index from scratch to clear old data
    cache_dir = os.path.join(vault_path, ".doc-md", "search-index")
    os.makedirs(cache_dir, exist_ok=True)
    _ix = whoosh_index.create_in(cache_dir, _schema)
    _index_dir = cache_dir
    ix = _ix
    writer = ix.writer()

    count = 0
    for root, dirs, files in os.walk(vault):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("node_modules", "target")]
        for f in files:
            if f.endswith((".md", ".markdown")):
                path = Path(root) / f
                try:
                    content = path.read_text(encoding="utf-8", errors="replace")
                    # Extract title from first heading or filename
                    title = path.stem
                    for line in content.split("\n"):
                        line = line.strip()
                        if line.startswith("# "):
                            title = line[2:].strip()
                            break

                    writer.add_document(
                        path=str(path),
                        name=path.name,
                        title=title,
                        content=content,
                    )
                    count += 1
                except Exception:
                    continue

    writer.commit()
    return {"indexed": count}


def update_search_index(vault_path: str, file_path: str) -> dict[str, Any]:
    """Update the search index for a single file."""
    ix = _get_or_create_index(vault_path)
    writer = ix.writer()
    path = Path(file_path)

    # Delete old entry
    writer.delete_by_term("path", str(path))

    if path.exists():
        try:
            content = path.read_text(encoding="utf-8", errors="replace")
            title = path.stem
            for line in content.split("\n"):
                line = line.strip()
                if line.startswith("# "):
                    title = line[2:].strip()
                    break

            writer.add_document(
                path=str(path),
                name=path.name,
                title=title,
                content=content,
            )
            writer.commit()
            return {"action": "updated", "path": str(path)}
        except Exception as e:
            writer.commit()
            return {"error": str(e)}
    else:
        writer.commit()
        return {"action": "removed", "path": str(path)}


def search(vault_path: str, query: str, limit: int = 20) -> list[dict[str, Any]]:
    """Search the vault for a query string. Returns ranked results with snippets."""
    if not query.strip():
        return []

    ix = _get_or_create_index(vault_path)

    parser = MultifieldParser(["title", "content"], schema=ix.schema, group=OrGroup)
    parsed = parser.parse(query)

    results = []
    with ix.searcher() as searcher:
        hits = searcher.search(parsed, limit=limit)
        hits.fragmenter = ContextFragmenter(maxchars=200, surround=50)
        hits.formatter = HtmlFormatter(tagname="mark")

        for hit in hits:
            snippet = hit.highlights("content", top=3) or ""
            results.append({
                "path": hit["path"],
                "title": hit["title"],
                "snippet": snippet,
                "score": round(hit.score, 2),
            })

    return results
