/**
 * Generate covers locally and push to remote API.
 * Usage: node scripts/generate-all-covers.js [API_BASE_URL]
 */
require('dotenv').config();
const { generateCover } = require('../services/coverGenerator');

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
    { endpoint: '/api/pastoral-letters', type: 'pastoral_letter', label: 'Pastoral Letters' },
    { endpoint: '/api/homilies', type: 'homily', label: 'Reflections' },
    { endpoint: '/api/writings', type: 'writing', label: 'Other Teachings' }
  ];

  for (const section of sections) {
    const res = await fetch(BASE + section.endpoint);
    const items = (await res.json()).data;
    const needsCover = items.filter(i => !i.cover_photo_url);
    console.log(`--- ${section.label}: ${needsCover.length}/${items.length} need covers ---`);

    for (let i = 0; i < needsCover.length; i++) {
      const item = needsCover[i];
      try {
        const coverUrl = await generateCover(item.title, item.date, section.type);
        if (coverUrl) {
          /* Update via API PUT */
          const updateRes = await fetch(BASE + section.endpoint + '/' + item.id, {
            method: 'PUT',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cover_photo_url: coverUrl })
          });
          const updateData = await updateRes.json();
          console.log(`  [${i+1}/${needsCover.length}] OK ${item.title.substring(0, 50)}`);
        } else {
          console.log(`  [${i+1}/${needsCover.length}] SKIP ${item.title.substring(0, 50)} (no URL generated)`);
        }
      } catch (e) {
        console.log(`  [${i+1}/${needsCover.length}] FAIL ${item.title.substring(0, 50)}: ${e.message}`);
      }
    }
  }

  console.log('\nDone!');
}

run().catch(e => { console.error(e); process.exit(1); });
