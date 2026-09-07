/* What the invitation's visitors actually did: how far down they read, and
   which buttons they pressed. Both go to /track.json, same-origin.

   Deliberately quiet: milestones only, one ping each, and the final depth
   sent with sendBeacon so leaving the page does not cancel it. */
const el = document.body;
const weddingSlug = el.dataset.wedding;
const inviteeSlug = el.dataset.invitee || '';
if (weddingSlug) start();

function start() {
  const url = window.location.pathname;
  const base = { wedding_slug: weddingSlug, slug: inviteeSlug, url };

  /** sendBeacon survives the page unloading; fetch is the fallback. */
  function send(event_type, meta) {
    const body = JSON.stringify({ ...base, event_type, meta });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon('/track.json', new Blob([body], { type: 'application/json' }))) {
        return;
      }
    } catch { /* fall through to fetch */ }
    fetch('/track.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  // ── Scroll depth ───────────────────────────────────────────────────────
  // Reported at quarters rather than continuously: the couple wants to know
  // whether the RSVP at the bottom was ever reached, not a scroll trace.
  const MILESTONES = [25, 50, 75, 100];
  let deepest = 0;
  let sent = 0;

  // Nothing is reported until the page has finished laying out AND the
  // envelope gate has been opened. While the gate is up, Envelope.astro locks
  // the document to the window height (html.envelope-lock), so "the page fits
  // the window, therefore it was read in full" would fire on every arrival —
  // recording every visitor as having read to the end before they had read a
  // word. Being sealed in an envelope is the opposite of having been read.
  let loaded = document.readyState === 'complete';
  if (!loaded) window.addEventListener('load', () => { loaded = true; onScroll(); }, { once: true });

  const sealed = () => document.documentElement.classList.contains('envelope-lock');
  const ready = () => loaded && !sealed();

  function depthNow() {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    // A page genuinely shorter than the window has been seen in full — but
    // only once it is loaded and actually on screen.
    if (scrollable <= 0) return ready() ? 100 : 0;
    return Math.min(100, Math.round(((window.scrollY || 0) / scrollable) * 100));
  }

  // The gate is dismissed without a scroll event, so watch for the class
  // going away rather than waiting for one.
  new MutationObserver(() => { if (ready()) onScroll(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  let ticking = false;
  function onScroll() {
    if (ticking || !ready()) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      deepest = Math.max(deepest, depthNow());
      for (const m of MILESTONES) {
        if (deepest >= m && sent < m) {
          sent = m;
          send('scroll', { depth: m });
        }
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // The exact figure on the way out, so a guest who stopped at 60% is not
  // recorded as having stopped at the 50% milestone.
  let closed = false;
  function final() {
    if (closed) return;
    closed = true;
    if (!ready()) return;
    deepest = Math.max(deepest, depthNow());
    if (deepest > sent) send('scroll', { depth: deepest });
  }
  window.addEventListener('pagehide', final);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') final(); });

  // ── Button and link presses ────────────────────────────────────────────
  // One delegated listener, so a button added to the page later is covered
  // without touching this file. The label is what the couple will read in the
  // portal, so it is the control's own words, not a CSS selector.
  const LABELS = [
    ['[data-envelope] [data-open]', 'Opened the envelope'],
    ['.btn--solid', 'Reserve your seat'],
    ['.btn--ghost', 'Find the venue'],
    ['.confirm', 'Confirm participation'],
    ['.card__map', 'Open map / directions'],
    ['[data-music-toggle]', 'Music'],
    ['.hero__scroll', 'Scroll cue'],
    ['.story__dot', 'Story chapter'],
    ['.gallery a, .gallery button, [data-lightbox]', 'Gallery photo'],
    ['.footer__nav a', 'Footer link'],
    ['a[href^="tel:"]', 'Phone number'],
    ['a[href^="mailto:"]', 'Email address'],
  ];

  document.addEventListener('click', (e) => {
    for (const [selector, label] of LABELS) {
      const hit = e.target.closest?.(selector);
      if (hit) {
        // A control's own words are more useful than a generic label when
        // they add something — "Footer link — Gallery". When they just repeat
        // the label (the button already says "Reserve your seat") appending
        // them would report "Reserve your seat — Reserve your seat".
        const text = (hit.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
        const adds = text && text.length <= 40
          && !label.toLowerCase().includes(text.toLowerCase())
          && !text.toLowerCase().includes(label.toLowerCase());
        send('click', { label: adds ? `${label} — ${text}` : label });
        return;
      }
    }
  }, { capture: true });
}
