# Lessons Learned

Persistent learnings from corrections. Review at session start.

---

## 2026-04-02: Update README on refactors
- When refactoring, fixing bugs, or changing architecture, update the README/docs
- User added rule to CLAUDE.md: "if you refactor, fix bugs, change architecture, update readme file"
- Don't wait for the user to ask — docs should stay in sync with code changes

## 2026-04-03: Always update docs after merging
- After merging a PR that completes a phase or adds features, immediately update PLAN.md, PROJECT_STATUS.md, and README.md
- Don't wait for the user to remind you — it's part of the merge workflow

## 2026-04-03: Docs are part of done — no exceptions

Before marking ANY task complete, ask: "If someone cloned this repo 
right now, would the docs accurately describe what they'd find?"

If no → update docs first, THEN mark done. No exceptions for "small" 
fixes, "just" bug fixes, or "obvious" changes. Small lies in docs 
compound into big confusion.