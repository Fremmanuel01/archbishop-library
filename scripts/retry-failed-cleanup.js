/**
 * Retry the PUT failures from the initial cleanup run.
 * Uses cached originals in /tmp/h.json and /tmp/w.json, re-cleans through Claude,
 * and PUTs with retry + backoff against Hostinger's 403 WAF.
 *
 *   node scripts/retry-failed-cleanup.js
 */

require('dotenv').config();
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const API_BASE = 'https://peachpuff-tiger-996145.hostingersite.com/api';
const MODEL = 'claude-haiku-4-5';

const FAILED = {
  homilies: [6],
  writings: [2, 3, 9, 10, 11, 12, 13, 14, 15, 19, 23]
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a precise text-cleanup tool for scraped homilies, reflections, addresses, and messages by Archbishop Valerian Okeke.

Your ONLY job is to remove scraping artifacts while preserving the Archbishop's words EXACTLY. You must not rewrite, paraphrase, summarize, translate, or add any content of your own.

REMOVE these artifacts:
- Leading archive-date links like "-   [August 31, 2021](https://archbishopvalokeke.org/2021/08/31/)" — delete the entire line.
- Any other bare WordPress archive URLs (archbishopvalokeke.org/YYYY/MM/DD/...).
- Backslash-escaped punctuation from WP markdownification: "1\\." → "1.".
- Duplicated title lines that appear twice at the very top of the text (keep one).
- Stray leading indentation on paragraphs (4+ spaces at the start of a line that is not a code block or list).
- Non-breaking spaces (U+00A0) → normal space.
- Runs of 3+ blank lines → collapse to a single blank line.
- Double spaces inside sentences → single space.
- Trailing "Read more", share-button text, "Posted in", "Tags:", category footer junk, or WordPress author bylines if present.

PRESERVE exactly:
- Every word, sentence, quotation, and scripture citation written by the Archbishop.
- Markdown headings (##, ###), bold (**...**), italics (*...* or _..._), and lists.
- Line breaks that separate paragraphs (one blank line between paragraphs).
- Smart quotes, em-dashes, and ellipses as the Archbishop wrote them.
- Latin phrases, Igbo phrases, and proper names.
- Closing salutations like "Amen.", "Peace be with you!", and the signature block.

OUTPUT RULES:
- Return ONLY the cleaned text. No preamble, no explanation, no markdown code fence.
- If the input has no artifacts to remove, return it unchanged.
- Never shorten or expand the content.`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://peachpuff-tiger-996145.hostingersite.com',
  'Referer': 'https://peachpuff-tiger-996145.hostingersite.com/admin/'
};

async function login() {
  for (let i = 1; i <= 5; i++) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...BROWSER_HEADERS },
      body: JSON.stringify({ username: 'admin', password: 'Kaycey.121225.' })
    });
    const text = await res.text();
    if (text.startsWith('{')) {
      const data = JSON.parse(text);
      if (data.success) return data.data.token;
    }
    console.log(`  login attempt ${i} blocked (${res.status}), retrying in ${3000 * i}ms`);
    await sleep(3000 * i);
  }
  throw new Error('Login blocked by WAF after retries');
}

async function cleanOne(text) {
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Clean this text:\n\n${text}` }]
  });
  return resp.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
}

async function putWithRetry(token, table, id, payload) {
  const path = table === 'homilies' ? `/homilies/${id}` : `/writings/${id}`;
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        ...BROWSER_HEADERS
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data;
    }
    const delay = 2000 * attempt;
    console.log(`    attempt ${attempt} → ${res.status}, retrying in ${delay}ms`);
    await sleep(delay);
  }
  throw new Error(`PUT ${path} failed after ${maxAttempts} attempts`);
}

(async () => {
  const homilies = JSON.parse(fs.readFileSync('/tmp/h.json', 'utf8')).data;
  const writings = JSON.parse(fs.readFileSync('/tmp/w.json', 'utf8')).data;

  const token = await login();
  console.log('Logged in.\n');

  const results = { ok: [], fail: [] };

  for (const id of FAILED.homilies) {
    const r = homilies.find(x => x.id === id);
    if (!r || !r.description) continue;
    console.log(`homilies #${id} ${r.title.slice(0, 60)}`);
    try {
      const cleaned = await cleanOne(r.description);
      console.log(`  cleaned ${r.description.length}→${cleaned.length}`);
      await putWithRetry(token, 'homilies', id, { description: cleaned });
      console.log(`  OK\n`);
      results.ok.push({ table: 'homilies', id });
      await sleep(1500);
    } catch (e) {
      console.log(`  FAIL: ${e.message}\n`);
      results.fail.push({ table: 'homilies', id, error: e.message });
    }
  }

  for (const id of FAILED.writings) {
    const r = writings.find(x => x.id === id);
    if (!r || !r.body) continue;
    console.log(`writings #${id} ${r.title.slice(0, 60)}`);
    try {
      const cleaned = await cleanOne(r.body);
      console.log(`  cleaned ${r.body.length}→${cleaned.length}`);
      await putWithRetry(token, 'writings', id, { body: cleaned });
      console.log(`  OK\n`);
      results.ok.push({ table: 'writings', id });
      await sleep(1500);
    } catch (e) {
      console.log(`  FAIL: ${e.message}\n`);
      results.fail.push({ table: 'writings', id, error: e.message });
    }
  }

  console.log(`\nDone. OK=${results.ok.length} FAIL=${results.fail.length}`);
  if (results.fail.length) console.log('Still failed:', results.fail);
})().catch(e => { console.error(e); process.exit(1); });
