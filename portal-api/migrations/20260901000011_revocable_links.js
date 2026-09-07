/**
 * Revocable invitation links.
 *
 * A link that has been shared cannot be unshared — a wrong number on
 * WhatsApp, a forwarded QR code, a guest who is no longer welcome — so each
 * URL gets an off switch that leaves the row (and its RSVP history) intact:
 *
 *   guests.revoked_at          → /<wedding>/<invitee> stops resolving
 *   weddings.open_revoked_at   → /<wedding>, the open link, stops resolving
 *
 * A timestamp rather than a boolean, so the portal can say when it happened,
 * and clearing it restores the same URL rather than minting a new one.
 */
export async function up(knex) {
  await knex.schema.alterTable('guests', (t) => {
    t.timestamp('revoked_at');
  });
  await knex.schema.alterTable('weddings', (t) => {
    t.timestamp('open_revoked_at');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('guests', (t) => t.dropColumn('revoked_at'));
  await knex.schema.alterTable('weddings', (t) => t.dropColumn('open_revoked_at'));
}
