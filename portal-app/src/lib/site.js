// Where the public invitation site (web-ui) is served from. Used to build the
// shareable /<weddingSlug>/<inviteeSlug> links shown in the portal.
export const SITE_BASE = import.meta.env.VITE_SITE_BASE || 'http://localhost:4321';

export const inviteUrl = (weddingSlug, inviteeSlug) =>
  `${SITE_BASE}/${weddingSlug}/${inviteeSlug}`;

/** The open invitation link — /<weddingSlug> with no invitee — that anyone
 *  can be sent; whoever opens it names themselves in the RSVP form. */
export const openInviteUrl = (weddingSlug) => `${SITE_BASE}/${weddingSlug}`;

/** A finished sample invitation, served from web-ui's built-in content. It
 *  needs no wedding of its own, so it works before the couple has created
 *  anything — which is exactly when it is most useful. */
export const demoUrl = () => `${SITE_BASE}/demo`;

/**
 * The permanent landing page for a printed code: /go/<wedding>[/<invitee>].
 *
 * A QR code cannot be reprinted once it is on a card, so it must not carry
 * the invitation's own address — that one is editable. This route is fixed,
 * and the page behind it asks the API for the invitation's current URL on
 * every scan, so renaming a link re-aims the codes already handed out.
 */
export const qrLandingUrl = (weddingSlug, inviteeSlug) =>
  `${SITE_BASE}/go/${weddingSlug}${inviteeSlug ? `/${inviteeSlug}` : ''}`;

/**
 * What a QR code should actually encode for a record: its explicit `qr_url`
 * when one has been set, and otherwise the rename-proof /go/ landing page for
 * this invitation. Keeping this in one place means every QR button, on every
 * page, honours an override the same way.
 *
 * `invitationUrl` is still taken, and is what the portal shows and shares as
 * the link — only the printed code goes the indirect way.
 */
export const qrTarget = (record, invitationUrl, { weddingSlug, inviteeSlug } = {}) => {
  if (record?.qr_url) return record.qr_url;
  if (weddingSlug) return qrLandingUrl(weddingSlug, inviteeSlug);
  return invitationUrl;
};
