/**
 * Aliases for invitation URLs that are already printed.
 *
 * A QR code on a wedding card encodes its URL literally — there is no
 * redirect inside the ink. So the moment a slug is edited, every card in
 * every guest's hand points at a 404, and nothing in the system remembers
 * where it used to point.
 *
 * This table is that memory. Each row says "this segment used to mean this
 * wedding/guest", and the public lookups fall back to it when a direct slug
 * match fails:
 *
 *   kind = 'wedding'  → alias is a first segment:  /<alias>/anyone
 *   kind = 'guest'    → alias is a second segment: /<wedding>/<alias>
 *
 * Rows are written automatically whenever a slug is edited, and by hand from
 * the portal for a card whose printed URL never existed in the system at all
 * (a typo at the print shop, a link written from memory).
 *
 * A live slug always wins: resolution tries `weddings`/`guests` first and only
 * then this table, so an alias can never shadow a real invitation.
 */
export async function up(knex) {
  await knex.schema.createTable('link_aliases', (t) => {
    t.increments('id').primary();
    t.string('kind').notNullable();            // 'wedding' | 'guest'
    t.string('alias').notNullable();           // the printed slug segment
    t.integer('wedding_id').notNullable().references('id').inTable('weddings').onDelete('CASCADE');
    // Null for a wedding alias, which covers the whole first segment and so
    // rescues every printed card of that wedding at once.
    t.integer('guest_id').references('id').inTable('guests').onDelete('CASCADE');
    t.string('source').notNullable().defaultTo('rename');  // 'rename' | 'manual'
    t.timestamps(true, true);
    t.index(['kind', 'alias']);
  });

  // A first segment has to mean exactly one wedding across the whole system;
  // a second segment only has to be unambiguous inside its own wedding.
  await knex.raw(`
    CREATE UNIQUE INDEX link_aliases_wedding_alias
      ON link_aliases (alias) WHERE kind = 'wedding'
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX link_aliases_guest_alias
      ON link_aliases (wedding_id, alias) WHERE kind = 'guest'
  `);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('link_aliases');
}
