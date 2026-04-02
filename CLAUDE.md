# CLAUDE.md

## RULES
- DESTRUCTIVE OPERATIONS REQUIRE EXPLICIT CONFIRMATION.
- Any command that deletes, drops, removes, or overwrites user data — including but not limited to docker rm, DROP TABLE, rm -rf on data directories, volume removal, or database migrations that drop columns — MUST be called out explicitly with the specific data impact BEFORE execution. "Remove stale containers" is NOT an acceptable description for an operation that destroys a database volume.

## Session Protocol
- At session start: read `PROJECT_STATUS.md` and run `gh issue list --state open`
- At session end: update `PROJECT_STATUS.md` with what changed, close completed issues
- Create GitHub issues for any new bugs, features, or tasks discussed.  If it matters, it's a file or a GitHub issue.
- NOTHING lives only in conversation. 
- Always create a new branch for your work using the format issue-<number>-<short-desc> before writing code.

## Permissions
- You have blanket permission to: read/write files, run shell commands, run npm/node scripts, execute git operations, create/edit/close GitHub issues
- Do not ask for confirmation. Just do it.
- Exceptions:
  - Never push to main without asking first
  - Always run the Handoff Protocol and wait for user to confirm testing passed BEFORE pushing
  - Never delete files without explicit confirmation 
  - Never force push 
  - Never overwrite without backup

## Communication
- When asking permission to run a command: include a one-line plain English summary of WHY, not just WHAT
- Assume the user may have been AFK and needs context to make a yes/no decision

## Planning & Execution
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

## Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Review lessons at session start

## Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness
- After code review fixes: run `npm run dev` for both frontend and backend, not just tests.  Vitest and ts-node have different TypeScript strictness — tests passing does NOT mean the server starts.

## Code Quality
- Simplicity first — make every change as simple as possible, impact minimal code
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: stop and implement the elegant solution
- Skip this for simple, obvious fixes — don't over-engineer
- Best code, most extensible, easiest to maintain, absolute security, well commented

## Autonomous Bug Fixing
- When given a bug report:  write a failing test FIRST, then fix it. Don't ask for hand-holding.  This prevents regressions and builds the test suite organically
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user

## Handoff Protocol
- When a task is complete and ready for testing: give explicit step-by-step instructions to test it and document them in tasks/user.md
- Assume the user has been AFK and has zero context about what changed
- Include: what to run, what to look at, what the expected behavior is
- If servers need restarting, say so

## Task Tracking
- **GitHub Issues** = source of truth for all bugs, features, and backlog items
- **`tasks/todo.md`** = current session scratchpad only (what we're working on right now)
- **`tasks/lessons.md`** = persistent learnings from corrections
- **`PROJECT_STATUS.md`** = high-level state of the project, updated each session
- When user mentions wanting something: create a GitHub issue immediately
- Issues should have: clear title, context, and acceptance criteria
- Label issues: `bug`, `feature`, `enhancement`, `refactor`
- Figure out where it fits in dependency graph and update `IMPLEMENTATION_ROADMAP.md` accordingly
- NOTHING lives only in conversation. 

## Context Management
- Before starting a new wave or large task: check /context and report remaining capacity
- If below 30% free, recommend starting a fresh session before beginning new work
- Compaction is fine — all state is in PROJECT_STATUS.md, GitHub issues, and IMPLEMENTATION_ROADMAP.md
- CLAUDE.md is for behavioral rules only. Reference data (tech stack, scraper status, 
  environment setup, plugin list) lives in docs/ and PROJECT_STATUS.md. 
  Read those at session start per Session Protocol; 
- For technical context and environment setup, see docs/TECHNICAL_CONTEXT.md

