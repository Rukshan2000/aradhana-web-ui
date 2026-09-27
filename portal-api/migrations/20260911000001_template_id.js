/**
 * Which visual design the public invitation page renders for a wedding.
 * Defaults to 'classic' so every existing wedding keeps its current look.
 */
export async function up(knex) {
  await knex.schema.alterTable('weddings', (t) => t.string('template_id').notNullable().defaultTo('classic'));
}

export async function down(knex) {
  await knex.schema.alterTable('weddings', (t) => t.dropColumn('template_id'));
}
