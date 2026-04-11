/**
 * Generate real PNG cover images using node-canvas and upload to Cloudinary.
 * Run locally only (canvas not available on Hostinger).
 * Usage: node scripts/upload-covers.js [API_BASE_URL]
 */
require('dotenv').config();
const { createCanvas, loadImage } = require('canvas');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const BASE = process.argv[2] || 'https://peachpuff-tiger-996145.hostingersite.com';
const W = 800, H = 1100;

async function generateAndUpload(title, date, contentType) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  /* Background gradient */
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a3c6e');
  grad.addColorStop(1, '#0f2547');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  /* Top gold line */
  ctx.strokeStyle = '#c9a84c';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(40, 60); ctx.lineTo(W - 40, 60); ctx.stroke();

  /* Crest */
  const crestPath = path.join(__dirname, '..', 'admin', 'assets', 'crest.png');
  try {
    if (fs.existsSync(crestPath)) {
      const img = await loadImage(crestPath);
      const r = Math.min(140 / img.width, 140 / img.height);
      ctx.drawImage(img, (W - img.width * r) / 2, 100, img.width * r, img.height * r);
    }
  } catch (e) { /* use fallback */ }

  /* Fallback emblem if no crest */
  if (!fs.existsSync(crestPath)) {
    ctx.strokeStyle = '#c9a84c'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(W/2, 170, 60, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W/2, 170, 48, 0, Math.PI*2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W/2, 142); ctx.lineTo(W/2, 198); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W/2-18, 164); ctx.lineTo(W/2+18, 164); ctx.stroke();
  }

  /* Label */
  const labels = { pastoral_letter: 'PASTORAL LETTER', homily: 'REFLECTION', writing: 'TEACHING' };
  const label = labels[contentType] || 'DOCUMENT';
  ctx.fillStyle = '#c9a84c';
  ctx.font = 'bold 18px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  /* Letter-spaced label */
  const chars = label.split('');
  let totalW = 0;
  chars.forEach(ch => totalW += ctx.measureText(ch).width + 6);
  let startX = W / 2 - totalW / 2;
  chars.forEach(ch => {
    const cw = ctx.measureText(ch).width;
    ctx.fillText(ch, startX + cw / 2, 290);
    startX += cw + 6;
  });

  /* Label underline */
  ctx.strokeStyle = '#c9a84c'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W/2-40, 308); ctx.lineTo(W/2+40, 308); ctx.stroke();

  /* Title */
  let fontSize = 36;
  const t = title || 'Untitled';
  if (t.length > 45) fontSize = 28;
  else if (t.length > 30) fontSize = 32;

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSize}px serif`;
  ctx.textBaseline = 'top';

  const lines = wrapText(ctx, t, 640, 3);
  const lh = fontSize + 14;
  lines.forEach((line, i) => ctx.fillText(line, W / 2, 358 + i * lh));

  /* Divider */
  const divY = 358 + lines.length * lh + 50;
  ctx.strokeStyle = '#c9a84c'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W/2-100, divY); ctx.lineTo(W/2-16, divY); ctx.stroke();
  ctx.fillStyle = '#c9a84c';
  ctx.beginPath();
  ctx.moveTo(W/2, divY-6); ctx.lineTo(W/2+6, divY); ctx.lineTo(W/2, divY+6); ctx.lineTo(W/2-6, divY);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W/2+16, divY); ctx.lineTo(W/2+100, divY); ctx.stroke();

  /* Archbishop name */
  ctx.fillStyle = '#f0e6d3'; ctx.font = 'italic 22px serif'; ctx.textBaseline = 'top';
  ctx.fillText('Archbishop Valerian Okeke', W/2, divY + 50);

  /* Year */
  let year = new Date().getFullYear().toString();
  if (date) { const m = date.match(/(\d{4})/); if (m) year = m[1]; }
  ctx.fillStyle = '#c9a84c'; ctx.font = '18px serif';
  ctx.fillText(year, W/2, divY + 90);

  /* Bottom line */
  ctx.strokeStyle = '#c9a84c'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(40, H-60); ctx.lineTo(W-40, H-60); ctx.stroke();
  ctx.fillStyle = '#f0e6d3'; ctx.font = '13px serif';
  ctx.fillText('Archdiocese of Onitsha', W/2, H - 36);

  /* Upload to Cloudinary */
  const buffer = canvas.toBuffer('image/png');
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'archbishop-library/covers', resource_type: 'image' },
      (err, res) => err ? reject(err) : resolve(res)
    );
    stream.end(buffer);
  });

  return result.secure_url;
}

function wrapText(ctx, text, maxW, maxLines) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) { lines[lines.length-1] += '...'; return lines; }
    } else { cur = test; }
  }
  if (cur) { if (lines.length >= maxLines) lines[lines.length-1] += '...'; else lines.push(cur); }
  return lines;
}

async function run() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Kaycey.121225.' })
  });
  const token = (await loginRes.json()).data.token;
  console.log('Logged in.\n');

  const sections = [
    { endpoint: '/api/pastoral-letters', type: 'pastoral_letter', label: 'Pastoral Letters' },
    { endpoint: '/api/homilies', type: 'homily', label: 'Reflections' },
    { endpoint: '/api/writings', type: 'writing', label: 'Other Teachings' }
  ];

  let total = 0;
  for (const sec of sections) {
    const res = await fetch(BASE + sec.endpoint);
    const items = (await res.json()).data;

    /* Regenerate ALL covers with real uploaded images */
    console.log(`--- ${sec.label}: ${items.length} items ---`);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const url = await generateAndUpload(item.title, item.date, sec.type);
        await fetch(BASE + sec.endpoint + '/' + item.id, {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ cover_photo_url: url })
        });
        console.log(`  [${i+1}/${items.length}] OK ${item.title.substring(0,50)}`);
        total++;
      } catch (e) {
        console.log(`  [${i+1}/${items.length}] FAIL ${item.title.substring(0,50)}: ${e.message}`);
      }
    }
  }

  console.log(`\nDone! ${total} covers uploaded to Cloudinary.`);
}

run().catch(e => { console.error(e); process.exit(1); });
