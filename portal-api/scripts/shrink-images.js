// One-off: shrink photos uploaded before the upload route started resizing.
// Each original is first copied to originals/<key>, then the web-sized JPEG is
// written back under the SAME key, so every URL already saved in wedding
// content keeps working. Dry run by default; pass --apply to write.
//
//   docker compose run --rm portal-api node scripts/shrink-images.js [--apply]
import 'dotenv/config';
import { GetObjectCommand, CopyObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from '../src/db.js';
import { s3 } from '../src/s3.js';
import { shrinkImage } from '../src/shrink.js';

const apply = process.argv.includes('--apply');
const Bucket = process.env.S3_BUCKET;
const MIN_BYTES = 600 * 1024; // smaller files aren't worth a re-encode

const rows = await db('images').whereNot({ category: 'music' }).where('size_bytes', '>', MIN_BYTES);
let saved = 0;

for (const row of rows) {
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket, Key: row.object_key }));
    const buffer = Buffer.from(await obj.Body.transformToByteArray());
    const shrunk = await shrinkImage(buffer, obj.ContentType || row.mime_type);
    if (!shrunk) { console.log(`skip  ${row.object_key}`); continue; }

    console.log(`${apply ? 'shrink' : 'would'} ${row.object_key}  ${(buffer.length / 1e6).toFixed(1)}MB -> ${(shrunk.length / 1e6).toFixed(2)}MB`);
    saved += buffer.length - shrunk.length;
    if (!apply) continue;

    await s3.send(new CopyObjectCommand({ Bucket, Key: `originals/${row.object_key}`, CopySource: `${Bucket}/${row.object_key}` }));
    await s3.send(new PutObjectCommand({
      Bucket,
      Key: row.object_key,
      Body: shrunk,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    await db('images').where({ id: row.id }).update({ mime_type: 'image/jpeg', size_bytes: shrunk.length });
  } catch (err) {
    console.error(`fail  ${row.object_key}: ${err.message}`);
  }
}

console.log(`${rows.length} candidates, ${(saved / 1e6).toFixed(1)}MB ${apply ? 'saved' : 'would be saved'}`);
await db.destroy();
