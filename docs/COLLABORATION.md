# Team Sharing Design (Future)

How notes, kanban boards, and stickies are designed today so that team sharing
(issue #21) can be added without a rewrite.

## Principle: files are the only source of truth

Every feature added in the July 2026 wave stores its data as plain files in the
vault or as per-device UI state — never in a private database:

| Feature | Where its data lives | Shareable? |
|---|---|---|
| Notes / preview-edit | Markdown files in the vault | Yes — sync the files |
| Pasted images | `attachments/*.png` binary files in the vault | Yes — sync the files |
| Kanban boards | Markdown files (`kanban: true` frontmatter) | Yes — sync the files |
| Sticky notes | Which notes are stickied + window geometry (localStorage) | No — deliberately per-device UI state |
| View mode / settings | localStorage | No — per-device preference |

Because everything shareable is a file, the sharing mechanism reduces to file
sync. The planned path is Git/GitHub sync (#21): commit the vault, pull/push,
and every feature above works for a team with zero changes to the features
themselves.

## Kanban and merge behavior

Boards are markdown by design:

- `## headings` are columns, `- [ ]` / `- [x]` items are cards — one line per
  card, so concurrent edits to different cards merge cleanly line-by-line in Git.
- All non-card content (frontmatter, prose between sections) is preserved
  verbatim by the parser (`src/lib/services/kanban.ts` round-trips losslessly),
  so hand edits and board edits can be mixed freely.
- Conflicts degrade to ordinary markdown conflicts, resolvable in any editor.
- Card identity is positional (no embedded IDs). If team usage later needs
  stable identity (comments, assignments), add an optional `^id` suffix per
  card line — the parser's raw-line preservation means old clients won't break.

## Attachments

Pasted images use timestamp-with-milliseconds filenames
(`pasted-YYYYMMDD-HHmmss-mmm.png`), making collisions between two users
effectively impossible without coordination.

## What team sharing will need (not yet built)

1. Sync transport — Git-based (#21): background commit/pull/push, or a
   sync server later. Nothing in the current data model prefers one.
2. Conflict UI — surface Git conflicts as "theirs/mine" note versions.
3. Identity — attributing card moves/edits would need an author field from Git
   history (free) or frontmatter.
4. Realtime presence — out of scope; file-sync model is eventual-consistency.
