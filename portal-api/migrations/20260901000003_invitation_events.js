/**
 * Per-visit tracking: which invitation was opened, the IP, the URL, whether a
 * link/RSVP was clicked, user agent, referrer, etc.
 */
export async function up(knex) {
  await knex.schema.createTable('invitation_events', (t) => {
    t.increments('id').primary();
    t.integer('guest_id').references('id').inTable('guests').onDelete('SET NULL');
    t.string('slug');                 // guest slug from the opened URL
    t.string('event_type').notNullable().defaultTo('open'); // open|click|rsvp|view
    t.string('ip');
    t.text('user_agent');
    t.text('referer');
    t.text('url');                    // full path/URL that was opened
    t.string('country');
    t.string('city');
    t.string('device');               // mobile|desktop|tablet
    t.jsonb('meta');                  // anything extra (which button, etc.)
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.alterTable('invitation_events', (t) => {
    t.index(['guest_id']);
    t.index(['slug']);
    t.index(['event_type']);
    t.index(['created_at']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('invitation_events');
}
