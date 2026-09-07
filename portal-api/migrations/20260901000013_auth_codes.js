/**
 * One-time email codes, used for two flows that both prove "you can read this
 * inbox": signing in without a password, and resetting a forgotten one.
 *
 * Only a bcrypt hash of the code is stored — a leaked table row must not let
 * anyone sign in. `attempts` caps guessing on a 6-digit code, and
 * `consumed_at` makes a code single-use rather than reusable until expiry.
 */
export async function up(knex) {
  await knex.schema.createTable('auth_codes', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('purpose').notNullable(); // 'login' | 'password_reset'
    t.string('code_hash').notNullable();
    t.timestamp('expires_at').notNullable();
    t.timestamp('consumed_at');
    t.integer('attempts').notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.index(['user_id', 'purpose']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('auth_codes');
}
