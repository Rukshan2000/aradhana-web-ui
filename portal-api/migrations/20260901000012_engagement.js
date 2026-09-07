/**
 * How far an invitation was actually read.
 *
 * `open_count` says the page was fetched; it says nothing about whether the
 * guest ever reached the RSVP form at the bottom. The page now reports scroll
 * depth and which buttons were pressed as `scroll` / `click` events, and the
 * deepest point any visit reached is kept on the guest row so the couple can
 * see it without aggregating the event log on every page load.
 */
export async function up(knex) {
  await knex.schema.alterTable('guests', (t) => {
    t.integer('max_scroll').notNullable().defaultTo(0); // 0-100, deepest seen
  });
}

export async function down(knex) {
  await knex.schema.alterTable('guests', (t) => t.dropColumn('max_scroll'));
}
