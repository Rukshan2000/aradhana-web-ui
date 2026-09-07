import { asyncRouter } from '../asyncRouter.js';
import { db } from '../db.js';
import { insertGuest, publicGuest } from '../guestCode.js';
import { slugify } from '../slugify.js';
import { recordAlias, normalizeQrUrl } from '../links.js';
import { requireAuth } from '../auth.js';

const router = asyncRouter();

// Every route here is portal-only — nothing web-ui calls lives in this file.
router.use(requireAuth);

/**
 * A user manages at most one wedding, so every route here is implicitly
 * scoped to it — there is no "all guests" view across weddings the caller
 * doesn't own. An explicit ?wedding= (or wedding_slug in the body) is
 * accepted only as a sanity check against that same wedding; naming any
 * other slug 404s rather than switching context.
 */
async function scope(req, res) {
  const own = await db('weddings').where({ owner_id: req.user.id }).first();
  const requested = req.query.wedding || req.body?.wedding_slug;
  if (requested && (!own || own.slug !== requested)) {
    res.status(404).json({ error: `wedding "${requested}" not found` });
    return { failed: true };
  }
  return { wedding: own };
}

/** Adds the public invitation path so the portal can link/copy it directly. */
function withUrl(guest, wedding) {
  if (!guest) return guest;
  return {
    ...publicGuest(guest),
    wedding_slug: wedding?.slug || null,
    url: wedding ? `/${wedding.slug}/${guest.slug}` : null,
  };
}

// List guests in the caller's own wedding. No wedding of their own -> none.
router.get('/', async (req, res) => {
  const { wedding, failed } = await scope(req, res);
  if (failed) return;
  if (!wedding) return res.json([]);
  // The portal lists the two kinds of row on separate tabs: households the
  // couple invited by name ('invited') and people who replied through the
  // open /<weddingSlug> link ('self'). Unfiltered still returns both.
  const { source } = req.query;
  if (source && source !== 'invited' && source !== 'self') {
    return res.status(400).json({ error: "source must be 'invited' or 'self'" });
  }
  const guests = await db('guests')
    .where({ wedding_id: wedding.id })
    .modify((q) => source && q.andWhere({ source }))
    .orderBy(source === 'self' ? 'created_at' : 'name', source === 'self' ? 'desc' : 'asc');
  res.json(guests.map((g) => withUrl(g, wedding)));
});

// Aggregate stats for the caller's own wedding.
// Declared before /:slug so "stats" is not read as a guest slug.
router.get('/stats/summary', async (req, res) => {
  const { wedding, failed } = await scope(req, res);
  if (failed) return;
  if (!wedding) return res.json({ totals: null, byStatus: [] });

  // Four independent aggregates, so they go together rather than one after
  // another: over an SSH tunnel four sequential round trips is a visible
  // pause on the dashboard's first paint.
  const [byStatus, totals, readers, buttons] = await Promise.all([
    db('guests')
      .where({ wedding_id: wedding.id })
      .select('rsvp_status')
      .count('* as guests')
      .sum('attending_count as heads')
      .groupBy('rsvp_status'),

    db('guests')
      .where({ wedding_id: wedding.id })
      .count('* as total_guests')
      .sum('attending_count as total_attending')
      .sum('open_count as total_opens')
      .sum('click_count as total_clicks')
      .avg('max_scroll as avg_scroll')
      .max('max_scroll as best_scroll')
      .first(),

    // How far invitations were actually read, and which buttons were pressed
    // — counted over the event log rather than kept as yet more columns,
    // since the portal is the only thing that ever asks.
    db('guests')
      .where({ wedding_id: wedding.id })
      .where('open_count', '>', 0)
      .select(db.raw(`
        count(*)::int as opened,
        count(*) filter (where max_scroll >= 90)::int as read_to_end,
        count(*) filter (where max_scroll >= 50)::int as read_half
      `))
      .first(),

    db('invitation_events')
      .where({ wedding_id: wedding.id, event_type: 'click' })
      .whereRaw("meta ->> 'label' is not null")
      .select(db.raw("meta ->> 'label' as label"))
      .count('* as presses')
      .groupBy('label')
      .orderBy('presses', 'desc')
      .limit(12),
  ]);

  res.json({ totals, byStatus, readers, buttons });
});

// Get one guest by slug, within the caller's own wedding.
router.get('/:slug', async (req, res) => {
  const { wedding, failed } = await scope(req, res);
  if (failed) return;
  if (!wedding) return res.status(404).json({ error: 'not found' });
  const guest = await db('guests').where({ wedding_id: wedding.id, slug: req.params.slug }).first();
  if (!guest) return res.status(404).json({ error: 'not found' });
  res.json(withUrl(guest, wedding));
});

// Create a guest in the caller's own wedding.
router.post('/', async (req, res) => {
  const { wedding, failed } = await scope(req, res);
  if (failed) return;
  if (!wedding) return res.status(400).json({ error: 'create a wedding before adding guests' });

  const { name, household, side, email, phone, max_seats } = req.body;
  if (!req.body.slug || !name) {
    return res.status(400).json({ error: 'slug and name are required' });
  }
  const slug = slugify(req.body.slug);
  if (!slug) return res.status(400).json({ error: 'slug must contain at least one letter or digit' });

  try {
    // `code` is internal: assigned in insertGuest, never taken from the request.
    const guest = await insertGuest({
      wedding_id: wedding.id, slug, name, household, side, email, phone, max_seats,
    });
    res.status(201).json(withUrl(guest, wedding));
  } catch (err) {
    res.status(400).json({ error: String(err.message || err) });
  }
});

/** Resolves :slug to a guest within the caller's own wedding, or null. */
async function findOne(req, res) {
  const { wedding, failed } = await scope(req, res);
  if (failed) return null;
  if (!wedding) {
    res.status(404).json({ error: 'not found' });
    return null;
  }
  const guest = await db('guests').where({ wedding_id: wedding.id, slug: req.params.slug }).first();
  if (!guest) {
    res.status(404).json({ error: 'not found' });
    return null;
  }
  return { guest, wedding };
}

// Update a guest (any field)
router.patch('/:slug', async (req, res) => {
  const found = await findOne(req, res);
  if (!found) return;
  const { wedding_slug, code, id, wedding_id, ...body } = req.body;
  if (typeof body.slug === 'string') {
    body.slug = slugify(body.slug);
    if (!body.slug) return res.status(400).json({ error: 'slug must contain at least one letter or digit' });
  }
  if ('qr_url' in body) body.qr_url = normalizeQrUrl(body.qr_url);
  const renamedFrom = body.slug && body.slug !== found.guest.slug ? found.guest.slug : null;
  const [guest] = await db('guests')
    .where({ id: found.guest.id })
    .update({ ...body, updated_at: db.fn.now() })
    .returning('*');

  // Only once the row has moved is the old slug free to be claimed as an
  // alias — recordAlias declines one that a live invitation still answers to,
  // so recording this any earlier would silently do nothing.
  if (renamedFrom) {
    await recordAlias({
      kind: 'guest',
      alias: renamedFrom,
      weddingId: found.wedding.id,
      guestId: found.guest.id,
    });
  }
  res.json(withUrl(guest, found.wedding));
});

// Revoke or restore one invitee's URL. The row, its RSVP and its history all
// stay — only the link stops resolving — so a mistakenly revoked invitation is
// restored to the same address the guest was already given.
router.post('/:slug/:action(revoke|restore)', async (req, res) => {
  const found = await findOne(req, res);
  if (!found) return;
  const [guest] = await db('guests')
    .where({ id: found.guest.id })
    .update({
      revoked_at: req.params.action === 'revoke' ? db.fn.now() : null,
      updated_at: db.fn.now(),
    })
    .returning('*');
  res.json(withUrl(guest, found.wedding));
});

// Remove a guest from the caller's own wedding. Their tracking events are
// kept (guest_id goes null) so the open/click history stays honest.
router.delete('/:slug', async (req, res) => {
  const found = await findOne(req, res);
  if (!found) return;
  await db('guests').where({ id: found.guest.id }).del();
  res.status(204).end();
});

// Submit an RSVP for a guest
router.post('/:slug/rsvp', async (req, res) => {
  const found = await findOne(req, res);
  if (!found) return;
  const { rsvp_status, attending_count, adults_count, kids_count, dietary, message } = req.body;
  const [guest] = await db('guests')
    .where({ id: found.guest.id })
    .update({
      rsvp_status: rsvp_status || 'attending',
      attending_count: attending_count ?? 0,
      adults_count: adults_count ?? 0,
      kids_count: kids_count ?? 0,
      dietary,
      message,
      responded_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  await db('invitation_events').insert({
    guest_id: guest.id,
    slug: guest.slug,
    wedding_id: found.wedding.id,
    wedding_slug: found.wedding.slug,
    event_type: 'rsvp',
    ip: req.ip,
    user_agent: req.get('user-agent'),
    meta: JSON.stringify({ rsvp_status: guest.rsvp_status, attending_count: guest.attending_count }),
  });

  res.json(withUrl(guest, found.wedding));
});

export default router;
