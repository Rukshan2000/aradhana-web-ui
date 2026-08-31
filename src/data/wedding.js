/* All page content lives in wedding.json — names, dates, copy, photo URLs,
   the schedule, the music cue, the studio credit. Edit that file to change
   the site; this module only re-exports it under the names the components
   already import, so nothing else has to know where the data came from. */
import data from './wedding.json';

export const {
  couple,
  guest,
  hero,
  story,
  gallery,
  galleryPool,
  details,
  schedule,
  venuePhoto,
  rsvp,
  music,
  credit,
} = data;

export default data;

/* One JSON per invited household in src/data/guests/. The filename is the
   URL slug: guests/kevin.json is served at /kevin. Adding a file is all it
   takes to publish a new personalised invitation — no code change. */
const files = import.meta.glob('./guests/*.json', { eager: true });

export const guests = Object.entries(files)
  .map(([path, mod]) => {
    const record = mod.default ?? mod;
    const slug = record.slug || path.split('/').pop().replace('.json', '');
    return { id: record.id || slug.toUpperCase(), ...record, slug };
  })
  .sort((a, b) => a.slug.localeCompare(b.slug));

export const guestBySlug = (slug) => guests.find((g) => g.slug === slug) || null;
export const guestById = (id) => guests.find((g) => g.id === id) || null;
