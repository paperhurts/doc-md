"""Tests for the link indexer."""

import tempfile
from pathlib import Path

from doc_md.indexer import (
    index_vault,
    index_file,
    get_backlinks,
    get_forward_links,
    get_all_note_names,
    get_all_tags,
    get_graph_data,
)


def _make_vault(dir: Path, notes: dict[str, str]) -> None:
    for name, content in notes.items():
        (dir / f"{name}.md").write_text(content)


def test_index_vault():
    with tempfile.TemporaryDirectory() as d:
        vault = Path(d)
        _make_vault(vault, {
            "note-a": "Links to [[note-b]] and [[note-c]].",
            "note-b": "Links back to [[note-a]].",
            "note-c": "No links here.",
        })
        result = index_vault(str(vault))
        assert result["notes_indexed"] == 3
        assert result["total_links"] == 3


def test_backlinks():
    with tempfile.TemporaryDirectory() as d:
        vault = Path(d)
        _make_vault(vault, {
            "note-a": "See [[note-b]] for details.",
            "note-b": "This is note B.",
            "note-c": "Also references [[note-b]].",
        })
        index_vault(str(vault))

        backlinks = get_backlinks("note-b")
        source_names = {bl["name"] for bl in backlinks}
        assert source_names == {"note-a", "note-c"}


def test_backlinks_with_context():
    with tempfile.TemporaryDirectory() as d:
        vault = Path(d)
        _make_vault(vault, {
            "daily": "Today I worked on [[project]].\nIt went well.",
            "project": "# Project notes",
        })
        index_vault(str(vault))

        backlinks = get_backlinks("project")
        assert len(backlinks) == 1
        assert "worked on [[project]]" in backlinks[0]["contexts"][0]


def test_forward_links():
    with tempfile.TemporaryDirectory() as d:
        vault = Path(d)
        _make_vault(vault, {
            "note-a": "See [[note-b]] and [[nonexistent]].",
            "note-b": "Hello.",
        })
        index_vault(str(vault))

        links = get_forward_links(str(vault / "note-a.md"))
        targets = {l["target"] for l in links}
        assert targets == {"note-b", "nonexistent"}

        resolved = {l["target"]: l["exists"] for l in links}
        assert resolved["note-b"] is True
        assert resolved["nonexistent"] is False


def test_incremental_index():
    with tempfile.TemporaryDirectory() as d:
        vault = Path(d)
        _make_vault(vault, {
            "note-a": "See [[note-b]].",
            "note-b": "Hello.",
        })
        index_vault(str(vault))

        # Add a new link
        (vault / "note-a.md").write_text("See [[note-b]] and [[note-c]].")
        index_file(str(vault / "note-a.md"))

        links = get_forward_links(str(vault / "note-a.md"))
        targets = {l["target"] for l in links}
        assert "note-c" in targets


def test_all_note_names():
    with tempfile.TemporaryDirectory() as d:
        vault = Path(d)
        _make_vault(vault, {"alpha": "A", "beta": "B"})
        index_vault(str(vault))

        names = get_all_note_names()
        name_set = {n["name"] for n in names}
        assert "alpha" in name_set
        assert "beta" in name_set


def test_tags():
    with tempfile.TemporaryDirectory() as d:
        vault = Path(d)
        _make_vault(vault, {
            "note-a": "Tags: #project #daily",
            "note-b": "Tags: #project",
        })
        index_vault(str(vault))

        tags = get_all_tags()
        assert tags["project"] == 2
        assert tags["daily"] == 1


def test_graph_data():
    with tempfile.TemporaryDirectory() as d:
        vault = Path(d)
        _make_vault(vault, {
            "note-a": "Links to [[note-b]] and [[note-c]].",
            "note-b": "Links back to [[note-a]].",
            "note-c": "No links here.",
        })
        index_vault(str(vault))

        graph = get_graph_data()
        assert len(graph["nodes"]) == 3
        assert len(graph["edges"]) == 3  # a->b, a->c, b->a

        labels = {n["label"] for n in graph["nodes"]}
        assert labels == {"note-a", "note-b", "note-c"}
