/**
 * Re-fetches original pastoral letter cover scans from the legacy
 * Elementor site (archbishopvalokeke.org), runs them through the
 * Nano Banana enhancer (3D mockup, white bg), uploads to Cloudinary,
 * and updates each matching record in the live DB.
 *
 * Usage:
 *   node scripts/restore-original-covers.js                # all mapped IDs
 *   node scripts/restore-original-covers.js 1 9            # only IDs 1 and 9
 *   node scripts/restore-original-covers.js --dry-run 1    # don't update DB
 */
require('dotenv').config();
const { enhanceCover } = require('../services/coverEnhancer');

const BASE = 'https://peachpuff-tiger-996145.hostingersite.com';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'Kaycey.121225.';

/* DB id → original cover URL on the legacy site */
const MAPPING = {
  1:  'https://archbishopvalokeke.org/wp-content/uploads/2026/04/Pastoral-Letter_2026.jpeg',
  3:  'https://archbishopvalokeke.org/wp-content/uploads/2025/05/2025-Pastoral-Letter-Cover.jpg',
  7:  'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0017.jpg',
  8:  'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0016.jpg',
  9:  'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0015.jpg',
  10: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0014.jpg',
  11: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0013.jpg',
  12: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0012.jpg',
  13: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0011.jpg',
  14: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0010.jpg',
  15: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0009.jpg',
  16: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0008.jpg',
  17: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0007.jpg',
  18: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0006.jpg',
  19: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0005.jpg',
  20: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0004.jpg',
  21: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0002.jpg',
  23: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0003.jpg',
  24: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/PASTORAL_LETTERS0001.jpg'
};

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const requestedIds = args.filter(a => /^\d+$/.test(a)).map(Number);
  const idsToRun = requestedIds.length ? requestedIds : Object.keys(MAPPING).map(Number);

  /* Login */
  console.log('Logging in...');
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
  });
  const token = (await loginRes.json()).data.token;
  if (!token) { console.error('Login failed'); process.exit(1); }
  console.log('OK\n');

  /* Fetch current letters for title display */
  const itemsRes = await fetch(`${BASE}/api/pastoral-letters`);
  const items = (await itemsRes.json()).data;
  const byId = Object.fromEntries(items.map(i => [i.id, i]));

  let success = 0, fail = 0, skipped = 0;

  for (const id of idsToRun) {
    const sourceUrl = MAPPING[id];
    const item = byId[id];
    if (!sourceUrl || !item) {
      console.log(`[${id}] SKIP — no mapping or item not in DB`);
      skipped++;
      continue;
    }

    console.log(`[${id}] "${item.title}"`);
    console.log(`     source: ${sourceUrl}`);

    try {
      const enhancedUrl = await enhanceCover(sourceUrl, item.title);
      if (!enhancedUrl) {
        console.log(`[${id}] FAIL — enhancer returned null\n`);
        fail++;
        continue;
      }
      console.log(`     enhanced: ${enhancedUrl}`);

      if (dryRun) {
        console.log(`[${id}] DRY RUN — not updating DB\n`);
        success++;
        continue;
      }

      const updateRes = await fetch(`${BASE}/api/pastoral-letters/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_photo_url: enhancedUrl })
      });
      const updateData = await updateRes.json();
      if (updateData.success) {
        console.log(`[${id}] OK\n`);
        success++;
      } else {
        console.log(`[${id}] FAIL — update: ${updateData.message || JSON.stringify(updateData)}\n`);
        fail++;
      }
    } catch (e) {
      console.log(`[${id}] FAIL — ${e.message}\n`);
      fail++;
    }
  }

  console.log('═══════════════════════════════════════');
  console.log(`Done. ${success} succeeded, ${fail} failed, ${skipped} skipped.`);
  console.log('═══════════════════════════════════════');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
