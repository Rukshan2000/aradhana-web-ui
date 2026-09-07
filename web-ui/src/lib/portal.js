/* Where the admin portal (portal-app) is served from. The landing page at `/`
   sends couples there to sign in or create a wedding.

   process.env first, for the same reason as lib/api.js: the container image is
   built long before the environment exists, so an unprefixed
   `import.meta.env.PORTAL_BASE` would be inlined as `undefined` at build time.
   Unlike API_BASE this one *does* reach the browser — it is only ever a link
   href, never a fetch — so it is safe to render into the page. */
export const PORTAL_BASE =
  (typeof process !== 'undefined' && process.env?.PORTAL_BASE) ||
  import.meta.env.PORTAL_BASE ||
  import.meta.env.PUBLIC_PORTAL_BASE ||
  'https://guestbookportal.kwingsmedia.com';

export const portalUrl = (path = '') => `${PORTAL_BASE}${path}`;
