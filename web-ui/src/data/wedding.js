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
