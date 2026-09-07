/**
 * The date labels printed on the invitation, derived from the picked date so
 * nobody has to type them by hand. They stay editable in the form, because
 * plenty of couples word their own invitations differently.
 *
 * Numerals, not words: "Monday, 26 October 2026" rather than "Monday, the
 * twenty-sixth of October". The ordinals below are kept because `replyByLabel`
 * still reads more naturally spelled out on its own line.
 */

const ORDINALS = [
  '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh',
  'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth',
  'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth',
  'nineteenth', 'twentieth', 'twenty-first', 'twenty-second', 'twenty-third',
  'twenty-fourth', 'twenty-fifth', 'twenty-sixth', 'twenty-seventh',
  'twenty-eighth', 'twenty-ninth', 'thirtieth', 'thirty-first',
];

const ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** 0–99 in words: 26 -> "twenty six" (no hyphen, to match invitation style). */
function tensInWords(n) {
  if (n < 20) return ONES[n];
  const rest = n % 10;
  return TENS[Math.floor(n / 10)] + (rest ? ` ${ONES[rest]}` : '');
}

/**
 * Parses the `datetime-local` value ("2026-12-12T16:30") as local time. `new
 * Date(value)` would be fine in modern browsers but building the parts
 * explicitly keeps it unambiguous, and returns null for partial input while
 * the user is still typing into the picker.
 */
export function parseLocal(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Monday, 26 October 2026" */
export function dateLabel(value) {
  const d = parseLocal(value);
  if (!d) return '';
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026". `dateLabel` already ends with the year, so the invitation drops
 *  this second line rather than printing it twice — see Invitation.astro. */
export function yearLabel(value) {
  const d = parseLocal(value);
  return d ? String(d.getFullYear()) : '';
}

/** A month before the wedding: "01 September 2026". */
export function replyByLabel(value) {
  const d = parseLocal(value);
  if (!d) return '';
  const by = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `01 ${MONTHS[by.getMonth()]} ${by.getFullYear()}`;
}
