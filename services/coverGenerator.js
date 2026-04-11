const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Generate a branded typographic cover using Cloudinary's transformation API.
 * No native dependencies — uses Cloudinary text overlays on a solid background.
 *
 * @param {string} title — Document title
 * @param {string|null} date — Date string
 * @param {string} contentType — 'homily', 'writing', or 'pastoral_letter'
 * @returns {string|null} Cloudinary URL of the generated cover, or null on failure
 */
async function generateCover(title, date, contentType) {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      console.warn('Cover generator: Cloudinary not configured, skipping.');
      return null;
    }

    const labels = { 'homily': 'REFLECTION', 'writing': 'TEACHING', 'pastoral_letter': 'PASTORAL LETTER' };
    const label = labels[contentType] || 'DOCUMENT';

    /* Extract year from date */
    let year = new Date().getFullYear().toString();
    if (date) {
      const match = date.match(/(\d{4})/);
      if (match) year = match[1];
    }

    /* Truncate title for overlay (Cloudinary has URL length limits) */
    let displayTitle = title || 'Untitled';
    if (displayTitle.length > 60) {
      displayTitle = displayTitle.substring(0, 57) + '...';
    }

    /* Encode text for Cloudinary URL (replace spaces, handle special chars) */
    const encTitle = encodeCloudinaryText(displayTitle);
    const encLabel = encodeCloudinaryText(label);
    const encName = encodeCloudinaryText('Archbishop Valerian Okeke');
    const encYear = encodeCloudinaryText(year);
    const encBottom = encodeCloudinaryText('Archdiocese of Onitsha');

    /*
     * Build a Cloudinary URL using transformations on a solid background.
     * We create the image by:
     * 1. Start with a solid navy rectangle
     * 2. Add gold border lines as overlays
     * 3. Add text overlays for label, title, name, year
     */

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    /* Upload a 1x1 navy pixel as base if it doesn't exist, then transform it */
    let baseImageId;
    try {
      baseImageId = await ensureBaseImage();
    } catch (e) {
      console.error('Failed to create base image:', e.message);
      return null;
    }

    /* Build transformation chain */
    const transformations = [
      /* Resize base to cover dimensions */
      'w_800,h_1100,c_scale',
      /* Navy gradient background */
      'b_rgb:1a3c6e',
      /* Top gold line */
      `l_text:serif_3:${encodeCloudinaryText('_'.repeat(80))},co_rgb:c9a84c,g_north,y_60`,
      /* Content type label */
      `l_text:serif_18_bold:${encLabel},co_rgb:c9a84c,g_north,y_280,letter_spacing_6`,
      /* Title — large centered text */
      `l_text:serif_36_bold:${encTitle},co_rgb:ffffff,g_north,y_360,w_640,c_fit`,
      /* Decorative diamond */
      `l_text:serif_20:◆,co_rgb:c9a84c,g_north,y_520`,
      /* Archbishop name */
      `l_text:serif_22_italic:${encName},co_rgb:f0e6d3,g_north,y_580`,
      /* Year */
      `l_text:serif_18:${encYear},co_rgb:c9a84c,g_north,y_620`,
      /* Bottom text */
      `l_text:serif_13:${encBottom},co_rgb:f0e6d3,g_south,y_36`
    ];

    const url = `https://res.cloudinary.com/${cloudName}/image/upload/${transformations.join('/')}/${baseImageId}`;

    return url;
  } catch (err) {
    console.error('Cover generation error:', err.message);
    return null;
  }
}

/**
 * Ensure a 1x1 base image exists in Cloudinary for transformations.
 * Returns the public_id.
 */
async function ensureBaseImage() {
  const publicId = 'archbishop-library/covers/base_navy';

  try {
    /* Check if it already exists */
    await cloudinary.api.resource(publicId);
    return publicId;
  } catch (e) {
    /* Doesn't exist — create a tiny navy PNG and upload it */
    /* 1x1 navy PNG as base64 */
    const pngBuffer = createSolidPng();

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: 'image',
          overwrite: true
        },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(pngBuffer);
    });

    return result.public_id;
  }
}

/**
 * Create a minimal valid 1x1 navy blue PNG buffer (no native deps).
 */
function createSolidPng() {
  /* Minimal valid 1x1 PNG with navy blue (#1a3c6e) pixel */
  /* PNG header + IHDR + IDAT + IEND chunks */
  const r = 0x1a, g = 0x3c, b = 0x6e;

  /* PNG signature */
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  /* IHDR chunk: 1x1, 8-bit RGB */
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0);   // width
  ihdrData.writeUInt32BE(1, 4);   // height
  ihdrData[8] = 8;                // bit depth
  ihdrData[9] = 2;                // color type (RGB)
  ihdrData[10] = 0;               // compression
  ihdrData[11] = 0;               // filter
  ihdrData[12] = 0;               // interlace
  const ihdr = createPngChunk('IHDR', ihdrData);

  /* IDAT chunk: zlib-compressed filter(0) + R + G + B */
  const zlib = require('zlib');
  const rawRow = Buffer.from([0, r, g, b]); // filter byte + pixel
  const compressed = zlib.deflateSync(rawRow);
  const idat = createPngChunk('IDAT', compressed);

  /* IEND chunk */
  const iend = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createPngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');

  /* CRC32 of type + data */
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Encode text for use in Cloudinary URL text overlays.
 * Cloudinary text overlay syntax uses specific escaping.
 */
function encodeCloudinaryText(text) {
  return encodeURIComponent(text)
    .replace(/%20/g, '%20')
    .replace(/%2C/g, ',')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

module.exports = { generateCover };
