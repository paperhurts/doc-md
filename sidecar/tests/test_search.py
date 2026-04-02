"""Tests for full-text search."""

import tempfile
from pathlib import Path

from doc_md.search import build_search_index, search, update_search_index


def _make_vault(dir: Path, notes: dict[str, str]) -> None:
    for name, content in notes.items():
        (dir / f"{name}.md").write_text(content)


def test_build_and_search():
    with tempfile.TemporaryDirectory() as d:
        vault = Path(d)
        _make_vault(vault, {
            "note-a": "# Alpha\n\nThis note discusses quantum computing and algorithms.",
            "note-b": "# Beta\n\nThis note is about machine learning and neural networks.",
            "note-c": "# Gamma\n\nQuantum mechanics and physics fundamentals.",
        })
        result = build_search_index(str(vault))
        assert result["indexed"] == 3

        hits = search(str(vault), "quantum")
        assert len(hits) >= 2
        paths = {h["path"] for h in hits}
        assert str(vault / "note-a.md") in paths
        assert str(vault / "note-c.md") in paths


def test_search_by_title():
    with tempfile.TemporaryDirectory() as d:
        vault = Path(d)
        _make_vault(vault, {
            "note-a": "# Important Meeting Notes\n\nDiscussed project timeline.",
            "note-b": "# Random Thoughts\n\nSome daily reflections.",
        })
        build_search_index(str(vault))

        hits = search(str(vault), "meeting")
        assert len(hits) >= 1
        assert "note-a" in hits[0]["path"]


def test_search_snippets():
    with tempfile.TemporaryDirectory() as d:
        vault = Path(d)
        _make_vault(vault, {
            "note-a": "# Test\n\nThe quick brown fox jumps over the lazy dog.",
        })
        build_search_index(str(vault))

        hits = search(str(vault), "fox")
        assert len(hits) == 1
        assert hits[0]["snippet"]  # Should have a highlight snippet


def test_incremental_update():
    with tempfile.TemporaryDirectory() as d:
        vault = Path(d)
        _make_vault(vault, {"note-a": "# Original\n\nOriginal content about cats."})
        build_search_index(str(vault))

        # Update the file
        (vault / "note-a.md").write_text("# Updated\n\nNew content about dogs.")
        update_search_index(str(vault), str(vault / "note-a.md"))

        hits = search(str(vault), "dogs")
        assert len(hits) == 1

        hits = search(str(vault), "cats")
        assert len(hits) == 0


def test_empty_query():
    with tempfile.TemporaryDirectory() as d:
        vault = Path(d)
        _make_vault(vault, {"note-a": "Some content"})
        build_search_index(str(vault))

        hits = search(str(vault), "")
        assert hits == []


def test_search_limit():
    with tempfile.TemporaryDirectory() as d:
        vault = Path(d)
        notes = {f"note-{i}": f"# Note {i}\n\nCommon keyword here." for i in range(10)}
        _make_vault(vault, notes)
        build_search_index(str(vault))

        hits = search(str(vault), "common keyword", limit=3)
        assert len(hits) <= 3
