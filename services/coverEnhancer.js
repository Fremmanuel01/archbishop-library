const Replicate = require('replicate');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Takes an uploaded book cover image URL and uses Nano Banana (via Replicate)
 * to produce a high-definition version of the SAME cover — no restyling,
 * no mockups, no background changes. Layout, colors, imagery and every
 * character of text must stay byte-identical to the original.
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

    const prompt = `Render this flat book cover artwork as a photorealistic 3D hardcover book mockup. The INPUT image is the exact artwork that must appear on the front of the book — reproduce it faithfully onto the front face.

═══ RULE 1 — TEXT MUST BE PIXEL-PERFECT (HIGHEST PRIORITY) ═══
Before anything else, your job is to reproduce every character of text from the original artwork without a single change. This overrides all visual goals.

- Every letter, word, digit, punctuation mark, accent, and symbol must match the original EXACTLY, character-for-character
- The pastoral letter title must be spelled identically to the original — no autocorrection, no rewording, no "smoothing", no synonym substitution, no added/removed letters, no capitalization changes
- The author line (e.g. "MOST REV VALERIAN M. OKEKE", "Archbishop of Onitsha") and any dates (e.g. "PASTORAL LETTER 2026") must remain letter-perfect including punctuation and spacing
- Preserve the exact original fonts, weights, letter spacing, line breaks, and text alignment shown on the input cover
- If any character is unclear in the source, copy it verbatim — NEVER guess, invent, or "correct" it
- Do NOT translate, paraphrase, or localize any text
- Do NOT add any text that is not already on the original artwork (no fake publisher marks, no barcodes, no extra subtitles)

═══ RULE 2 — PRESERVE THE ARTWORK ON THE FRONT FACE ═══
- Keep the exact same layout, color palette, background texture, crest/coat-of-arms, illustrations, borders and ornaments from the input
- Do not rearrange, recolor, resize, or replace any graphic element
- The front of the book must look like the input artwork

═══ RULE 3 — HARDCOVER MOCKUP STYLING ═══
Render the input as a premium hardcover book photographed in a clean studio. Match this exact composition:

CAMERA ANGLE:
- The book stands upright, photographed from the FRONT with a very slight tilt of the right edge toward the camera
- This slight tilt reveals only the RIGHT-side page edges (the cream/white striped paper block)
- The LEFT side of the book must be flat against the camera plane — NO spine visible on the left, NO left edge, NO left side wall
- Do NOT show a three-quarter angle that exposes the spine on either side
- The front cover artwork must be fully visible, dominant, and almost rectangular (only mild perspective from the slight right-edge tilt)

BOOK BODY:
- Subtle realistic hardcover thickness, only seen as the right-edge page block (cream paper edges with very faint horizontal striations)
- Faint top and bottom hardcover edge (the case stock wrapping over the page block)
- Slight rounded corners, premium hardcover feel

TEXT RULE FOR THE BOOK BODY:
- ABSOLUTELY NO TEXT anywhere except on the FRONT COVER artwork itself
- The right-side page edges are blank cream/white paper — never put letters, words, or marks on the page edges
- No spine text. No back cover text. No watermarks. No publisher logos. No barcodes.
- If you cannot render an area without inventing text, leave that area blank

BACKGROUND, SHADOW & FRAMING (premium product photography look):
- Pristine pure white background (#ffffff), completely flat, evenly lit, no gradient, no patterns, no props, no text
- The book sits on a subtle glossy white surface — extremely faint, soft mirror-like reflection of the bottom of the book directly beneath it (about 15% opacity, soft falloff, no distortion of cover text)
- Beautiful professional drop shadow: soft, diffuse, realistic, slightly elongated to one side, fading smoothly into the background — the kind of shadow used in high-end Apple / publisher product photography
- The shadow must be subtle and elegant, never harsh or solid black
- VERY GENEROUS white space around the book on all four sides — the book occupies roughly 55–60% of the frame height, with large airy white margins above, below, and to the sides
- Centered composition, portrait framing
- Bright, even, neutral studio lighting; clean highlights, no color cast
- Sharp focus, high-resolution, publisher-grade product render

═══ CONTEXT ═══
This is a Catholic pastoral letter by Archbishop Valerian M. Okeke of the Archdiocese of Onitsha. Spelling accuracy of the title, Scripture references, and proper names is non-negotiable — a misspelled word makes the output unusable, regardless of how nice the 3D render looks. When in doubt, copy text exactly as shown in the input.`;

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

    /* Upload enhanced cover to Cloudinary, normalized to a fixed canvas
       so every cover ends up at exactly the same dimensions for consistent
       display in grids and lists. */
    const TARGET_W = 1200;
    const TARGET_H = 1500;

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'archbishop-library/covers-enhanced',
          resource_type: 'image',
          transformation: [
            { width: TARGET_W, height: TARGET_H, crop: 'pad', background: 'white' }
          ]
        },
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
