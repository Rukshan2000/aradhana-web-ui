/**
 * An explicit URL for the QR code, overriding the invitation address.
 *
 * Aliases solve the case where a printed card should still reach its
 * invitation. This solves the opposite one: a QR that has to encode something
 * the system does not own at all — a short link the couple already had
 * printed, a redirect service, a venue's own page.
 *
 * Null means "use the invitation URL", which is what almost every row wants,
 * so the column stays empty until somebody deliberately points a code
 * somewhere else.
 */
export async function up(knex) {
  await knex.schema.alterTable('guests', (t) => t.string('qr_url', 2048));
  await knex.schema.alterTable('weddings', (t) => t.string('qr_url', 2048));
}

export async function down(knex) {
  await knex.schema.alterTable('guests', (t) => t.dropColumn('qr_url'));
  await knex.schema.alterTable('weddings', (t) => t.dropColumn('qr_url'));
}
