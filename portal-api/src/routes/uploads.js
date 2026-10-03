import { asyncRouter } from '../asyncRouter.js';
import multer from 'multer';
import { uploadImage, deleteImage } from '../s3.js';
import { shrinkImage } from '../shrink.js';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = asyncRouter();

// Every route here is portal-only — nothing web-ui calls lives in this file.
router.use(requireAuth);
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_AUDIO_SIZE = 15 * 1024 * 1024; // 15 MB — a few minutes of mp3
// multer needs one ceiling for the stream; the per-category limit below is
// enforced afterwards, once we know which kind of file this is.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(MAX_IMAGE_SIZE, MAX_AUDIO_SIZE) },
});

// Upload one image or audio track -> stored in MinIO, recorded in the images
// table, tagged with the caller's own wedding. form-data: file=<file>,
// category?, alt?, guest_id? (or slug?). category 'music' is the only
// non-image kind; everything else is treated and size-limited as a photo.
// multer rejects an oversized file before the route body runs; surface that
// as the same 400 shape as our other validation errors instead of a generic
// 500 from the default error handler.
function uploadSingle(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `file must be ${Math.max(MAX_IMAGE_SIZE, MAX_AUDIO_SIZE) / (1024 * 1024)}MB or smaller` });
    }
    next(err);
  });
}

router.post('/', uploadSingle, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });

  const wedding = await db('weddings').where({ owner_id: req.user.id }).first();
  if (!wedding) return res.status(400).json({ error: 'create a wedding before uploading images' });

  const { category = 'gallery', alt, slug } = req.body;
  const maxSize = category === 'music' ? MAX_AUDIO_SIZE : MAX_IMAGE_SIZE;
  if (req.file.size > maxSize) {
    return res.status(400).json({ error: `${category === 'music' ? 'audio' : 'image'} must be ${maxSize / (1024 * 1024)}MB or smaller` });
  }
  let guest_id = req.body.guest_id ? Number(req.body.guest_id) : null;

  try {
    if (!guest_id && slug) {
      const g = await db('guests').where({ wedding_id: wedding.id, slug }).first();
      guest_id = g ? g.id : null;
    }
    // An explicit guest_id must be one of the caller's own guests — otherwise
    // a photo could be attached to someone else's invitee.
    if (guest_id) {
      const owns = await db('guests').where({ id: guest_id, wedding_id: wedding.id }).first();
      if (!owns) return res.status(404).json({ error: 'guest not found' });
    }

    let { buffer, originalname, mimetype, size } = req.file;
    const shrunk = category === 'music' ? null : await shrinkImage(buffer, mimetype);
    if (shrunk) {
      buffer = shrunk;
      originalname = originalname.replace(/\.[^.]*$/, '') + '.jpg';
      mimetype = 'image/jpeg';
      size = shrunk.length;
    }

    const { key, bucket, url } = await uploadImage(buffer, originalname, mimetype, category);

    const [image] = await db('images')
      .insert({
        wedding_id: wedding.id,
        guest_id,
        category,
        bucket,
        object_key: key,
        url,
        alt,
        mime_type: mimetype,
        size_bytes: size,
      })
      .returning('*');

    // If it's a guest photo, link it on the guest row too.
    if (guest_id && category === 'guest') {
      await db('guests').where({ id: guest_id }).update({ photo_url: url, updated_at: db.fn.now() });
    }

    res.status(201).json(image);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// List images belonging to the caller's own wedding (optionally by category
// or guest). No wedding of their own yet -> no images.
router.get('/', async (req, res) => {
  const wedding = await db('weddings').where({ owner_id: req.user.id }).first();
  if (!wedding) return res.json([]);

  const q = db('images').where({ wedding_id: wedding.id }).orderBy('created_at', 'desc');
  if (req.query.category) q.where('category', req.query.category);
  if (req.query.guest_id) {
    const id = Number(req.query.guest_id);
    const owns = await db('guests').where({ id, wedding_id: wedding.id }).first();
    if (!owns) return res.status(404).json({ error: 'guest not found' });
    q.where('guest_id', id);
  }
  res.json(await q);
});

// Delete one of the caller's own images — from the bucket and the images
// table. Guests referencing it via photo_url just keep the (now dead) URL;
// nothing else in the schema points at an image row by id.
router.delete('/:id', async (req, res) => {
  const wedding = await db('weddings').where({ owner_id: req.user.id }).first();
  if (!wedding) return res.status(404).json({ error: 'image not found' });

  const image = await db('images').where({ id: req.params.id, wedding_id: wedding.id }).first();
  if (!image) return res.status(404).json({ error: 'image not found' });

  await deleteImage(image.object_key);
  await db('images').where({ id: image.id }).delete();

  res.status(204).end();
});

export default router;
