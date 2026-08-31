import anime from 'animejs/lib/anime.es.js';
import Lenis from 'lenis';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubicBezier(0.16, 1, 0.3, 1)';

/* ── 1. Premium smooth scrolling ──────────────────────────────── */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({
    duration: 1.25,
    // Exponential ease-out: fast pickup, long luxurious settle
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.6,
  });
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else target.scrollIntoView();
  });
});

/* ── 2. Split headlines into animatable characters ────────────── */
const splitChars = (el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  words.forEach((word, wi) => {
    const span = document.createElement('span');
    span.style.display = 'inline-block';
    span.style.whiteSpace = 'nowrap';
    [...word].forEach((ch) => {
      const c = document.createElement('span');
      c.className = 'char';
      c.textContent = ch;
      span.appendChild(c);
    });
    el.appendChild(span);
    if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return el.querySelectorAll('.char');
};

const splitTargets = new Map();
document.querySelectorAll('[data-split]').forEach((el) => splitTargets.set(el, splitChars(el)));

const playSplit = (el) => {
  const chars = splitTargets.get(el);
  if (!chars) return;
  anime({
    targets: chars,
    opacity: [0, 1],
    translateY: reduced ? 0 : ['0.75em', 0],
    rotateZ: reduced ? 0 : [5, 0],
    duration: 1400,
    delay: anime.stagger(26, { start: Number(el.dataset.splitDelay || 0) }),
    easing: EASE,
  });
};

/* ── 3. Enter animations — every transition runs through anime ── */
/* The direction an element travels FROM. Sideways entrances keep a long
   downward scroll from reading as one continuous vertical slide. */
const FROM = {
  left: { translateX: [-70, 0] },
  right: { translateX: [70, 0] },
  down: { translateY: [-34, 0] },
  up: { translateY: [34, 0] },
};

const playReveal = (el) => {
  anime.remove(el);
  anime({
    targets: el,
    opacity: [0, 1],
    ...(reduced ? {} : FROM[el.dataset.reveal] || FROM.up),
    duration: 1150,
    delay: Number(el.dataset.revealDelay || 0),
    easing: EASE,
  });
};

const WIPE = {
  left: 'inset(0% 100% 0% 0%)',
  right: 'inset(0% 0% 0% 100%)',
  up: 'inset(0% 0% 100% 0%)',
};

const playCurtain = (el) => {
  const img = el.querySelector('img');
  if (!img) return;
  const delay = Number(el.dataset.revealDelay || 0);
  anime.remove(img);
  anime({
    targets: img,
    clipPath: [WIPE[el.dataset.wipe] || WIPE.up, 'inset(0% 0% 0% 0%)'],
    duration: 1500,
    delay,
    easing: EASE,
  });
  // The frame slides in while the photo inside it wipes and settles.
  if (!reduced && el.dataset.from) {
    anime({
      targets: el,
      ...(FROM[el.dataset.from] || {}),
      duration: 1400,
      delay,
      easing: EASE,
    });
  }
  anime({
    targets: img,
    scale: [1.18, 1],
    duration: 2000,
    delay: Number(el.dataset.revealDelay || 0),
    easing: EASE,
  });
};

/* Stagger siblings inside any [data-stagger] group, before observing */
document.querySelectorAll('[data-stagger]').forEach((group) => {
  const step = Number(group.dataset.stagger) || 110;
  [...group.children].forEach((child, i) => {
    if (child.hasAttribute('data-reveal')) child.dataset.revealDelay = String(i * step);
  });
});

/* Components may still express a delay as an inline CSS custom property */
document.querySelectorAll('[data-reveal]').forEach((el) => {
  if (el.dataset.revealDelay) return;
  const css = getComputedStyle(el).getPropertyValue('--reveal-delay').trim();
  if (css) el.dataset.revealDelay = String(parseFloat(css) || 0);
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      if (el.hasAttribute('data-reveal')) playReveal(el);
      if (el.hasAttribute('data-curtain')) playCurtain(el);
      if (el.hasAttribute('data-split')) playSplit(el);
      observer.unobserve(el);
    });
  },
  { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
);

document.querySelectorAll('[data-reveal], [data-curtain], [data-split]').forEach((el) =>
  observer.observe(el)
);

/* ── 4. Scroll-scrubbed anime timelines ───────────────────────────
   Each element gets a paused anime instance whose playhead is seeked
   from the element's own progress through the viewport, so the motion
   is bound to the scroll position rather than to elapsed time.       */
const SCRUB = 1000; // virtual duration, in ms, that one viewport pass maps onto

const scrubbers = [];

const addScrub = (el, props) => {
  const instance = anime({
    targets: el,
    ...props,
    duration: SCRUB,
    easing: 'linear',
    autoplay: false,
  });
  scrubbers.push({ el, instance });
};

if (!reduced) {
  /* One anime instance per element: two instances on the same target would
     each write the whole `transform`, so any combination is merged here. */
  const scrubProps = (el) => {
    const props = {};
    if (el.hasAttribute('data-parallax')) {
      const shift = (Number(el.dataset.parallax) || 0.12) * 100;
      // data-axis="x" drifts the layer sideways as the page scrolls past it
      if (el.dataset.axis === 'x') props.translateX = [shift, -shift];
      else props.translateY = [shift, -shift];
    }
    if (el.dataset.scrub === 'zoom') props.scale = [1.22, 1];
    // Body copy drifts but never fades — text stays fully legible mid-scroll
    if (el.dataset.scrub === 'rise') props.translateY = props.translateY || [70, -70];
    if (el.dataset.scrub === 'slide-left') props.translateX = [55, -20];
    if (el.dataset.scrub === 'slide-right') props.translateX = [-55, 20];
    return props;
  };

  document.querySelectorAll('[data-parallax], [data-scrub]').forEach((el) => {
    const props = scrubProps(el);
    if (Object.keys(props).length) addScrub(el, props);
  });
}

const progressBar = document.querySelector('[data-progress]');

const update = () => {
  const vh = window.innerHeight;

  for (const { el, instance } of scrubbers) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom < -vh * 0.5 || rect.top > vh * 1.5) continue;
    // 0 when the element's centre is one viewport below the fold, 1 when one above
    const p = 1 - (rect.top + rect.height / 2) / (vh + rect.height);
    instance.seek(Math.min(1, Math.max(0, p)) * SCRUB);
  }

  if (progressBar) {
    const max = document.documentElement.scrollHeight - vh;
    progressBar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  }
};

/* One rAF loop drives Lenis and every scrubbed timeline together, so the
   scrub is resolved on the same frame the smooth-scroll position changes. */
const frame = (time) => {
  if (lenis) lenis.raf(time);
  update();
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
window.addEventListener('scroll', update, { passive: true });
window.addEventListener('resize', update);
update();

/* ── 5. Hero entrance timeline ──────────────────────────────────
   Runs on `load` so the photo is painted before the veils lift, but never
   waits longer than 2.5s — a slow or failed image must not leave the page
   sitting behind a blank curtain. */
let heroPlayed = false;
// When the envelope gate is present, its curtain (Envelope.astro) is the
// reveal — the photo is already visible underneath it, so this timeline only
// has to bring the type in, timed to land as the curtain finishes parting.
// Without the gate there's no curtain to wait on, so it starts right away.
const playHero = (textDelay = 0) => {
  if (heroPlayed) return;
  heroPlayed = true;
  anime
    .timeline({ easing: EASE })
    .add({ targets: '[data-hero-photo]', scale: [1.12, 1], duration: 2600 }, 0)
    .add(
      {
        targets: '[data-hero-line]',
        opacity: [0, 1],
        translateY: ['1.2em', 0],
        duration: 1300,
        delay: anime.stagger(140),
      },
      textDelay || 400
    )
    .add({ targets: '[data-hero-rule]', scaleX: [0, 1], duration: 1200 }, (textDelay || 400) + 900);

  const heroSplit = document.querySelector('.hero [data-split]');
  setTimeout(() => heroSplit && playSplit(heroSplit), textDelay + 700);
};

// The envelope gate (src/components/Envelope.astro) holds the hero timeline
// until the visitor clicks "Open Invitation"; without that gate on the page,
// fall back to the load/timeout behaviour so the hero still plays on its own.
const hasEnvelope = !!document.querySelector('[data-envelope]');
if (hasEnvelope) {
  // The gate (Envelope.astro) fades out over ~0.9s once clicked; a short
  // delay here lets that fade clear before the hero's own text starts in,
  // rather than the two animations racing each other.
  window.addEventListener('invitation:open', () => playHero(500), { once: true });
} else {
  window.addEventListener('load', () => playHero());
  setTimeout(() => playHero(), 2500);
}

/* ── 6. Countdown to the ceremony ─────────────────────────────── */
const clock = document.querySelector('[data-countdown]');
if (clock) {
  const target = new Date(clock.dataset.countdown).getTime();
  const fields = {
    days: clock.querySelector('[data-unit="days"]'),
    hours: clock.querySelector('[data-unit="hours"]'),
    minutes: clock.querySelector('[data-unit="minutes"]'),
    seconds: clock.querySelector('[data-unit="seconds"]'),
  };
  const pad = (n) => String(Math.max(0, n)).padStart(2, '0');

  const tick = () => {
    const s = Math.floor(Math.max(0, target - Date.now()) / 1000);
    const next = {
      days: pad(Math.floor(s / 86400)),
      hours: pad(Math.floor(s / 3600) % 24),
      minutes: pad(Math.floor(s / 60) % 60),
      seconds: pad(s % 60),
    };
    for (const [key, el] of Object.entries(fields)) {
      if (!el || el.textContent === next[key]) continue;
      el.textContent = next[key];
      if (reduced) continue;
      anime({
        targets: el,
        opacity: [0.25, 1],
        translateY: ['-0.35em', 0],
        duration: 620,
        easing: EASE,
      });
    }
  };
  tick();
  setInterval(tick, 1000);
}

/* ── 7. RSVP form (no backend — confirms locally) ─────────────── */
const form = document.querySelector('[data-rsvp]');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const note = form.querySelector('[data-rsvp-note]');
    form.querySelectorAll('input, select, button, textarea').forEach((el) => (el.disabled = true));
    note.hidden = false;
    anime({
      targets: note,
      opacity: [0, 1],
      translateY: ['1rem', 0],
      duration: 900,
      easing: EASE,
    });
  });
}
