/**
 * One-off test: enhance a single pastoral letter cover and save the
 * result locally as tests/enhanced-preview.png WITHOUT updating the DB.
 * Lets us preview the new prompt before batch-running.
 *
 * Usage: node scripts/enhance-one-test.js [index]
 *   index defaults to 0 (first pastoral letter with a cover)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Replicate = require('replicate');

const BASE = 'https://peachpuff-tiger-996145.hostingersite.com';
const ARG = process.argv[2] || '0';
const LOCAL_FILE = ARG && !/^\d+$/.test(ARG) ? ARG : null;
const INDEX = LOCAL_FILE ? 0 : parseInt(ARG, 10);

/* Inline copy of the enhancement prompt (kept in sync with services/coverEnhancer.js). */
const PROMPT = `Render this flat book cover artwork as a photorealistic 3D hardcover book mockup. The INPUT image is the exact artwork that must appear on the front of the book — reproduce it faithfully onto the front face.

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

═══ RULE 3 — FRONT-FACING HARDCOVER STYLING ═══
Present the cover as a premium hardcover book, but viewed STRAIGHT-ON from the front:
- Strict head-on / front-facing camera angle — show only the FRONT COVER
- ABSOLUTELY NO SPINE visible. NO side edge. NO three-quarter angle. NO perspective. NO book thickness shown on either side.
- Do not invent, render, or hallucinate any spine text — there must be no spine in frame at all
- Subtle premium hardcover feel: very slight rounded outer corners, faint inner edge highlight, soft realistic drop shadow beneath the book to add depth
- Clean pure white background (#ffffff), completely flat and even, no gradient, no patterns, no props, no text
- Centered composition with generous white margin around the book, portrait framing
- Sharp focus, high-resolution, publisher-grade product render

═══ CONTEXT ═══
This is a Catholic pastoral letter by Archbishop Valerian M. Okeke of the Archdiocese of Onitsha. Spelling accuracy of the title, Scripture references, and proper names is non-negotiable — a misspelled word makes the output unusable, regardless of how nice the 3D render looks. When in doubt, copy text exactly as shown in the input.`;

async function main() {
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('Missing REPLICATE_API_TOKEN in .env');
    process.exit(1);
  }

  let sourceInput;
  if (LOCAL_FILE) {
    if (!fs.existsSync(LOCAL_FILE)) { console.error('File not found:', LOCAL_FILE); process.exit(1); }
    const buf = fs.readFileSync(LOCAL_FILE);
    const ext = path.extname(LOCAL_FILE).toLowerCase().replace('.', '') || 'png';
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    sourceInput = `data:image/${mime};base64,${buf.toString('base64')}`;
    console.log(`Using local file: ${LOCAL_FILE} (${(buf.length / 1024).toFixed(1)} KB)\n`);
  } else {
    console.log(`Fetching pastoral letters from ${BASE}...`);
    const res = await fetch(`${BASE}/api/pastoral-letters`);
    const items = (await res.json()).data.filter(i => i.cover_photo_url);
    if (!items.length) { console.error('No pastoral letters with cover_photo_url found.'); process.exit(1); }
    const item = items[INDEX] || items[0];
    console.log(`Using [${INDEX}] "${item.title}"`);
    console.log(`Source: ${item.cover_photo_url}\n`);
    sourceInput = item.cover_photo_url;
  }

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  console.log('Calling google/nano-banana...');
  const output = await replicate.run('google/nano-banana', {
    input: {
      prompt: PROMPT,
      image_input: [sourceInput],
      output_format: 'png'
    }
  });

  /* Resolve output to a buffer (same extraction logic as coverEnhancer.js) */
  let imageBuffer;
  const fetchToBuf = async (u) => Buffer.from(await (await fetch(u)).arrayBuffer());

  if (typeof output === 'string') {
    imageBuffer = await fetchToBuf(output);
  } else if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === 'string') imageBuffer = await fetchToBuf(first);
    else if (first && typeof first.url === 'function') {
      const u = first.url();
      imageBuffer = await fetchToBuf(u.toString ? u.toString() : u);
    } else if (first && first.url) imageBuffer = await fetchToBuf(first.url);
  } else if (output && typeof output.url === 'function') {
    const u = output.url();
    imageBuffer = await fetchToBuf(u.toString ? u.toString() : u);
  } else if (output && output.url) {
    imageBuffer = await fetchToBuf(output.url);
  }

  if (!imageBuffer) {
    console.error('Could not extract image from Replicate output:', output);
    process.exit(1);
  }

  const outPath = path.join(__dirname, '..', 'tests', 'enhanced-preview.png');
  fs.writeFileSync(outPath, imageBuffer);
  console.log(`\n✓ Wrote ${outPath} (${(imageBuffer.length / 1024).toFixed(1)} KB)`);
  console.log('Open that file to preview before running the full batch.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
