/**
 * Clean scraper artifacts from homilies and writings full-body text.
 *
 * - Processes each record individually (one Claude call per record).
 * - Uses claude-haiku-4-5 with cached system prompt.
 * - Overwrites in place via PUT on the production API.
 *
 * Usage:
 *   node scripts/clean-scraped-content.js            # dry run (writes /tmp/cleanup-preview.json)
 *   node scripts/clean-scraped-content.js --apply    # PUTs cleaned text back to the API
 *   node scripts/clean-scraped-content.js --apply --only=homilies
 *   node scripts/clean-scraped-content.js --apply --id=12
 */

require('dotenv').config();
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const API_BASE = process.env.API_BASE || 'https://peachpuff-tiger-996145.hostingersite.com/api';
const ADMIN_USERNAME = process.env.PROD_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.PROD_ADMIN_PASSWORD || 'Kaycey.121225.';
const MODEL = 'claude-haiku-4-5';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ONLY = (args.find(a => a.startsWith('--only=')) || '').split('=')[1] || null;
const ONLY_ID = (args.find(a => a.startsWith('--id=')) || '').split('=')[1] || null;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in .env');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a precise text-cleanup tool for scraped homilies, reflections, addresses, and messages by Archbishop Valerian Okeke.

Your ONLY job is to remove scraping artifacts while preserving the Archbishop's words EXACTLY. You must not rewrite, paraphrase, summarize, translate, or add any content of your own.

REMOVE these artifacts:
- Leading archive-date links like "-   [August 31, 2021](https://archbishopvalokeke.org/2021/08/31/)" — delete the entire line.
- Any other bare WordPress archive URLs (archbishopvalokeke.org/YYYY/MM/DD/...).
- Backslash-escaped punctuation from WP markdownification: "1\\." → "1.", "**\\*" → "**\\*" becomes "*", "Lk 1:46 -55" keep as-is.
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
- Closing salutations like "Amen.", "Peace be with you!", and the signature block (date, place, "MOST REV. VALERIAN MADUKA OKEKE", "Archbishop of Onitsha").

OUTPUT RULES:
- Return ONLY the cleaned text. No preamble, no explanation, no markdown code fence, no "Here is the cleaned text:".
- If the input has no artifacts to remove, return it unchanged.
- Never shorten or expand the content. Length should be within a few characters of the input once artifacts are stripped.`;

async function login() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
  });
  const data = await res.json();
  if (!data.success) throw new Error('Login failed: ' + (data.message || res.status));
  return data.data.token;
}

async function fetchList(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json();
  if (!data.success) throw new Error(`GET ${path} failed`);
  return data.data;
}

async function cleanOne(text) {
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }
    ],
    messages: [
      { role: 'user', content: `Clean this text:\n\n${text}` }
    ]
  });
  const out = resp.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();
  return { cleaned: out, usage: resp.usage };
}

async function putUpdate(token, table, id, payload) {
  const path = table === 'homilies' ? `/homilies/${id}` : `/writings/${id}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(`PUT ${path} failed: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
}

async function processTable({ table, field, records, token }) {
  const report = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (ONLY_ID && String(r.id) !== String(ONLY_ID)) continue;
    const original = r[field] || '';
    if (!original.trim()) {
      console.log(`  [${i + 1}/${records.length}] SKIP empty  #${r.id} ${r.title.slice(0, 60)}`);
      continue;
    }
    try {
      const { cleaned, usage } = await cleanOne(original);
      const delta = cleaned.length - original.length;
      const pct = ((delta / Math.max(original.length, 1)) * 100).toFixed(1);
      console.log(
        `  [${i + 1}/${records.length}] OK   #${r.id} ${r.title.slice(0, 55)}  (${original.length}→${cleaned.length}, ${pct}%, in=${usage.input_tokens}, out=${usage.output_tokens})`
      );

      report.push({
        id: r.id,
        title: r.title,
        table,
        before_len: original.length,
        after_len: cleaned.length,
        before_head: original.slice(0, 200),
        after_head: cleaned.slice(0, 200),
        before_tail: original.slice(-200),
        after_tail: cleaned.slice(-200)
      });

      if (APPLY && cleaned && cleaned !== original) {
        const payload = field === 'description'
          ? { description: cleaned }
          : { body: cleaned };
        await putUpdate(token, table, r.id, payload);
      }
    } catch (err) {
      console.log(`  [${i + 1}/${records.length}] FAIL #${r.id} ${r.title.slice(0, 55)}: ${err.message}`);
      report.push({ id: r.id, title: r.title, table, error: err.message });
    }
  }
  return report;
}

(async () => {
  console.log(`\nCleanup mode: ${APPLY ? 'APPLY (will PUT updates)' : 'DRY RUN (preview only)'}`);
  console.log(`API:   ${API_BASE}`);
  console.log(`Model: ${MODEL}\n`);

  const token = APPLY ? await login() : null;
  if (APPLY) console.log('Logged in.\n');

  const reports = [];

  if (!ONLY || ONLY === 'homilies') {
    const homilies = await fetchList('/homilies');
    console.log(`--- homilies (${homilies.length}) ---`);
    reports.push(...await processTable({ table: 'homilies', field: 'description', records: homilies, token }));
  }

  if (!ONLY || ONLY === 'writings') {
    const writings = await fetchList('/writings');
    console.log(`\n--- writings (${writings.length}) ---`);
    reports.push(...await processTable({ table: 'writings', field: 'body', records: writings, token }));
  }

  const out = '/tmp/cleanup-preview.json';
  fs.writeFileSync(out, JSON.stringify(reports, null, 2));
  console.log(`\nReport written to ${out}`);
  console.log(APPLY ? 'Applied to production.' : 'Dry run only — rerun with --apply to write.');
})().catch(err => {
  console.error('\nFatal:', err);
  process.exit(1);
});
