# Changelog

All notable changes to this project will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [CalVer](https://calver.org/) — `YYYY.MM.DD[.N]`

## [Unreleased](https://github.com/stefanhoth/starlog/compare/2026.05.20.14...HEAD) - 2026-05-20

- fix: use version-aware sort for CalVer tags (&gt; 9 releases per day) [`#37`](https://github.com/stefanhoth/starlog/pull/37)
- chore: backfill CHANGELOG.md and automate updates via auto-changelog (#35) [`#36`](https://github.com/stefanhoth/starlog/pull/36)

## [2026.05.20.14](https://github.com/stefanhoth/starlog/compare/2026.05.20.13...2026.05.20.14) - 2026-05-20

- fix: correct STAR field order on Review screen (#24) [`#32`](https://github.com/stefanhoth/starlog/pull/32)

## [2026.05.20.13](https://github.com/stefanhoth/starlog/compare/2026.05.20.12...2026.05.20.13) - 2026-05-20

- feat: add competency inspiration prompts to Capture screen (#28) [`#34`](https://github.com/stefanhoth/starlog/pull/34)

## [2026.05.20.12](https://github.com/stefanhoth/starlog/compare/2026.05.20.11...2026.05.20.12) - 2026-05-20

- feat: show CalVer version in sidebar footer linked to GitHub Releases (#23) [`#33`](https://github.com/stefanhoth/starlog/pull/33)

## [2026.05.20.11](https://github.com/stefanhoth/starlog/compare/2026.05.20.10...2026.05.20.11) - 2026-05-20

- fix(gemini): add anti-hallucination instruction for sparse action steps [`#19`](https://github.com/stefanhoth/starlog/pull/19)

## [2026.05.20.10](https://github.com/stefanhoth/starlog/compare/2026.05.20.9...2026.05.20.10) - 2026-05-20

- fix(library): remove stale `as any` cast from navigate call [`#18`](https://github.com/stefanhoth/starlog/pull/18)

## [2026.05.20.9](https://github.com/stefanhoth/starlog/compare/2026.05.20.8...2026.05.20.9) - 2026-05-20

- ci: update only the oldest open PR branch per main push [`#31`](https://github.com/stefanhoth/starlog/pull/31)

## [2026.05.20.8](https://github.com/stefanhoth/starlog/compare/2026.05.20.7...2026.05.20.8) - 2026-05-20

- ci: rebase PR branches onto main instead of merge-committing [`#30`](https://github.com/stefanhoth/starlog/pull/30)

## [2026.05.20.7](https://github.com/stefanhoth/starlog/compare/2026.05.20.6...2026.05.20.7) - 2026-05-20

- fix(ci): remove --expected-head-sha — not supported by gh CLI [`#29`](https://github.com/stefanhoth/starlog/pull/29)

## [2026.05.20.6](https://github.com/stefanhoth/starlog/compare/2026.05.20.5...2026.05.20.6) - 2026-05-20

- fix(interview): constrain story card to max-w-3xl for readable line length [`#17`](https://github.com/stefanhoth/starlog/pull/17)

## [2026.05.20.5](https://github.com/stefanhoth/starlog/compare/2026.05.20.4...2026.05.20.5) - 2026-05-20

- fix(library): quality dot aria-label and persistent legend [`#20`](https://github.com/stefanhoth/starlog/pull/20)

## [2026.05.20.4](https://github.com/stefanhoth/starlog/compare/2026.05.20.3...2026.05.20.4) - 2026-05-20

- ci: auto-update open PR branches when main advances [`#26`](https://github.com/stefanhoth/starlog/pull/26)

## [2026.05.20.3](https://github.com/stefanhoth/starlog/compare/2026.05.20.2...2026.05.20.3) - 2026-05-20

- feat(story-detail): click-to-edit for all story fields [`#22`](https://github.com/stefanhoth/starlog/pull/22)

## [2026.05.20.2](https://github.com/stefanhoth/starlog/compare/2026.05.20.1...2026.05.20.2) - 2026-05-20

- fix(ux): rename Rank to Strength in story card and detail view [`#21`](https://github.com/stefanhoth/starlog/pull/21)

## [2026.05.20.1](https://github.com/stefanhoth/starlog/compare/2026.05.20...2026.05.20.1) - 2026-05-20

- feat: clear all data — Danger Zone with confirmation modal [`#16`](https://github.com/stefanhoth/starlog/pull/16)

## 2026.05.20

- fix: add actions/configure-pages before deploy [`#15`](https://github.com/stefanhoth/starlog/pull/15)
- feat: auto-deploy to GitHub Pages with CalVer release tags [`#14`](https://github.com/stefanhoth/starlog/pull/14)
- ci: use pre-baked Playwright container to skip browser install [`#13`](https://github.com/stefanhoth/starlog/pull/13)
- ci: skip e2e job on post-merge pushes to main [`#12`](https://github.com/stefanhoth/starlog/pull/12)
- chore: trigger CI via PR to register status checks for branch protection [`#9`](https://github.com/stefanhoth/starlog/pull/9)
