# STARlog — Claude Instructions

## Test Strategy: Unit Tests vs E2E Tests

**Default to unit tests (Vitest, `npm run test:unit`) for pure logic.** They run in milliseconds with no browser or network overhead and are the right home for any function that has no DOM, IDB, or browser-API dependency.

Use a unit test when the code under test:
- Is a pure function (parsing, validation, formatting, sorting, transformation)
- Can be imported directly in a Node environment
- Has many input permutations worth testing exhaustively

Use a Playwright E2E test (`npm run test:e2e` / `test:e2e:cloud`) only when you need:
- A real browser (actual DOM rendering, CSS, focus behaviour)
- Real IndexedDB (persistence, store reads/writes across page loads)
- The full user flow across multiple views or navigations
- File picker / clipboard / download interactions

**Practical rule:** if you can call the function directly in a `.test.ts` file and assert on its return value or thrown error, write a unit test. Reserve E2E tests for the happy-path smoke test that proves the UI wires everything together. Do not duplicate pure-logic coverage in both layers — unit tests are ~100× faster and don't need Docker or a Chromium install.

## Running E2E Tests

Use the right script for your environment:

| Environment | Command | Notes |
|-------------|---------|-------|
| Local (Docker required) | `npm run test:e2e` | Runs inside `mcr.microsoft.com/playwright:v1.60.0-noble` — mirrors CI exactly |
| Claude Code cloud session | `npm run test:e2e:cloud` | Installs Chromium into `/opt/pw-browsers` and runs tests directly — no Docker needed |

Cloud sessions are ephemeral so `test:e2e:cloud` self-installs the correct browser on every run.

## Specialist Agents

This repo defines specialist agents in `.claude/agents/`. Their full descriptions live in those files (the single source of truth — don't duplicate them here). Consult the relevant agent proactively when work touches its lane, and fan out across the relevant ones before merging a non-trivial change. All are read-only advisors **except** `test-engineer`, which writes and runs tests.

| Agent | Consult when work touches… |
|-------|----------------------------|
| `product-manager` | product vision, scope/prioritisation, UX consistency, focus |
| `product-designer` | UI and user flows, feedback states, accessibility, perceived performance |
| `ai-engineer` | Gemini prompts, structured-output reliability, model choice, AI output quality |
| `security-advisor` | API-key handling, user-data safety, the local-only privacy promise |
| `senior-engineer` | architecture, Svelte 5 idioms, IndexedDB migrations, maintainability |
| `test-engineer` | test coverage and strategy (writes & runs Playwright tests) |

## PR Workflow

For every ticket, follow this sequence exactly:

1. `git fetch origin main` — get the latest before starting.
2. Start work on a branch based on the fetched `origin/main`.
3. Develop and run the full test suite until green.
4. `git fetch origin main && git rebase origin/main` — rebase *immediately before pushing* to ensure the branch is up to date (branches behind main block merging on GitHub).
5. `git push -u origin <branch>` — push the rebased branch.
6. `gh pr create` — open the PR.
7. Ask Stefan: **"Manual review or auto-merge?"**

**Never stop after step 3 and ask "should I open a PR?"** — assume yes, always.

## MCP Tool Parameters

Never wrap MCP tool parameter values in shell heredoc syntax (`$(cat <<'EOF'...EOF)`). That syntax is only meaningful in a shell — passed as a JSON parameter value it appears literally in the output (PR body, issue body, etc.). Always pass text directly as the parameter string.

## What's New Changelog

When opening a new PR or creating a GitHub issue for a user-facing change, check whether the What's New changelog (`src/lib/changelog.ts`) should be updated. If the change introduces a new feature, a notable improvement, or a fix that users would care about, ask the user if they want to add an entry before finalising the PR.
