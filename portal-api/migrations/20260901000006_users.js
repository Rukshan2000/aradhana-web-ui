/**
 * Portal accounts (staff who manage weddings/guests), separate from the
 * `guests` table, which is invitee data with no login of its own.
 */
export async function up(knex) {
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('email').notNullable().unique();
    t.string('password_hash').notNullable();
    t.string('name').notNullable();
    t.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('users');
}
