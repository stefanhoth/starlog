# OG Image — Designer Handoff

This document describes the current state of the StarLog OG share image and what still needs refinement before shipping.

## Current result

`public/og-image.png` — 1200 × 630 px PNG, generated via `scripts/generate-og-image.cjs`.

See the latest render in this PR or run the script locally (instructions below).

## How to generate the image

```bash
# Install Chromium if not already present
npx playwright install chromium

# Generate — writes to public/og-image.png
node scripts/generate-og-image.cjs
```

In a Claude Code cloud session (no Docker):
```bash
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/generate-og-image.cjs
```

## Design tokens (quick edits)

All design-relevant values are at the top of `scripts/generate-og-image.cjs`:

| Token | Current value | What it controls |
|---|---|---|
| `BRAND_COLOR_LOG` | `#8f74db` | Colour of "Log" in the brand name |
| `HIGHLIGHT_COLOR` | `#fde047` | Colour of "powerful stories." |
| `BG_GRADIENT` | `linear-gradient(…)` | Full background gradient |

For layout, typography, or structural changes, edit the `html` template string directly in the script — it's plain HTML + CSS.

## Layout structure

```
┌─────────────────────────────────────┐  630px
│  [80px safe zone on all sides]      │
│                                     │
│  ⭐ StarLog          ← brand row    │
│                                     │
│  Your experience,                   │
│  shaped into powerful stories.      │  ← headline (62px)
│                                     │
│  [📝 Log] → [⭐ Structure] → [🎯 Nail]│  ← steps strip
│                                     │
└─────────────────────────────────────┘ 1200px
```

## What's still rough — things to refine

These were identified during the design iteration but left open intentionally:

1. **Typography** — System font stack is used (`-apple-system, Segoe UI, Inter`). A proper web font (Inter or similar via Google Fonts CDN) would sharpen the rendering, especially at the headline size.

2. **Headline line-break** — "Your experience," / "shaped into powerful stories." breaks manually at a fixed point. Needs a check that it still looks right if the tagline ever changes.

3. **Steps strip contrast** — Background is `rgba(255,255,255,0.08)` — subtle. At lower screen brightness or after JPEG compression (WhatsApp etc.) the strip may disappear into the background. Consider a slightly stronger fill or a visible top/bottom border accent.

4. **Triangle separators** — CSS border-trick triangles at `rgba(255,255,255,0.7)`. Could be crisper as an inline SVG `<polygon>`.

5. **Step text size** — Step labels are 24px, below the recommended 40px minimum for feeds at 500px width. Either increase size or accept that the steps are a secondary detail (the headline is the primary message).

6. **"Log" accent colour** — `#8f74db` is the same purple used in the app brand. Looks correct but hasn't been evaluated against the dark gradient at different screen calibrations.

7. **Mobile preview** — Mentally simulate the image at ~500px width (how it renders in a Twitter/WhatsApp feed). The headline should survive; the steps strip will be very small.

8. **WhatsApp / square variant** — Some platforms prefer 1200 × 1200. Not implemented yet. The script could be extended with a `--square` flag.

## Spec reference

- Format: PNG, 1200 × 630, < 1 MB
- Safe zone: 80 px all sides
- Headline font size: 48–64 px minimum
- Platforms: Facebook, Twitter/X (crops ±15 px top/bottom), LinkedIn, WhatsApp
- Validate before shipping: https://opengraphdebug.com · https://developers.facebook.com/tools/debug
