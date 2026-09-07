/**
 * A registered user manages exactly one wedding — enforced by a unique
 * constraint on owner_id (NULLs are exempt, so any number of weddings can
 * stay unowned).
 *
 * Weddings created before accounts existed predate this rule, and this
 * system had more than one such wedding by the time it was added: only the
 * oldest is handed to the bootstrap admin, so the one-wedding-per-user
 * constraint holds from the start. Any others are left with owner_id null —
 * present in the data, invisible to the ownership-scoped API — until
 * someone assigns them explicitly.
 */
export async function up(knex) {
  await knex.schema.alterTable('weddings', (t) => {
    t.integer('owner_id').references('id').inTable('users').onDelete('SET NULL');
    t.index(['owner_id']);
  });

  const firstUser = await knex('users').orderBy('id').first();
  const oldestWedding = await knex('weddings').orderBy('created_at').first();
  if (firstUser && oldestWedding) {
    await knex('weddings').where({ id: oldestWedding.id }).update({ owner_id: firstUser.id });
  }

  await knex.schema.alterTable('weddings', (t) => {
    t.unique(['owner_id']);
  });
}

export async function down(knex) {
  await knex.schema.alterTable('weddings', (t) => {
    t.dropUnique(['owner_id']);
    t.dropColumn('owner_id');
  });
}
