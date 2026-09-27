import { asyncRouter } from '../asyncRouter.js';
import { db } from '../db.js';
import { insertGuest, publicGuest } from '../guestCode.js';
import { slugify } from '../slugify.js';
import { requireAuth } from '../auth.js';
import { resolveWedding, resolveGuest, recordAlias, parseInviteUrl, normalizeQrUrl } from '../links.js';

const router = asyncRouter();

/** Appends -2, -3 … until the slug is free. */
async function uniqueSlug(base) {
  const root = base || 'wedding';
  let slug = root;
  for (let n = 2; await db('weddings').where({ slug }).first(); n += 1) slug = `${root}-${n}`;
  return slug;
}

/** Seats one open-link visitor may claim for themselves; the couple never
 *  allotted them any, so the cap is the system's, not the invitation's. */
const OPEN_MAX_SEATS = 10;

const digits = (value) => String(value || '').replace(/\D/g, '');

/** The comparable part of a phone number: its last 9 digits, which is what
 *  survives the difference between "077 123 4567" and "+94 77 123 4567". */
const phoneKey = (value) => digits(value).slice(-9);

/** A wedding that is live on the public site, or null. */
async function publishedWedding(slug) {
  const wedding = await resolveWedding(slug);
  return wedding && wedding.published ? wedding : null;
}

/**
 * 410 Gone: the link was real and has been withdrawn, as against a 404 for
 * one that never existed. The site shows a designed "this invitation has
 * closed" page for the first and its not-found page for the second, so the
 * two have to be distinguishable here.
 */
const GONE = { error: 'invitation revoked', revoked: true };

/** Guests' RSVP notes, shown on the invitation as a wall of wishes. Only the
 *  name and the note go out — nothing that identifies or reaches a guest. */
// ponytail: newest 50 only, add paging if a wedding outgrows it
function publicWishes(weddingId) {
  return db('guests')
    .where({ wedding_id: weddingId })
    .whereNull('revoked_at')
    .whereNotNull('message')
    .whereRaw("btrim(message) <> ''")
    .orderBy('responded_at', 'desc', 'last')
    .limit(50)
    .select('name', 'message');
}

/** Appends -2, -3 … until the guest slug is free inside this wedding. */
async function uniqueGuestSlug(weddingId, base) {
  const root = base || 'guest';
  let slug = root;
  for (let n = 2; await db('guests').where({ wedding_id: weddingId, slug }).first(); n += 1) {
    slug = `${root}-${n}`;
  }
  return slug;
}

/** The self-registered row this phone number already created, if any. Matched
 *  on digits alone so "077 123 4567" and "+94771234567" are the same person. */
async function findSelfGuestByPhone(weddingId, phone) {
  const key = phoneKey(phone);
  if (key.length < 7) return null;
  const rows = await db('guests').where({ wedding_id: weddingId, source: 'self' }).whereNotNull('phone');
  return rows.find((g) => phoneKey(g.phone) === key) || null;
}

const FIELDS = [
  'slug', 'bride', 'groom', 'hashtag', 'city', 'event_date',
  'date_label', 'year_label', 'reply_by', 'venue', 'notes', 'published', 'open_rsvp',
  'qr_url', 'template_id', 'sample_wishes',
];

// Shape of the free-form site content: array fields vs. single-object
// fields. Anything outside this list is dropped rather than stored, so the
// column can't accumulate arbitrary junk from a stray request body.
const CONTENT_ARRAY_KEYS = ['story', 'gallery', 'galleryPool', 'details', 'schedule'];
// `credit` is gone from this list on purpose: the studio credit in the footer
// is fixed in web-ui, not something a wedding carries its own copy of.
const CONTENT_OBJECT_KEYS = ['hero', 'headings', 'venuePhoto', 'music'];

/** Keeps only recognised content keys, each holding the shape it should. */
function sanitizeContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return undefined;
  const out = {};
  for (const key of CONTENT_ARRAY_KEYS) {
    if (Array.isArray(content[key])) out[key] = content[key];
  }
  for (const key of CONTENT_OBJECT_KEYS) {
    const v = content[key];
    if (v && typeof v === 'object' && !Array.isArray(v)) out[key] = v;
  }
  return out;
}

const pick = (body) => {
  const fields = Object.fromEntries(Object.entries(body).filter(([k]) => FIELDS.includes(k)));
  if ('content' in body) {
    const content = sanitizeContent(body.content);
    if (!content) throw Object.assign(new Error('content must be an object'), { status: 400 });
    // jsonb columns need the value pre-serialized — knex/pg do not stringify
    // plain objects passed as bindings.
    fields.content = JSON.stringify(content);
  }
  return fields;
};

/**
 * Loads :weddingSlug and checks it belongs to the caller. A wedding that
 * exists but is owned by someone else 404s rather than 403 — a manager
 * should not be able to tell, from the response, whether a slug they don't
 * own exists at all.
 */
async function ownWedding(req, res) {
  const wedding = await db('weddings').where({ slug: req.params.weddingSlug }).first();
  if (!wedding || wedding.owner_id !== req.user.id) {
    res.status(404).json({ error: 'wedding not found' });
    return null;
  }
  return wedding;
}

// List the caller's own wedding (there is at most one).
router.get('/', requireAuth, async (req, res) => {
  const weddings = await db('weddings').where({ owner_id: req.user.id }).orderBy('created_at', 'desc');
  const counts = await db('guests').select('wedding_id').count('* as invitees').groupBy('wedding_id');
  const byId = Object.fromEntries(counts.map((c) => [c.wedding_id, Number(c.invitees)]));
  res.json(weddings.map((w) => ({ ...w, invitee_count: byId[w.id] || 0 })));
});

// Create a wedding. One per user — a second attempt is rejected outright
// rather than silently attaching to (or replacing) the first.
router.post('/', requireAuth, async (req, res) => {
  const existing = await db('weddings').where({ owner_id: req.user.id }).first();
  if (existing) {
    return res.status(409).json({ error: 'you already manage a wedding', slug: existing.slug });
  }

  const { bride, groom } = req.body;
  if (!bride || !groom) {
    return res.status(400).json({ error: 'bride and groom are required' });
  }
  const fields = pick(req.body);
  fields.slug = await uniqueSlug(slugify(fields.slug || `${bride}-${groom}`));
  fields.owner_id = req.user.id;
  try {
    const [wedding] = await db('weddings').insert(fields).returning('*');
    res.status(201).json({ ...wedding, invitee_count: 0 });
  } catch (err) {
    res.status(400).json({ error: String(err.message || err) });
  }
});

// One wedding by slug — only the owner can look it up.
router.get('/:weddingSlug', requireAuth, async (req, res) => {
  const wedding = await ownWedding(req, res);
  if (!wedding) return;
  res.json(wedding);
});

router.patch('/:weddingSlug', requireAuth, async (req, res) => {
  const owned = await ownWedding(req, res);
  if (!owned) return;
  const fields = pick(req.body);
  if (fields.slug) fields.slug = slugify(fields.slug);
  if ('qr_url' in fields) fields.qr_url = normalizeQrUrl(fields.qr_url);
  const renamedFrom = fields.slug && fields.slug !== owned.slug ? owned.slug : null;
  const [wedding] = await db('weddings')
    .where({ id: owned.id })
    .update({ ...fields, updated_at: db.fn.now() })
    .returning('*');

  // Recorded after the update, not before: the alias is only valid once the
  // old slug has actually been vacated, and recordAlias refuses to shadow a
  // live record. A wedding alias covers the whole first segment, so this
  // rescues every personalised card of the wedding, not just the open link.
  if (renamedFrom) {
    await recordAlias({ kind: 'wedding', alias: renamedFrom, weddingId: owned.id });
  }
  res.json(wedding);
});

// Deleting a wedding cascades to its guests (see the migration).
router.delete('/:weddingSlug', requireAuth, async (req, res) => {
  const owned = await ownWedding(req, res);
  if (!owned) return;
  await db('weddings').where({ id: owned.id }).del();
  res.status(204).end();
});

// ── Invitees of one wedding ─────────────────────────────────────────────────

router.get('/:weddingSlug/guests', requireAuth, async (req, res) => {
  const wedding = await ownWedding(req, res);
  if (!wedding) return;
  const guests = await db('guests').where({ wedding_id: wedding.id }).orderBy('name');
  res.json(guests.map(publicGuest));
});

router.post('/:weddingSlug/guests', requireAuth, async (req, res) => {
  const wedding = await ownWedding(req, res);
  if (!wedding) return;

  const { name, household, side, email, phone, max_seats } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  // The slug is per-wedding, so it can be derived safely here.
  const base = slugify(req.body.slug || name);
  let slug = base || 'guest';
  for (let n = 2; await db('guests').where({ wedding_id: wedding.id, slug }).first(); n += 1) {
    slug = `${base}-${n}`;
  }
  try {
    // The code is assigned inside insertGuest; it is never taken from the body.
    const guest = await insertGuest({
      wedding_id: wedding.id, slug, name, household, side, email, phone, max_seats,
    });
    res.status(201).json({ ...publicGuest(guest), url: `/${wedding.slug}/${guest.slug}` });
  } catch (err) {
    res.status(400).json({ error: String(err.message || err) });
  }
});

// Revoke or restore the open link. Separate from `published` (which takes the
// whole site down) and from `open_rsvp` (which leaves the page up but closes
// the form): this retires one URL and nothing else.
router.post('/:weddingSlug/open-link/:action(revoke|restore)', requireAuth, async (req, res) => {
  const owned = await ownWedding(req, res);
  if (!owned) return;
  const [wedding] = await db('weddings')
    .where({ id: owned.id })
    .update({
      open_revoked_at: req.params.action === 'revoke' ? db.fn.now() : null,
      updated_at: db.fn.now(),
    })
    .returning('*');
  res.json(wedding);
});

// ── Printed-QR repair: aliases for URLs already on cards ───────────────────
//
// A QR code cannot be re-inked once the cards are at the printer, so when the
// URL on them no longer resolves, the fix has to happen at this end: point the
// printed address at the right invitation. Renames record their own alias
// automatically; these routes are for the ones nobody can infer — a slug typed
// wrong at the print shop, or a link written from memory.

/** The aliases pointing at this wedding, newest first, with their targets. */
router.get('/:weddingSlug/aliases', requireAuth, async (req, res) => {
  const owned = await ownWedding(req, res);
  if (!owned) return;
  const rows = await db('link_aliases')
    .where({ wedding_id: owned.id })
    .orderBy('created_at', 'desc');
  const guests = await db('guests').where({ wedding_id: owned.id }).select('id', 'slug', 'name');
  const byId = Object.fromEntries(guests.map((g) => [g.id, g]));
  res.json(rows.map((row) => ({
    ...row,
    // The path this alias answers on, ready to show beside the QR it repairs.
    path: row.kind === 'wedding' ? `/${row.alias}` : `/${owned.slug}/${row.alias}`,
    guest_slug: row.guest_id ? byId[row.guest_id]?.slug || null : null,
    guest_name: row.guest_id ? byId[row.guest_id]?.name || null : null,
  })));
});

/**
 * Points a printed URL at an invitation.
 *
 * `url` is whatever is on the card — a full link or just the path. A
 * two-segment URL aliases the invitee half and needs a `target` naming the
 * guest it belongs to; a one-segment URL aliases the wedding itself and so
 * repairs every personalised card printed under that first segment at once.
 */
router.post('/:weddingSlug/aliases', requireAuth, async (req, res) => {
  const owned = await ownWedding(req, res);
  if (!owned) return;

  const parsed = parseInviteUrl(req.body.url);
  if (!parsed) {
    return res.status(400).json({ error: 'could not read that as an invitation URL' });
  }

  const { weddingSlug, inviteeSlug } = parsed;
  let alias;
  let kind;
  let guestId = null;

  if (inviteeSlug) {
    // The first segment is only a label here: what is being repaired is the
    // invitee half, and the wedding is already known from the caller's own.
    kind = 'guest';
    alias = inviteeSlug;
    const target = slugify(req.body.target || '');
    if (!target) return res.status(400).json({ error: 'target invitee is required' });
    const guest = await db('guests').where({ wedding_id: owned.id, slug: target }).first();
    if (!guest) return res.status(404).json({ error: 'target invitee not found' });
    guestId = guest.id;
    if (alias === guest.slug) {
      return res.status(400).json({ error: 'that URL already reaches this invitee' });
    }
  } else {
    kind = 'wedding';
    alias = weddingSlug;
    if (alias === owned.slug) {
      return res.status(400).json({ error: 'that URL already reaches this wedding' });
    }
  }

  // A live invitation always outranks an alias, so one that would be shadowed
  // is refused outright rather than saved and silently ignored at resolve time.
  const live = kind === 'wedding'
    ? await db('weddings').where({ slug: alias }).first()
    : await db('guests').where({ wedding_id: owned.id, slug: alias }).first();
  if (live) {
    return res.status(409).json({ error: 'that URL already belongs to a live invitation' });
  }

  const row = await recordAlias({ kind, alias, weddingId: owned.id, guestId, source: 'manual' });
  if (!row) return res.status(409).json({ error: 'that URL is already mapped' });
  res.status(201).json(row);
});

/** Drops an alias. The live invitation is untouched; only the old printed
 *  address stops resolving. */
router.delete('/:weddingSlug/aliases/:id', requireAuth, async (req, res) => {
  const owned = await ownWedding(req, res);
  if (!owned) return;
  const removed = await db('link_aliases')
    .where({ id: Number(req.params.id), wedding_id: owned.id })
    .del();
  if (!removed) return res.status(404).json({ error: 'alias not found' });
  res.status(204).end();
});

// ── Public: what a printed QR code should open, resolved fresh ─────────────
// GET /api/weddings/:weddingSlug/resolve
// GET /api/weddings/:weddingSlug/resolve/:inviteeSlug
//
// The site's /go/… landing page asks this on every scan. The slugs in the URL
// are whatever was printed on the card — possibly long since renamed — and
// what comes back is the invitation's address *today*, taken from the live
// row rather than from the code. That is the whole point: a card printed a
// year ago keeps opening the right invitation after any number of renames,
// because the only durable thing it has to carry is "which invitation", and
// the current address is looked up at the moment it is scanned.
async function resolveTarget(req, res, withGuest) {
  const wedding = await publishedWedding(req.params.weddingSlug);
  if (!wedding) return res.status(404).json({ error: 'wedding not found' });

  const couple = {
    bride: wedding.bride || null,
    groom: wedding.groom || null,
    date_label: wedding.date_label || null,
    city: wedding.city || null,
  };

  if (!withGuest) {
    if (wedding.open_revoked_at) return res.status(410).json(GONE);
    return res.json({
      ...couple,
      wedding_slug: wedding.slug,
      invitee_slug: null,
      name: null,
      path: `/${wedding.slug}`,
    });
  }

  const guest = await resolveGuest(wedding.id, req.params.inviteeSlug);
  if (!guest) return res.status(404).json({ error: 'invitee not found' });
  if (guest.revoked_at) return res.status(410).json(GONE);

  res.json({
    ...couple,
    wedding_slug: wedding.slug,
    invitee_slug: guest.slug,
    name: guest.name || null,
    path: `/${wedding.slug}/${guest.slug}`,
  });
}

router.get('/:weddingSlug/resolve', (req, res) => resolveTarget(req, res, false));
router.get('/:weddingSlug/resolve/:inviteeSlug', (req, res) => resolveTarget(req, res, true));

// ── Public: the open invitation, /<weddingSlug> with no invitee ─────────────
// GET /api/weddings/:weddingSlug/invite
// The shareable link has no guest behind it — the visitor names themselves in
// the RSVP form — so this returns the wedding alone.
router.get('/:weddingSlug/invite', async (req, res) => {
  const wedding = await publishedWedding(req.params.weddingSlug);
  if (!wedding) return res.status(404).json({ error: 'wedding not found' });
  if (wedding.open_revoked_at) return res.status(410).json(GONE);
  res.json({ wedding, guest: null, open_rsvp: wedding.open_rsvp !== false, wishes: await publicWishes(wedding.id) });
});

// Public: the open form posts here. Unlike the personalised RSVP there is no
// existing row to update — one is created from what the visitor typed, and
// marked `source: 'self'` so the couple can tell it apart in the portal.
// POST /api/weddings/:weddingSlug/rsvp
router.post('/:weddingSlug/rsvp', async (req, res) => {
  const wedding = await publishedWedding(req.params.weddingSlug);
  if (!wedding) return res.status(404).json({ error: 'wedding not found' });
  if (wedding.open_revoked_at) return res.status(410).json(GONE);
  if (wedding.open_rsvp === false) {
    return res.status(403).json({ error: 'this wedding is not accepting open replies' });
  }

  const name = String(req.body.name || '').trim().slice(0, 200);
  const phone = String(req.body.phone || '').trim().slice(0, 40);
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!phone) return res.status(400).json({ error: 'phone is required' });
  if (digits(phone).length < 9) return res.status(400).json({ error: 'phone number looks incomplete' });

  // Which of the two families the visitor belongs to. Optional — an older
  // form, or a guest who skipped it, simply leaves it unset.
  const side = req.body.side === undefined || req.body.side === null || req.body.side === ''
    ? null
    : String(req.body.side);
  if (side !== null && side !== 'bride' && side !== 'groom') {
    return res.status(400).json({ error: "side must be 'bride' or 'groom'" });
  }

  const attending = req.body.attending === undefined ? 'yes' : req.body.attending;
  if (attending !== 'yes' && attending !== 'no') {
    return res.status(400).json({ error: "attending must be 'yes' or 'no'" });
  }
  const accepted = attending === 'yes';

  const requested = Number(req.body.attending_count);
  const heads = accepted
    ? Math.min(Math.max(Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 1, 1), OPEN_MAX_SEATS)
    : 0;

  const note = typeof req.body.note === 'string' ? req.body.note.slice(0, 2000) : '';

  const fields = {
    name,
    phone,
    side,
    household: '',
    rsvp_status: accepted ? 'attending' : 'declined',
    max_seats: Math.max(heads, 1),
    attending_count: heads,
    adults_count: heads,
    kids_count: 0,
    message: note,
    source: 'self',
    responded_at: db.fn.now(),
    updated_at: db.fn.now(),
  };

  // Someone re-submitting from the same phone is correcting their reply, not
  // adding a second household — update the row they already created rather
  // than leaving the couple two conflicting head counts to reconcile.
  const existing = await findSelfGuestByPhone(wedding.id, phone);
  let guest;
  if (existing) {
    [guest] = await db('guests').where({ id: existing.id }).update(fields).returning('*');
  } else {
    guest = await insertGuest({
      ...fields,
      wedding_id: wedding.id,
      slug: await uniqueGuestSlug(wedding.id, slugify(name) || 'guest'),
    });
  }

  await db('invitation_events').insert({
    guest_id: guest.id,
    slug: guest.slug,
    wedding_id: wedding.id,
    wedding_slug: wedding.slug,
    event_type: 'rsvp',
    ip: req.ip,
    user_agent: req.get('user-agent'),
    referer: req.get('referer'),
    url: `/${wedding.slug}`,
    meta: JSON.stringify({
      source: 'self',
      returning: Boolean(existing),
      rsvp_status: guest.rsvp_status,
      attending_count: guest.attending_count,
    }),
  });

  res.status(existing ? 200 : 201).json(publicGuest(guest));
});

// ── Public: everything the invitation page needs, in one call ───────────────
// GET /api/weddings/:weddingSlug/invite/:inviteeSlug
router.get('/:weddingSlug/invite/:inviteeSlug', async (req, res) => {
  const wedding = await resolveWedding(req.params.weddingSlug);
  if (!wedding || !wedding.published) return res.status(404).json({ error: 'wedding not found' });

  const guest = await resolveGuest(wedding.id, req.params.inviteeSlug);
  if (!guest) return res.status(404).json({ error: 'invitee not found' });
  // The couple ends up fielding "the link you sent me is broken" either way,
  // so a withdrawn invitation says so plainly instead of pretending it never
  // existed. Nothing about the guest goes out with it.
  if (guest.revoked_at) return res.status(410).json(GONE);

  res.json({ wedding, guest: publicGuest(guest), wishes: await publicWishes(wedding.id) });
});

// Public: the invitation's own RSVP form posts here. Addressed by the same
// two slugs as the page itself, so the site never needs a guest id, and only
// the fields a guest can actually set are read from the body.
// POST /api/weddings/:weddingSlug/rsvp/:inviteeSlug
router.post('/:weddingSlug/rsvp/:inviteeSlug', async (req, res) => {
  const wedding = await resolveWedding(req.params.weddingSlug);
  if (!wedding || !wedding.published) return res.status(404).json({ error: 'wedding not found' });

  const guest = await resolveGuest(wedding.id, req.params.inviteeSlug);
  if (!guest) return res.status(404).json({ error: 'invitee not found' });
  if (guest.revoked_at) return res.status(410).json(GONE);

  const { attending, name, note, attending_count, adults_count, kids_count, dietary } = req.body;
  if (attending !== 'yes' && attending !== 'no') {
    return res.status(400).json({ error: "attending must be 'yes' or 'no'" });
  }
  const accepted = attending === 'yes';

  // A declining guest brings no one, whatever the form said. An accepting one
  // defaults to a single seat and can never exceed the seats allotted.
  const requested = Number(attending_count);
  const heads = accepted
    ? Math.min(Math.max(Number.isFinite(requested) && requested > 0 ? requested : 1, 1), guest.max_seats)
    : 0;

  const patch = {
    rsvp_status: accepted ? 'attending' : 'declined',
    attending_count: heads,
    adults_count: accepted ? Math.min(Number(adults_count) || heads, heads) : 0,
    kids_count: accepted ? Math.min(Number(kids_count) || 0, heads) : 0,
    responded_at: db.fn.now(),
    updated_at: db.fn.now(),
  };
  if (typeof note === 'string') patch.message = note.slice(0, 2000);
  if (typeof dietary === 'string') patch.dietary = dietary.slice(0, 500);
  // The guest may correct the name the invitation was addressed to.
  if (typeof name === 'string' && name.trim()) patch.name = name.trim().slice(0, 200);

  const [updated] = await db('guests').where({ id: guest.id }).update(patch).returning('*');

  await db('invitation_events').insert({
    guest_id: guest.id,
    slug: guest.slug,
    wedding_id: wedding.id,
    wedding_slug: wedding.slug,
    event_type: 'rsvp',
    ip: req.ip,
    user_agent: req.get('user-agent'),
    referer: req.get('referer'),
    url: `/${wedding.slug}/${guest.slug}`,
    meta: JSON.stringify({ rsvp_status: updated.rsvp_status, attending_count: updated.attending_count }),
  });

  res.json(publicGuest(updated));
});

export default router;
