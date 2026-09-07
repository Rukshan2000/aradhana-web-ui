/**
 * Everything about a wedding beyond its couple/date/venue fields — hero
 * photo, love story, gallery, day-of schedule, venue photo, music, studio
 * credit — was hardcoded per-deployment in web-ui/src/data/wedding.json.
 * A single flexible jsonb column lets each wedding carry its own version of
 * that content without a table per content type; the admin panel edits it as
 * one structured document and the public site merges it over built-in
 * defaults for whatever a wedding leaves unset.
 */
export async function up(knex) {
  await knex.schema.alterTable('weddings', (t) => {
    t.jsonb('content').notNullable().defaultTo('{}');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('weddings', (t) => {
    t.dropColumn('content');
  });
}
