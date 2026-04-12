const Replicate = require('replicate');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Takes an uploaded book cover image URL and uses Nano Banana (via Replicate)
 * to generate a professional studio-quality product photograph version.
 * Preserves the original design faithfully.
 *
 * @param {string} imageUrl — URL of the original uploaded cover image
 * @param {string} title — Book/document title (for context)
 * @returns {string|null} Cloudinary URL of the enhanced cover, or null on failure
 */
async function enhanceCover(imageUrl, title) {
  if (!process.env.REPLICATE_API_TOKEN || !imageUrl) {
    console.warn('Cover enhancer: Missing Replicate token or image URL.');
    return null;
  }

  try {
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

    const prompt = `Transform this book cover into a premium studio-quality product photograph. Preserve the EXACT same design, colors, text, imagery, and layout from the original — do not change any text, titles, or design elements. Render it as a premium hardcover book with a subtle 3D perspective showing the front cover and a thin spine edge on the side. Add professional studio lighting with soft shadows underneath. Use crisp sharp edges and enhanced vibrant colors. Place it on a clean dark navy gradient background. The book should appear to sit on a subtle reflective surface. High-end publisher product listing quality, photorealistic, like an Amazon book listing photograph. Maintain original aspect ratio with all content visible. Catholic pastoral letter book by Archbishop Valerian Okeke.`;

    /* Use Google Nano Banana model on Replicate */
    const output = await replicate.run(
      'google/nano-banana',
      {
        input: {
          prompt: prompt,
          image_input: [imageUrl],
          output_format: 'png'
        }
      }
    );

    /* Replicate returns either a URL string or a ReadableStream/File object */
    let imageBuffer;

    if (typeof output === 'string') {
      /* Output is a URL */
      const res = await fetch(output);
      imageBuffer = Buffer.from(await res.arrayBuffer());
    } else if (Array.isArray(output) && output.length > 0) {
      const first = output[0];
      if (typeof first === 'string') {
        const res = await fetch(first);
        imageBuffer = Buffer.from(await res.arrayBuffer());
      } else if (first && typeof first.url === 'function') {
        const url = first.url();
        const res = await fetch(url.toString ? url.toString() : url);
        imageBuffer = Buffer.from(await res.arrayBuffer());
      } else if (first && first.url) {
        const res = await fetch(first.url);
        imageBuffer = Buffer.from(await res.arrayBuffer());
      }
    } else if (output && typeof output.url === 'function') {
      const url = output.url();
      const res = await fetch(url.toString ? url.toString() : url);
      imageBuffer = Buffer.from(await res.arrayBuffer());
    } else if (output && output.url) {
      const res = await fetch(output.url);
      imageBuffer = Buffer.from(await res.arrayBuffer());
    }

    if (!imageBuffer) {
      console.error('Cover enhancer: Could not extract image from Replicate output:', output);
      return null;
    }

    /* Upload enhanced cover to Cloudinary */
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'archbishop-library/covers-enhanced', resource_type: 'image' },
        (err, res) => err ? reject(err) : resolve(res)
      );
      stream.end(imageBuffer);
    });

    return result.secure_url;
  } catch (err) {
    console.error('Cover enhancer error:', err.message);
    return null;
  }
}

module.exports = { enhanceCover };
