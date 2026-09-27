/**
 * Whether the invitation's wishes carousel includes the three built-in sample
 * wishes alongside real guest notes. On by default so existing pages keep them.
 */
export async function up(knex) {
  await knex.schema.alterTable('weddings', (t) => t.boolean('sample_wishes').notNullable().defaultTo(true));
}

export async function down(knex) {
  await knex.schema.alterTable('weddings', (t) => t.dropColumn('sample_wishes'));
}
