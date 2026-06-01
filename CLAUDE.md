# Starlog — Claude Instructions

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

## What's New Changelog

When opening a new PR or creating a GitHub issue for a user-facing change, check whether the What's New changelog (`src/lib/changelog.ts`) should be updated. If the change introduces a new feature, a notable improvement, or a fix that users would care about, ask the user if they want to add an entry before finalising the PR.
