/**
 * OG image generator for StarLog.
 *
 * Renders the share images at three aspect ratios using Playwright/Chromium:
 *   public/og-image.png         1200×630   — primary (Facebook, LinkedIn, generic)
 *   public/og-image-square.png  1200×1200  — WhatsApp, Instagram, iMessage
 *   public/og-image-slim.png    1200×600   — Twitter / X (2:1, safe-cropped)
 *
 * The HTML template is self-contained — the brand icon is embedded as base64.
 * Web fonts (Plus Jakarta Sans + Space Grotesk) are loaded from Google Fonts;
 * the render waits for `document.fonts.ready` so glyph metrics are correct.
 *
 * Usage:
 *   node scripts/generate-og-image.cjs            # all three formats
 *   node scripts/generate-og-image.cjs landscape  # one format only
 *
 * Requirements:
 *   - @playwright/test must be installed (it is — used by the test suite)
 *   - Chromium browser: `npx playwright install chromium`
 *     In CI / cloud sessions: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright install chromium`
 *
 * Design tokens (edit here to iterate):
 *   BRAND_COLOR_LOG  — colour of "log" in the brand name
 *   HIGHLIGHT_COLOR  — colour of the highlighted tagline word(s)
 *   BG_GRADIENT      — CSS background value for the body
 *   HEADLINE         — tagline; wrap the emphasised phrase in **double asterisks**
 *   SUBLINE          — single supporting line
 *   STEPS            — the three workflow steps (label + sub)
 */

const { chromium } = require('@playwright/test');
const { writeFileSync, readFileSync } = require('fs');
const { resolve } = require('path');

const ICON_PATH = resolve(__dirname, '../public/icons/icon-192.png');
const logoSrc = `data:image/png;base64,${readFileSync(ICON_PATH).toString('base64')}`;

// ── Design tokens ────────────────────────────────────────────────────────────
const BRAND_COLOR_LOG = '#8f74db';
const HIGHLIGHT_COLOR  = '#fde047';
const BG_GRADIENT      = 'linear-gradient(140deg, #0a0014 0%, #1a0a3c 55%, #2d1060 100%)';

const HEADLINE = 'Your experience, shaped into **powerful stories.**';
const SUBLINE  = 'Privacy-first. No server. No account.';
const STEPS = [
  { n: 1, accent: '#a78bfa', label: 'Log it',       sub: 'Capture your experiences' },
  { n: 2, accent: '#fde047', label: 'Structure it', sub: 'Shape each STAR story' },
  { n: 3, accent: '#f59e0b', label: 'Nail it',      sub: 'Ace your next interview' },
];

const FORMATS = {
  landscape: { file: 'og-image.png',        width: 1200, height: 630  },
  square:    { file: 'og-image-square.png', width: 1200, height: 1200 },
  slim:      { file: 'og-image-slim.png',   width: 1200, height: 600  },
};
// ─────────────────────────────────────────────────────────────────────────────

/** Render the brand wordmark — "STAR" white, "log" in brand purple. */
function brandHtml() {
  return `<div class="brand">
      <img src="${logoSrc}" alt="StarLog" />
      <div class="brand-name"><span class="mark-star">STAR</span><span class="brand-tail">log</span></div>
    </div>`;
}

/** Headline: **phrase** is highlighted; a line break is inserted after the first comma. */
function headlineHtml(text) {
  const segs = String(text).split('**');
  let brDone = false;
  return segs
    .map((seg, i) => {
      if (i % 2 === 1) return `<span class="hl">${seg}</span>`;
      if (!brDone && seg.includes(',')) {
        brDone = true;
        const c = seg.indexOf(',');
        return `${seg.slice(0, c + 1)}<br>${seg.slice(c + 1)}`;
      }
      return seg;
    })
    .join('');
}

function ledeHtml() {
  return `<div class="v2-left">
      ${brandHtml()}
      <div class="v2-head">${headlineHtml(HEADLINE)}</div>
      <div class="v2-sub">${SUBLINE}</div>
    </div>`;
}

function timelineHtml() {
  const steps = STEPS.map(
    (s) => `<div class="v2-step">
        <div class="v2-node" style="--accent:${s.accent}">${s.n}</div>
        <div>
          <div class="v2-txt-label">${s.label}</div>
          <div class="v2-txt-sub">${s.sub}</div>
        </div>
      </div>`
  ).join('');
  return `<div class="v2-right"><div class="v2-line"></div>${steps}</div>`;
}

function buildHtml(format) {
  const { width, height } = FORMATS[format];
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    font-family: 'Plus Jakarta Sans', -apple-system, 'Segoe UI', sans-serif;
    background: ${BG_GRADIENT};
    color: #fff;
    position: relative;
  }
  body::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 0% 0%, rgba(143,116,219,0.22) 0%, transparent 55%),
      radial-gradient(ellipse at 100% 100%, rgba(79,70,229,0.18) 0%, transparent 55%);
    pointer-events: none;
  }

  .safe {
    position: absolute;
    inset: 76px 84px;
    display: flex;
    flex-direction: row;
    gap: 64px;
    align-items: stretch;
    z-index: 1;
  }

  /* ── Brand ── */
  .brand { display: flex; align-items: center; gap: 16px; }
  .brand img { width: 64px; height: 64px; border-radius: 15px; display: block; }
  .brand-name { font-size: 46px; font-weight: 800; letter-spacing: -1.5px; line-height: 1; }
  .brand-name .mark-star { color: #fff; font-weight: 800; letter-spacing: -1px; }
  .brand-name .brand-tail { color: ${BRAND_COLOR_LOG}; }

  /* ── Lede ── */
  .v2-left { flex: 1.15; display: flex; flex-direction: column; justify-content: center; }
  .v2-head { font-size: 60px; font-weight: 700; line-height: 1.1; letter-spacing: -2px; margin-top: 34px; }
  .hl { color: ${HIGHLIGHT_COLOR}; font-weight: 800; white-space: nowrap; }
  .v2-sub { margin-top: 26px; font-size: 27px; font-weight: 500; color: rgba(255,255,255,0.72); line-height: 1.45; max-width: 480px; }

  /* ── Timeline ── */
  .v2-right { flex: 1; display: flex; flex-direction: column; justify-content: center; position: relative; }
  .v2-step { display: flex; align-items: center; gap: 22px; position: relative; padding: 18px 0; }
  .v2-node {
    width: 60px; height: 60px; border-radius: 50%;
    background: var(--accent); color: #0a0014;
    font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 26px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; z-index: 2;
    box-shadow: 0 0 0 6px rgba(255,255,255,0.06);
  }
  .v2-line {
    position: absolute; left: 30px; top: 56px; bottom: 56px; width: 3px;
    background: linear-gradient(#4f46e5, #f59e0b); z-index: 1; opacity: 0.8;
  }
  .v2-txt-label { font-size: 32px; font-weight: 700; letter-spacing: -0.6px; line-height: 1.1; }
  .v2-txt-sub { font-size: 21px; font-weight: 500; color: rgba(255,255,255,0.6); margin-top: 3px; }

  /* ── Square 1200×1200 (WhatsApp / Instagram) ── */
  body.square .safe { inset: 96px; flex-direction: column; gap: 0; }
  body.square .v2-left { flex: none; }
  body.square .v2-head { font-size: 78px; margin-top: 38px; letter-spacing: -2.6px; }
  body.square .v2-sub { font-size: 34px; margin-top: 30px; max-width: 700px; }
  body.square .v2-right { display: flex; flex-direction: column; align-self: center; flex: none; width: max-content; margin-top: 76px; }
  body.square .v2-line { left: 37px; top: 70px; bottom: 70px; width: 4px; }
  body.square .v2-step { padding: 24px 0; gap: 28px; }
  body.square .v2-node { width: 74px; height: 74px; font-size: 32px; }
  body.square .v2-txt-label { font-size: 40px; }
  body.square .v2-txt-sub { font-size: 26px; margin-top: 5px; }

  /* ── Slim 1200×600 (Twitter / X, 2:1) ── */
  body.slim .safe { inset: 64px 80px; gap: 56px; }
  body.slim .v2-head { font-size: 54px; margin-top: 26px; }
  body.slim .v2-sub { font-size: 26px; margin-top: 20px; }
  body.slim .v2-step { padding: 14px 0; }
  body.slim .v2-line { top: 50px; bottom: 50px; }
</style>
</head>
<body class="${format}">
  <div class="safe">
    ${ledeHtml()}
    ${timelineHtml()}
  </div>
</body>
</html>`;
}

(async () => {
  const only = process.argv[2];
  const targets = only ? [only] : Object.keys(FORMATS);
  for (const t of targets) {
    if (!FORMATS[t]) {
      console.error(`Unknown format "${t}". Use one of: ${Object.keys(FORMATS).join(', ')}`);
      process.exitCode = 1;
      return;
    }
  }

  const browser = await chromium.launch();
  for (const format of targets) {
    const { file, width, height } = FORMATS[format];
    const page = await browser.newPage();
    await page.setViewportSize({ width, height });
    await page.setContent(buildHtml(format), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const out = resolve(__dirname, '../public/', file);
    writeFileSync(out, await page.screenshot({ type: 'png' }));
    await page.close();
    console.log(`✓ ${format.padEnd(9)} → ${out}  (${width}×${height})`);
  }
  await browser.close();
})();
