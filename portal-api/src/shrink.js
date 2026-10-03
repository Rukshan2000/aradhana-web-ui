import sharp from 'sharp';

// Couples upload straight off the camera — 10–14 MB originals that guests on a
// phone in Sri Lanka then pull from a server in France. Nothing on the site is
// shown wider than a full-bleed hero, so 2400px on the long edge is plenty.
const MAX_EDGE = 2400;

/**
 * Downscale a photo to a web-sized JPEG. Returns null when the input isn't
 * something we should touch (GIF animation, SVG) or can't be decoded (e.g.
 * HEIC, which sharp's prebuilt binary lacks) — the caller keeps the original.
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<Buffer|null>}
 */
export async function shrinkImage(buffer, mimeType) {
  if (!/^image\/(jpe?g|png|webp|tiff|avif)$/i.test(mimeType || '')) return null;
  try {
    const out = await sharp(buffer)
      .rotate() // bake in EXIF orientation before the metadata is dropped
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    // An already-small image can come out larger once re-encoded.
    return out.length < buffer.length ? out : null;
  } catch {
    return null;
  }
}
