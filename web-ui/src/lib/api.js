/* Server-side reads from portal-api. Runs only during SSR, so the API never
   has to be exposed to the browser; set API_BASE to the API origin in prod.

   process.env is read first, and deliberately: Vite resolves
   `import.meta.env.API_BASE` when it bundles, so an unprefixed variable that
   was not present at *build* time is inlined as `undefined` and the origin
   silently collapses to localhost — which is exactly what happens in a
   container, where the image is built long before the environment exists.
   This module only ever runs under Node during SSR, so process.env is
   available and is a true runtime lookup. */
const BASE =
  (typeof process !== 'undefined' && process.env?.API_BASE) ||
  import.meta.env.API_BASE ||
  import.meta.env.PUBLIC_API_BASE ||
  'http://localhost:4000';

/** Marks a link the couple has withdrawn, as against one that never was. */
export const REVOKED = Symbol('revoked');

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (res.status === 404) return null;
  // 410 Gone: the invitation was real and has been closed. It gets its own
  // page, so it must not collapse into the same null as a bad URL.
  if (res.status === 410) return REVOKED;
  if (!res.ok) throw new Error(`portal-api ${res.status} on ${path}`);
  return res.json();
}

/** The wedding + invitee behind /<weddingSlug>/<inviteeSlug>, or null. */
export function fetchInvite(weddingSlug, inviteeSlug) {
  return get(`/api/weddings/${encodeURIComponent(weddingSlug)}/invite/${encodeURIComponent(inviteeSlug)}`);
}

/**
 * The open invitation behind /<weddingSlug> — the wedding on its own, with no
 * invitee, for the shareable link anyone can be sent. Returns null if the
 * wedding does not exist or is unpublished.
 */
export function fetchOpenInvite(weddingSlug) {
  return get(`/api/weddings/${encodeURIComponent(weddingSlug)}/invite`);
}

/**
 * Where a printed QR code should actually send the scanner, asked fresh on
 * every scan. The slugs come off the card and may be stale; the API answers
 * with the invitation's address today, so a rename never orphans a code.
 * Returns null for a link that never existed and REVOKED for a closed one.
 */
export function fetchInviteTarget(weddingSlug, inviteeSlug) {
  const base = `/api/weddings/${encodeURIComponent(weddingSlug)}/resolve`;
  return get(inviteeSlug ? `${base}/${encodeURIComponent(inviteeSlug)}` : base);
}

export function fetchWedding(weddingSlug) {
  return get(`/api/weddings/${encodeURIComponent(weddingSlug)}`);
}

/** Forwards an RSVP submission to portal-api and returns {status, body}. */
export async function submitRsvp(weddingSlug, inviteeSlug, payload) {
  const res = await fetch(
    `${BASE}/api/weddings/${encodeURIComponent(weddingSlug)}/rsvp/${encodeURIComponent(inviteeSlug)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** Forwards an open-link RSVP (the visitor names themselves) to portal-api. */
export async function submitOpenRsvp(weddingSlug, payload) {
  const res = await fetch(`${BASE}/api/weddings/${encodeURIComponent(weddingSlug)}/rsvp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** One tracking write. The visitor's user-agent and referer are forwarded so
 *  the API records the real device rather than this server's. */
export async function trackEvent({ weddingSlug, slug, eventType = 'open', url, meta, request }) {
  return fetch(`${BASE}/api/track`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-agent': request?.headers.get('user-agent') || '',
      referer: request?.headers.get('referer') || '',
    },
    body: JSON.stringify({ wedding_slug: weddingSlug, slug, event_type: eventType, url, meta }),
  });
}

/** Fire-and-forget open tracking; a tracking outage must not break the page. */
export async function trackOpen({ weddingSlug, slug, url, request }) {
  try {
    await trackEvent({ weddingSlug, slug, url, request, eventType: 'open' });
  } catch (err) {
    console.warn('track failed:', err.message);
  }
}

/**
 * Maps a `weddings` row onto the shape the components expect from
 * wedding.json, so only the couple's particulars come from the database and
 * the rest of the content keeps its existing defaults.
 */
export function toCouple(wedding, fallback) {
  if (!wedding) return fallback;
  return {
    ...fallback,
    bride: wedding.bride ?? fallback.bride,
    groom: wedding.groom ?? fallback.groom,
    hashtag: wedding.hashtag ?? fallback.hashtag,
    city: wedding.city ?? fallback.city,
    date: wedding.event_date ?? fallback.date,
    dateLabel: wedding.date_label ?? fallback.dateLabel,
    yearLabel: wedding.year_label ?? fallback.yearLabel,
    // Carried through for the calendar entry, which wants the actual venue
    // rather than the city the invitation prints under the couple's names.
    venue: wedding.venue ?? fallback.venue ?? null,
  };
}

/**
 * The free-form parts of the page — hero photo, love story, gallery,
 * schedule, venue photo, music — live in `weddings.content`
 * as one jsonb document, admin-edited as a whole rather than field by field.
 * Each top-level key that the admin has actually set overrides the built-in
 * default from wedding.json; anything left unset (a wedding created before
 * filling in its story, say) falls back rather than rendering empty.
 */
export function mergeContent(content, fallback) {
  const c = content && typeof content === 'object' ? content : {};
  return {
    hero: c.hero ?? fallback.hero,
    // Section wording is merged one section at a time, so a couple who has
    // renamed only the RSVP heading keeps the built-in wording everywhere else.
    headings: Object.fromEntries(
      Object.entries(fallback.headings).map(([key, value]) => [key, { ...value, ...(c.headings?.[key] || {}) }]),
    ),
    story: c.story ?? fallback.story,
    gallery: c.gallery ?? fallback.gallery,
    galleryPool: c.galleryPool ?? fallback.galleryPool,
    details: c.details ?? fallback.details,
    schedule: c.schedule ?? fallback.schedule,
    venuePhoto: c.venuePhoto ?? fallback.venuePhoto,
    music: c.music ?? fallback.music,
  };
}
