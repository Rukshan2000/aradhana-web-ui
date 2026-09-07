/** "Tharu & Sithika" -> "tharu-sithika". Used wherever a slug can be
 *  supplied by a client, so URL-breaking characters never reach the DB. */
export function slugify(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
