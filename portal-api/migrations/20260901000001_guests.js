/**
 * Guests + their RSVP / participation data.
 */
export async function up(knex) {
  await knex.schema.createTable('guests', (t) => {
    t.increments('id').primary();
    t.string('code').notNullable().unique();      // e.g. "G003"
    t.string('slug').notNullable().unique();       // e.g. "dilan"
    t.string('name').notNullable();
    t.string('household').defaultTo('');           // e.g. "and Family"
    t.string('side');                              // 'bride' | 'groom' | null
    t.string('email');
    t.string('phone');
    t.string('photo_url');                         // uploaded to S3/MinIO

    // ── Participation / RSVP ──────────────────────────────────────────────
    t.enu('rsvp_status', ['pending', 'attending', 'declined', 'maybe'], {
      useNative: true,
      enumName: 'rsvp_status_enum',
    }).notNullable().defaultTo('pending');
    t.integer('max_seats').notNullable().defaultTo(2);      // seats allotted
    t.integer('attending_count').notNullable().defaultTo(0);
    t.integer('adults_count').notNullable().defaultTo(0);
    t.integer('kids_count').notNullable().defaultTo(0);
    t.string('dietary');
    t.text('message');

    // ── Aggregate tracking counters (denormalised for quick reads) ────────
    t.integer('open_count').notNullable().defaultTo(0);
    t.integer('click_count').notNullable().defaultTo(0);
    t.timestamp('first_opened_at');
    t.timestamp('last_opened_at');
    t.timestamp('responded_at');

    t.timestamps(true, true); // created_at, updated_at
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('guests');
  await knex.raw('DROP TYPE IF EXISTS rsvp_status_enum');
}
