import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { nanoid } from 'nanoid';

const BUCKET = process.env.S3_BUCKET;
const PUBLIC_URL = (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '');

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: true, // required for MinIO
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

/**
 * Upload a buffer to the bucket and return { key, url }.
 * @param {Buffer} buffer
 * @param {string} originalName
 * @param {string} mimeType
 * @param {string} [prefix] folder inside the bucket (e.g. "guests", "gallery")
 */
export async function uploadImage(buffer, originalName, mimeType, prefix = 'uploads') {
  const ext = (originalName.split('.').pop() || 'bin').toLowerCase();
  const key = `${prefix}/${Date.now()}-${nanoid(10)}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      // Keys are never reused, so the browser can keep the file for good.
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return { key, bucket: BUCKET, url: `${PUBLIC_URL}/${key}` };
}

/** Remove an object from the bucket. */
export async function deleteImage(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
