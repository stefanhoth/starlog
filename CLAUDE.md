# Starlog — Claude Instructions

## Running E2E Tests

Use the right script for your environment:

| Environment | Command | Notes |
|-------------|---------|-------|
| Local (Docker required) | `npm run test:e2e` | Runs inside `mcr.microsoft.com/playwright:v1.60.0-noble` — mirrors CI exactly |
| Claude Code cloud session | `npm run test:e2e:cloud` | Installs Chromium into `/opt/pw-browsers` and runs tests directly — no Docker needed |

Cloud sessions are ephemeral so `test:e2e:cloud` self-installs the correct browser on every run.
