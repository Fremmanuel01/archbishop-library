require('dotenv').config();
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const API_BASE = 'https://peachpuff-tiger-996145.hostingersite.com/api';
const MODEL = 'claude-haiku-4-5';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BROWSER = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://peachpuff-tiger-996145.hostingersite.com',
  'Referer': 'https://peachpuff-tiger-996145.hostingersite.com/admin/'
};

const SYSTEM_PROMPT = `You are a precise text-cleanup tool for scraped homilies by Archbishop Valerian Okeke. Remove scraping artifacts: leading archive-date links (e.g. "-   [Month Day, Year](https://archbishopvalokeke.org/...)"), backslash-escaped punctuation like "1\\.", duplicated title lines at the top, stray 4+ space indentation, non-breaking spaces, triple blank lines, double spaces. Preserve every word, markdown headings/bold/italics, scripture citations, and signature blocks. Return ONLY the cleaned text.`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const h = JSON.parse(fs.readFileSync('/tmp/h.json', 'utf8')).data;
  const r = h.find(x => x.id === 6);
  console.log(`homily #6 original ${r.description.length} chars`);

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Clean this:\n\n${r.description}` }]
  });
  const cleaned = resp.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  console.log(`cleaned ${cleaned.length} chars\n`);

  // login
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...BROWSER },
    body: JSON.stringify({ username: 'admin', password: 'Kaycey.121225.' })
  });
  const token = (await loginRes.json()).data.token;
  console.log('logged in\n');

  // Attempt 1: multipart/form-data
  console.log('attempt 1: multipart/form-data');
  const form = new FormData();
  form.append('description', cleaned);
  let res = await fetch(`${API_BASE}/homilies/6`, {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + token, ...BROWSER },
    body: form
  });
  console.log('  →', res.status);
  if (res.ok) { console.log('  OK via multipart'); return; }

  // Attempt 2: url-encoded form
  await sleep(3000);
  console.log('\nattempt 2: x-www-form-urlencoded');
  res = await fetch(`${API_BASE}/homilies/6`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Bearer ' + token,
      ...BROWSER
    },
    body: new URLSearchParams({ description: cleaned }).toString()
  });
  console.log('  →', res.status);
  if (res.ok) { console.log('  OK via urlencoded'); return; }

  // Attempt 3: PATCH not PUT? route is PUT only. Try JSON with different spacing/newlines.
  // Save cleaned to file so user can inspect/manually paste into admin UI.
  fs.writeFileSync('/tmp/homily-6-cleaned.txt', cleaned);
  console.log('\nAll attempts failed. Cleaned text saved to /tmp/homily-6-cleaned.txt');
  console.log('First 500 chars:\n---');
  console.log(cleaned.slice(0, 500));
  console.log('---');
})().catch(e => { console.error(e); process.exit(1); });
