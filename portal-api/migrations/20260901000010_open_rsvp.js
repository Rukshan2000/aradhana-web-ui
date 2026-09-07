/**
 * Open ("guest") invitations: /<weddingSlug> with no invitee slug.
 *
 * The personalised link stays as it was — one row per household, created in
 * the portal. This adds the other half: a shareable link anyone can open,
 * where the visitor types their own name, how many are coming and a phone
 * number, and a guest row is created from that reply.
 *
 * `open_rsvp` lets the couple close that form without unpublishing the
 * wedding, and `source` keeps self-registered rows distinguishable from the
 * ones the couple invited by name.
 */
export async function up(knex) {
  await knex.schema.alterTable('weddings', (t) => {
    t.boolean('open_rsvp').notNullable().defaultTo(true);
  });
  await knex.schema.alterTable('guests', (t) => {
    t.string('source').notNullable().defaultTo('invited'); // 'invited' | 'self'
  });
  await knex.schema.alterTable('guests', (t) => {
    t.index(['wedding_id', 'source']);
  });
}

export async function down(knex) {
  await knex.schema.alterTable('guests', (t) => {
    t.dropIndex(['wedding_id', 'source']);
    t.dropColumn('source');
  });
  await knex.schema.alterTable('weddings', (t) => {
    t.dropColumn('open_rsvp');
  });
}
