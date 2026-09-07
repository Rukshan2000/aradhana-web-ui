/* Same-origin sink for the page's own engagement pings (scroll depth, button
   presses). Like the RSVP proxy, the browser never addresses portal-api
   directly, so the API's location stays server-side.

   Everything here arrives from a page anyone can open, so nothing is trusted:
   only known event types pass, and only the two fields the tracker sends. */
import { trackEvent } from '../lib/api.js';

export const prerender = false;

const ALLOWED = new Set(['scroll', 'click', 'view']);

export async function POST({ request }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const { wedding_slug, slug, event_type, url, meta } = payload || {};
  if (!wedding_slug || !ALLOWED.has(event_type)) return new Response(null, { status: 400 });

  const clean = {};
  if (Number.isFinite(Number(meta?.depth))) {
    clean.depth = Math.min(100, Math.max(0, Math.round(Number(meta.depth))));
  }
  if (typeof meta?.label === 'string') clean.label = meta.label.slice(0, 120);

  try {
    await trackEvent({
      weddingSlug: wedding_slug,
      slug: typeof slug === 'string' && slug ? slug : undefined,
      eventType: event_type,
      url: typeof url === 'string' ? url.slice(0, 500) : undefined,
      meta: clean,
      request,
    });
  } catch (err) {
    // A tracking outage is not the visitor's problem: swallow it.
    console.warn('track proxy failed:', err.message);
  }
  // 204 keeps sendBeacon happy and gives the page nothing to parse.
  return new Response(null, { status: 204 });
}
