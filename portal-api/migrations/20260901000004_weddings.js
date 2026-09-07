/**
 * Multi-wedding support.
 *
 * Until now the whole system assumed a single wedding: `guests.slug` was
 * globally unique and the public site served /<guestSlug>. Invitations are now
 * addressed as /<weddingSlug>/<inviteeSlug>, so a guest slug only has to be
 * unique inside its own wedding.
 *
 * Existing rows are adopted by a "legacy" wedding built from the couple in
 * web-ui/src/data/wedding.json, so nothing 404s after the migration.
 */
const LEGACY = {
  slug: 'aradhana-sithika',
  bride: 'Tharu',
  groom: 'Sithika',
  hashtag: '#AradhanaWedsSithika',
  city: 'Kandy, Sri Lanka',
  date_label: 'Saturday, the twelfth of December',
  year_label: 'Two thousand twenty six',
  event_date: '2026-12-12T16:30:00+05:30',
  reply_by: 'the first of November',
};

export async function up(knex) {
  await knex.schema.createTable('weddings', (t) => {
    t.increments('id').primary();
    t.string('slug').notNullable().unique();   // first URL segment: /<slug>/<invitee>
    t.string('bride').notNullable();
    t.string('groom').notNullable();
    t.string('hashtag');
    t.string('city');
    t.timestamp('event_date');
    t.string('date_label');                    // "Saturday, the twelfth of December"
    t.string('year_label');                    // "Two thousand twenty six"
    t.string('reply_by');                      // RSVP deadline, as displayed
    t.string('venue');
    t.text('notes');
    t.boolean('published').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // Adopt whatever is already in `guests` so existing invitations keep working.
  const [legacy] = await knex('weddings').insert(LEGACY).returning('*');

  await knex.schema.alterTable('guests', (t) => {
    t.integer('wedding_id').references('id').inTable('weddings').onDelete('CASCADE');
  });
  await knex('guests').update({ wedding_id: legacy.id });
  await knex.schema.alterTable('guests', (t) => {
    t.integer('wedding_id').notNullable().alter();
  });

  // A slug is now unique per wedding, not globally. Same for the guest code.
  await knex.schema.alterTable('guests', (t) => {
    t.dropUnique(['slug']);
    t.dropUnique(['code']);
    t.unique(['wedding_id', 'slug']);
    t.unique(['wedding_id', 'code']);
    t.index(['wedding_id']);
  });

  // Tracking needs to know which wedding a hit belongs to; `slug` alone is
  // no longer unique across the system.
  await knex.schema.alterTable('invitation_events', (t) => {
    t.integer('wedding_id').references('id').inTable('weddings').onDelete('SET NULL');
    t.string('wedding_slug');
  });
  await knex('invitation_events').update({ wedding_id: legacy.id, wedding_slug: legacy.slug });
  await knex.schema.alterTable('invitation_events', (t) => {
    t.index(['wedding_id']);
  });
}

export async function down(knex) {
  await knex.schema.alterTable('invitation_events', (t) => {
    t.dropColumn('wedding_id');
    t.dropColumn('wedding_slug');
  });
  await knex.schema.alterTable('guests', (t) => {
    t.dropUnique(['wedding_id', 'slug']);
    t.dropUnique(['wedding_id', 'code']);
    t.dropColumn('wedding_id');
    t.unique(['slug']);
    t.unique(['code']);
  });
  await knex.schema.dropTableIfExists('weddings');
}
