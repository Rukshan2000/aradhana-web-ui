import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { db } from '../src/db.js';
import { insertGuest } from '../src/guestCode.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_UI = join(__dirname, '../../web-ui/src/data');
const GUESTS_DIR = join(WEB_UI, 'guests');

/* Seeds the original single-wedding content as one wedding row plus its
   invitees, so /<weddingSlug>/<inviteeSlug> works straight after migrating. */
async function main() {
  const data = JSON.parse(await readFile(join(WEB_UI, 'wedding.json'), 'utf8'));
  const { couple, rsvp, hero, story, gallery, galleryPool, details, schedule, venuePhoto, music, credit } = data;
  const slug = process.env.SEED_WEDDING_SLUG || 'aradhana-sithika';

  const fields = {
    slug,
    bride: couple.bride,
    groom: couple.groom,
    hashtag: couple.hashtag,
    city: couple.city,
    event_date: couple.date,
    date_label: couple.dateLabel,
    year_label: couple.yearLabel,
    reply_by: rsvp?.replyBy,
    // Everything else — hero photo, story, gallery, schedule, music, credit —
    // is free-form per wedding; this is only the starting content for the
    // one wedding that predates the admin panel's own content editor.
    content: JSON.stringify({ hero, story, gallery, galleryPool, details, schedule, venuePhoto, music, credit }),
  };

  // content is only set on the first insert — re-running the seed must not
  // clobber whatever an admin has since edited in the portal.
  const [wedding] = await db('weddings')
    .insert(fields)
    .onConflict('slug')
    .merge(['bride', 'groom', 'hashtag', 'city', 'event_date', 'date_label', 'year_label', 'reply_by'])
    .returning('*');

  const files = (await readdir(GUESTS_DIR)).filter((f) => f.endsWith('.json'));
  let inserted = 0;
  for (const f of files) {
    const g = JSON.parse(await readFile(join(GUESTS_DIR, f), 'utf8'));
    if (!g.slug || !g.name) continue;

    // The code is assigned by insertGuest, never taken from the JSON, so a
    // re-seed leaves existing guests' codes untouched.
    const fields = { name: g.name, household: g.household || '' };
    const existing = await db('guests').where({ wedding_id: wedding.id, slug: g.slug }).first();
    if (existing) {
      await db('guests').where({ id: existing.id }).update({ ...fields, updated_at: db.fn.now() });
    } else {
      await insertGuest({ wedding_id: wedding.id, slug: g.slug, ...fields });
    }
    inserted++;
  }
  console.log(`Seeded wedding "${wedding.slug}" with ${inserted} invitees.`);
  console.log(`Try: http://localhost:4321/${wedding.slug}/<inviteeSlug>`);
  await db.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
