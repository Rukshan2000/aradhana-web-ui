/* Server-side proxy for the RSVP form's fetch() call: the browser only ever
   talks to this same-origin route, never to portal-api directly, so the API's
   address and any future auth stay off the client. */
import { submitRsvp } from '../../../lib/api.js';

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
    const { status, body } = await submitRsvp(params.wedding, params.invitee, payload);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('rsvp proxy failed:', err.message);
    return new Response(JSON.stringify({ error: 'RSVP service unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
