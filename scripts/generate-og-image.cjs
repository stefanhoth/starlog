/**
 * OG image generator for StarLog.
 *
 * Renders public/og-image.png at 1200×630 px using Playwright/Chromium.
 * The HTML template is self-contained — the brand icon is embedded as base64
 * so no local server is needed.
 *
 * Usage:
 *   node scripts/generate-og-image.cjs
 *
 * Output:
 *   public/og-image.png  (committed to repo, deployed to GitHub Pages)
 *
 * Requirements:
 *   - @playwright/test must be installed (it is — used by the test suite)
 *   - Chromium browser: `npx playwright install chromium`
 *     In CI / cloud sessions: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright install chromium`
 *
 * Design tokens (edit here to iterate):
 *   BRAND_COLOR_LOG  — colour of "Log" in the brand name
 *   HIGHLIGHT_COLOR  — colour of the highlighted tagline word(s)
 *   BG_GRADIENT      — CSS background value for the body
 */

const { chromium } = require('@playwright/test');
const { writeFileSync, readFileSync } = require('fs');
const { resolve } = require('path');

const OUT_PATH = resolve(__dirname, '../public/og-image.png');
const ICON_PATH = resolve(__dirname, '../public/icons/icon-192.png');

const logoB64 = readFileSync(ICON_PATH).toString('base64');
const logoSrc = `data:image/png;base64,${logoB64}`;

// ── Design tokens ────────────────────────────────────────────────────────────
const BRAND_COLOR_LOG  = '#8f74db';
const HIGHLIGHT_COLOR  = '#fde047';
const BG_GRADIENT      = 'linear-gradient(140deg, #0a0014 0%, #1a0a3c 55%, #2d1060 100%)';
// ─────────────────────────────────────────────────────────────────────────────

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 1200px;
    height: 630px;
    overflow: hidden;
    font-family: -apple-system, 'Segoe UI', Inter, Helvetica, sans-serif;
    background: ${BG_GRADIENT};
    position: relative;
  }

  /* subtle radial glow */
  body::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 0% 0%, rgba(143,116,219,0.2) 0%, transparent 55%),
      radial-gradient(ellipse at 100% 100%, rgba(79,70,229,0.15) 0%, transparent 55%);
    pointer-events: none;
  }

  /* safe-zone: 80 px on every side (OG best-practice) */
  .safe {
    position: absolute;
    inset: 80px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  /* ── Brand ── */
  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .brand img {
    width: 72px;
    height: 72px;
    border-radius: 16px;
  }
  .brand-name {
    font-size: 56px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -1.5px;
    line-height: 1;
  }
  .brand-name span { color: ${BRAND_COLOR_LOG}; }

  /* ── Headline ── */
  .headline {
    font-size: 62px;
    font-weight: 700;
    color: #ffffff;
    line-height: 1.15;
    letter-spacing: -2px;
    max-width: 920px;
  }
  .highlight {
    color: ${HIGHLIGHT_COLOR};
    font-weight: 800;
  }

  /* ── Steps strip ── */
  .steps {
    display: flex;
    align-items: stretch;
    border: 2px solid rgba(255,255,255,0.2);
    border-radius: 18px;
    overflow: hidden;
    background: rgba(255,255,255,0.08);
  }
  .step {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 22px 28px;
  }
  .step-emoji {
    font-size: 38px;
    line-height: 1;
    flex-shrink: 0;
  }
  .step-text {
    font-size: 24px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.3px;
    line-height: 1.2;
  }
  .step-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 20px;
    flex-shrink: 0;
  }
  .triangle {
    width: 0;
    height: 0;
    border-top: 14px solid transparent;
    border-bottom: 14px solid transparent;
    border-left: 22px solid rgba(255,255,255,0.7);
  }
</style>
</head>
<body>
  <div class="safe">

    <div class="brand">
      <img src="${logoSrc}" alt="StarLog" />
      <div class="brand-name">Star<span>Log</span></div>
    </div>

    <div class="headline">
      Your experience,<br>shaped into <span class="highlight">powerful stories.</span>
    </div>

    <div class="steps">
      <div class="step">
        <span class="step-emoji">📝</span>
        <span class="step-text">Log your experiences</span>
      </div>
      <div class="step-arrow"><div class="triangle"></div></div>
      <div class="step">
        <span class="step-emoji">⭐</span>
        <span class="step-text">Structure each story</span>
      </div>
      <div class="step-arrow"><div class="triangle"></div></div>
      <div class="step">
        <span class="step-emoji">🎯</span>
        <span class="step-text">Nail your next interview</span>
      </div>
    </div>

  </div>
</body>
</html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  const screenshot = await page.screenshot({ type: 'png' });
  writeFileSync(OUT_PATH, screenshot);
  await browser.close();
  console.log(`✓ OG image written to ${OUT_PATH}`);
})();
