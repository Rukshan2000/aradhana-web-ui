/**
 * Brings guests created before the code became server-assigned onto the same
 * scheme as new ones: G + the row's own zero-padded primary key.
 *
 * The old codes came from the JSON files (G001, G002 …) and were numbered per
 * wedding, so they would be handed out again to later guests. Deriving from
 * the primary key, which Postgres never reuses, makes a code permanently
 * unique to one invitee.
 *
 * Old and new codes cannot collide during the update: the legacy ones are
 * three digits and these are four.
 */
export async function up(knex) {
  const { rowCount } = await knex.raw(
    `update guests set code = 'G' || lpad(id::text, 4, '0'), updated_at = now()
     where code is distinct from 'G' || lpad(id::text, 4, '0')`,
  );
  console.log(`  → renumbered ${rowCount} guest code(s)`);
}

/**
 * Not reversible: the original codes were only ever in the JSON seed files,
 * so there is nothing to restore them from. Left as a no-op so a rollback of
 * a later migration does not fail here.
 */
export async function down() {}
