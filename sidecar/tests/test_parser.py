"""Tests for the markdown parser."""

import tempfile
from pathlib import Path

from doc_md.parser import parse_note, extract_link_context


def _write_note(dir: Path, name: str, content: str) -> str:
    path = dir / f"{name}.md"
    path.write_text(content)
    return str(path)


def test_parse_wikilinks():
    with tempfile.TemporaryDirectory() as d:
        path = _write_note(Path(d), "test", "See [[foo]] and [[bar|Bar Note]].")
        result = parse_note(path)
        assert set(result["links"]) == {"foo", "bar"}


def test_parse_tags():
    with tempfile.TemporaryDirectory() as d:
        path = _write_note(Path(d), "test", "Hello #project and #notes/daily")
        result = parse_note(path)
        assert set(result["tags"]) == {"project", "notes/daily"}


def test_parse_frontmatter_tags():
    with tempfile.TemporaryDirectory() as d:
        content = "---\ntags:\n  - meta\n  - review\n---\nBody #inline"
        path = _write_note(Path(d), "test", content)
        result = parse_note(path)
        assert "meta" in result["tags"]
        assert "review" in result["tags"]
        assert "inline" in result["tags"]


def test_parse_frontmatter():
    with tempfile.TemporaryDirectory() as d:
        content = "---\ntitle: My Note\ndate: 2026-01-01\n---\n# Hello"
        path = _write_note(Path(d), "test", content)
        result = parse_note(path)
        assert result["frontmatter"]["title"] == "My Note"


def test_extract_link_context():
    with tempfile.TemporaryDirectory() as d:
        content = "Line 1\nLine 2\nSee [[target]] here\nLine 4\nLine 5"
        path = _write_note(Path(d), "test", content)
        contexts = extract_link_context(path, "target", context_lines=1)
        assert len(contexts) == 1
        assert "See [[target]] here" in contexts[0]
        assert "Line 2" in contexts[0]
        assert "Line 4" in contexts[0]


def test_nonexistent_file():
    result = parse_note("/nonexistent/path.md")
    assert "error" in result
