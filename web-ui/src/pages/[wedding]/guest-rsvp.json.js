/* Server-side proxy for the open invitation's RSVP form, mirroring
   [wedding]/[invitee]/rsvp.json: the browser posts same-origin and only this
   route knows where portal-api lives. */
import { submitOpenRsvp } from '../../lib/api.js';

export const prerender = false;

export async function POST({ params, request }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { status, body } = await submitOpenRsvp(params.wedding, payload);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('open rsvp proxy failed:', err.message);
    return new Response(JSON.stringify({ error: 'RSVP service unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
