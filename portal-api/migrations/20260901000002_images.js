/**
 * Images uploaded to S3/MinIO (guest photos, gallery, story, hero, venue ...).
 */
export async function up(knex) {
  await knex.schema.createTable('images', (t) => {
    t.increments('id').primary();
    t.integer('guest_id').references('id').inTable('guests').onDelete('SET NULL');
    t.string('category').notNullable().defaultTo('gallery'); // hero|story|gallery|venue|guest
    t.string('bucket').notNullable();
    t.string('object_key').notNullable();   // path inside the bucket
    t.string('url').notNullable();          // public URL
    t.string('alt');
    t.string('mime_type');
    t.integer('size_bytes');
    t.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('images');
}
