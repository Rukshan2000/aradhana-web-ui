# Aradhana & Nihal — Wedding Invitation

A single-page wedding invitation built with **Astro**, animated with **anime.js**
and scrolled with **Lenis**. Photography is loaded from Unsplash's CDN.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run preview
```

## The opening gate — `src/components/Envelope.astro`

A full-screen title card sits over the site until the visitor clicks
**Open Invitation**. It locks page scroll (`html.envelope-lock`) and, on
click:

1. The wax seal breaks and drops away (`easeInBack`), and the title card
   fades down and out (`easeInExpo`) — motion that reads as *falling*.
2. `invitation:open` fires immediately (not after any exit animation),
   which `motion.js` listens for to start the hero's own entrance timeline
   after a short delay — see below.
3. The gate itself fades out over ~0.9s (`.envelope.is-open`, driven by a
   CSS `transition`, not JS) and is removed from the DOM once that
   finishes.

The hero photo is staged at full opacity *underneath* the gate from the very
first frame (see `.hero__media img` in `Hero.astro`); it isn't the thing
fading in. That's deliberate — a photo fading in on its own timeline used to
leave a flash of the page's ivory background visible through the gate's
fade for a few hundred ms while the photo was still at `opacity: 0`.

## Motion architecture — `src/scripts/motion.js`

Every transition on the page is driven by anime.js. CSS holds only the resting
("hidden") state; it declares no `transition`.

1. **Smooth scroll** — Lenis, exponential ease-out. In-page anchors are routed
   through `lenis.scrollTo` so they inherit the same easing.
2. **Split headlines** — `[data-split]` elements are exploded into `.char`
   spans and revealed with `anime.stagger`.
3. **Enter animations** — one `IntersectionObserver` fires an anime instance per
   element, and each one declares the direction it travels *from*, so a long
   downward scroll is answered by motion across the page instead of more
   vertical drift:
   - `[data-reveal="left|right|up|down"]` — fade plus a directional slide.
   - `[data-curtain]` — a `clip-path` wipe, its direction set by
     `[data-wipe="left|right|up"]`; `[data-from="left|right"]` also slides the
     frame in while the photo inside it wipes.
   - `[data-stagger="120"]` on a parent delays each child in turn.
4. **Scroll-scrubbed timelines** — `[data-parallax="0.2"]` (add `data-axis="x"`
   to drift sideways) and `[data-scrub="zoom|rise|slide-left|slide-right"]`
   build *paused* anime instances whose playhead is
   `seek()`-ed from the element's own progress through the viewport, so the
   motion is bound to scroll position rather than to elapsed time. Lenis and the
   scrub share a single `requestAnimationFrame` loop, so both resolve on the
   same frame.

Two rules worth keeping when editing:

- **One anime instance per element.** Each instance writes the whole `transform`,
  so combinations (parallax + zoom) are merged in `scrubProps()` rather than
  layered. This is why parallax lives on a wrapper `span`, not on the `<img>`
  that the curtain is already scaling.
- **Alternate the direction per index.** Story chapters, gallery tiles, detail
  cards, schedule rows and RSVP fields all key their direction off `i % 2`, so
  neighbouring elements arrive from opposite sides.
- **Parallax layers are absolutely positioned.** The overhang has to be a share
  of the frame's *height*; a percentage `margin-top` resolves against *width*
  and leaves a gap.

`prefers-reduced-motion` disables Lenis, the scrub engine, and all transforms;
the page renders fully in its resting state.

## Editing the content

All names, dates, copy, and photo URLs live in `src/data/wedding.js`.
Changing `couple.date` (ISO 8601) also re-targets the countdown.

The RSVP form has **no backend** — it confirms in the browser only. Point it at
a form service (Formspree, Netlify Forms, a serverless endpoint) before sending
the link to guests; see the submit handler at the end of `motion.js`.
