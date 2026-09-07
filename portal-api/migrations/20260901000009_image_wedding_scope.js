/**
 * Images previously had no direct link to a wedding — only a nullable
 * guest_id, so a hero/gallery/venue photo (nothing to do with any one
 * guest) had no way to be attributed to a wedding at all and was visible to
 * every account (a known gap called out when uploads were first scoped by
 * owner). Adding wedding_id closes that: every future upload is tagged with
 * the caller's own wedding directly, whether or not it's also linked to a
 * guest.
 *
 * The table is empty at the time of writing, so there is no legacy data to
 * migrate or reattribute.
 */
export async function up(knex) {
  await knex.schema.alterTable('images', (t) => {
    t.integer('wedding_id').references('id').inTable('weddings').onDelete('CASCADE');
    t.index(['wedding_id']);
  });
}

export async function down(knex) {
  await knex.schema.alterTable('images', (t) => {
    t.dropColumn('wedding_id');
  });
}
