/**
 * Screenshots of the real invitation, for the landing page's showcase.
 *
 * They are captured from `/demo` — the sample wedding rendered from the
 * built-in content — so no real couple's photographs or guest names ever end
 * up in the product's marketing, and re-running this after a design change
 * keeps the shots honest instead of slowly becoming a picture of a version
 * that no longer exists.
 *
 *   npm run build
 *   PORT=4399 node dist/server/entry.mjs &
 *   node scripts/shots.mjs http://127.0.0.1:4399
 *
 * Written into public/assets/shots/ as JPEG at 82% rather than PNG: they are
 * photographic, and the PNGs came out several times larger for no visible
 * gain on a page that displays them at a fraction of their captured width.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.argv[2] || 'http://127.0.0.1:4399';
const OUT = new URL('../public/assets/shots/', import.meta.url).pathname;

/* Each shot is a viewport and a place to stop. `settle` is the pause after
   scrolling: every section animates itself in on arrival, and capturing mid
   animation gives a half-faded, half-slid frame. */
const SHOTS = [
  { name: 'phone-hero', device: 'phone', at: '#top', settle: 1400 },
  { name: 'phone-story', device: 'phone', at: '#story', settle: 1800 },
  { name: 'phone-gallery', device: 'phone', at: '#gallery', settle: 1800 },
  { name: 'phone-rsvp', device: 'phone', at: '#rsvp', settle: 1800 },
  { name: 'desk-hero', device: 'desk', at: '#top', settle: 1400 },
  { name: 'desk-details', device: 'desk', at: '#details', settle: 1800 },
];

const VIEWPORTS = {
  phone: { width: 400, height: 860, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desk: { width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

for (const shot of SHOTS) {
  const { deviceScaleFactor, isMobile, hasTouch, ...viewport } = VIEWPORTS[shot.device];
  // reducedMotion is what makes a *still* of this page possible at all.
  // Lenis owns the scroll position when motion is on, so `scrollIntoView` is
  // undone on its next frame and every shot came back as the hero. Under
  // `prefers-reduced-motion` the page disables Lenis and the scrub engine and
  // renders every section in its resting state — which is precisely the frame
  // an animation resolves to, and the one worth photographing.
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/demo`, { waitUntil: 'networkidle' });

  // The gate holds the page and locks scrolling until it is opened; every
  // shot below the hero is unreachable until this is clicked.
  const gate = page.locator('[data-open-invitation]');
  if (await gate.count()) {
    await gate.click();
    await page.waitForTimeout(2400); // gate fades ~0.9s, then the hero plays
  }

  if (shot.at !== '#top') {
    // Lenis owns the scroll position, so setting scrollTop directly would be
    // undone on its next frame. scrollIntoView goes through the same document
    // scroll Lenis is smoothing, and the settle below lets it come to rest.
    await page.evaluate((sel) => {
      document.querySelector(sel)?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, shot.at);
  }
  await page.waitForTimeout(shot.settle);

  await page.screenshot({ path: `${OUT}${shot.name}.jpg`, type: 'jpeg', quality: 82 });
  console.log('✓', shot.name);
  await ctx.close();
}

await browser.close();
