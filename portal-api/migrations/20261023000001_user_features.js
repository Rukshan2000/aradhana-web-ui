/**
 * Per-account feature flags for the public invitation, set by an admin when
 * creating the account. Stores only switched-off sections ({ gallery: false });
 * a missing key means on, so existing accounts keep every section.
 */
export async function up(knex) {
  await knex.schema.alterTable('users', (t) => t.jsonb('features').notNullable().defaultTo('{}'));
}

export async function down(knex) {
  await knex.schema.alterTable('users', (t) => t.dropColumn('features'));
}
