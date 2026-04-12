/**
 * Batch enhance all cover photos using Nano Banana via Replicate.
 * Usage: node scripts/enhance-all-covers.js [API_BASE_URL]
 */
require('dotenv').config();
const { enhanceCover } = require('../services/coverEnhancer');

const BASE = process.argv[2] || 'https://peachpuff-tiger-996145.hostingersite.com';

async function run() {
  /* Login */
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Kaycey.121225.' })
  });
  const token = (await loginRes.json()).data.token;
  console.log('Logged in.\n');

  const sections = [
    { endpoint: '/api/pastoral-letters', label: 'Pastoral Letters' },
    { endpoint: '/api/homilies', label: 'Reflections' },
    { endpoint: '/api/writings', label: 'Other Teachings' }
  ];

  let totalSuccess = 0;
  let totalFail = 0;

  for (const sec of sections) {
    const res = await fetch(BASE + sec.endpoint);
    const items = (await res.json()).data;

    console.log(`\n--- ${sec.label}: ${items.length} items ---\n`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const prefix = `  [${i + 1}/${items.length}]`;

      if (!item.cover_photo_url) {
        console.log(`${prefix} SKIP ${item.title.substring(0, 50)} (no cover to enhance)`);
        continue;
      }

      try {
        console.log(`${prefix} ... ${item.title.substring(0, 50)}`);
        const enhancedUrl = await enhanceCover(item.cover_photo_url, item.title);

        if (enhancedUrl) {
          const updateRes = await fetch(BASE + sec.endpoint + '/' + item.id, {
            method: 'PUT',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cover_photo_url: enhancedUrl })
          });
          const updateData = await updateRes.json();
          if (updateData.success) {
            console.log(`${prefix} OK   ${item.title.substring(0, 50)}`);
            totalSuccess++;
          } else {
            console.log(`${prefix} FAIL ${item.title.substring(0, 50)}: update failed`);
            totalFail++;
          }
        } else {
          console.log(`${prefix} FAIL ${item.title.substring(0, 50)}: enhancement returned null`);
          totalFail++;
        }
      } catch (e) {
        console.log(`${prefix} FAIL ${item.title.substring(0, 50)}: ${e.message}`);
        totalFail++;
      }
    }
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`Done! ${totalSuccess} succeeded, ${totalFail} failed.`);
  console.log(`═══════════════════════════════════════\n`);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
