import { asyncRouter } from '../asyncRouter.js';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = asyncRouter();

function detectDevice(ua = '') {
  if (/mobile/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

// Record an invitation event (open / click / view).
// body: { wedding_slug?, slug?, event_type?, url?, meta? }
//   — IP + UA are taken from the request.
router.post('/', async (req, res) => {
  const { wedding_slug, slug, event_type = 'open', url, meta } = req.body;
  const ua = req.get('user-agent') || '';

  // Guest slugs repeat across weddings, so resolve inside the wedding when the
  // caller names one; without it, only an unambiguous match counts.
  const wedding = wedding_slug
    ? await db('weddings').where({ slug: wedding_slug }).first()
    : null;

  let guest = null;
  if (slug) {
    const rows = await db('guests')
      .where({ slug })
      .modify((q) => wedding && q.andWhere({ wedding_id: wedding.id }));
    if (rows.length === 1) guest = rows[0];
  }

  const [event] = await db('invitation_events')
    .insert({
      guest_id: guest ? guest.id : null,
      slug,
      wedding_id: wedding ? wedding.id : guest?.wedding_id || null,
      wedding_slug: wedding_slug || null,
      event_type,
      ip: req.ip,
      user_agent: ua,
      referer: req.get('referer'),
      url: url || req.originalUrl,
      device: detectDevice(ua),
      meta: meta ? JSON.stringify(meta) : null,
    })
    .returning('*');

  // Keep the denormalised counters on the guest fresh.
  //
  // Computed in SQL rather than read-modify-written in JS: a page reports
  // several scroll milestones and clicks within a few milliseconds, and
  // `count = row.count + 1` on rows all read before any was written loses
  // every increment but the last.
  if (guest) {
    const patch = { updated_at: db.fn.now() };
    if (event_type === 'open') {
      patch.open_count = db.raw('open_count + 1');
      patch.last_opened_at = db.fn.now();
      if (!guest.first_opened_at) patch.first_opened_at = db.fn.now();
    } else if (event_type === 'click') {
      patch.click_count = db.raw('click_count + 1');
    } else if (event_type === 'scroll') {
      // Only ever the high-water mark: a later visit that bounced at the top
      // must not erase the evening they read the whole thing.
      const depth = Math.round(Number(meta?.depth));
      if (Number.isFinite(depth)) {
        patch.max_scroll = db.raw('greatest(max_scroll, ?)', [Math.min(100, Math.max(0, depth))]);
      }
    }
    await db('guests').where({ id: guest.id }).update(patch);
  }

  res.status(201).json(event);
});

// Read events for the caller's own wedding (filter further by slug / type).
// Portal-only: reading events is not something web-ui ever calls.
router.get('/', requireAuth, async (req, res) => {
  const own = await db('weddings').where({ owner_id: req.user.id }).first();
  if (req.query.wedding && (!own || own.slug !== req.query.wedding)) {
    return res.status(404).json({ error: `wedding "${req.query.wedding}" not found` });
  }
  if (!own) return res.json([]);

  const q = db('invitation_events')
    .where('wedding_slug', own.slug)
    .orderBy('created_at', 'desc')
    .limit(Number(req.query.limit || 200));
  if (req.query.slug) q.where('slug', req.query.slug);
  if (req.query.event_type) q.where('event_type', req.query.event_type);
  res.json(await q);
});

export default router;
