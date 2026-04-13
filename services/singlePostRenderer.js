const db = require('../database');
const { marked } = require('marked');

marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false });

/**
 * Renders a full standalone HTML page for a single content item.
 * Design system inspired by Elana Winterbrook (editorial) + ADW (institutional Catholic).
 */
function renderSinglePost(item, type) {
  const settings = db.prepare('SELECT * FROM settings WHERE section = ?').get(type) || {};

  let tags = [];
  let highlights = [];
  try { tags = JSON.parse(item.tags || '[]'); } catch (e) { tags = []; }
  try { highlights = JSON.parse(item.highlights || '[]'); } catch (e) { highlights = []; }

  const coverPhoto = item.cover_photo_url || item.thumbnail_url || '';
  const pdfUrl = item.pdf_url || '';
  const description = item.description || item.body || '';
  const descriptionHtml = description ? marked.parse(description) : '';
  const typeLabel = type === 'pastoral_letters' ? 'Pastoral Letter'
    : type === 'homilies' ? 'Reflection' : 'Teaching';
  const typePath = type === 'pastoral_letters' ? 'letter'
    : type === 'homilies' ? 'homily' : 'writing';

  /* Back button from settings */
  const btnLabel = settings.back_button_label || 'Visit Archbishop Website';
  const btnUrl = settings.back_button_url || 'https://archbishopokeke.com';
  const btnColor = settings.back_button_color || '#c9a84c';
  const btnPosition = settings.back_button_position || 'both';

  const backButtonHtml = `<a href="${esc(btnUrl)}" class="back-btn">${esc(btnLabel)}</a>`;
  const showTopBtn = btnPosition === 'top' || btnPosition === 'both';
  const showBottomBtn = btnPosition === 'bottom' || btnPosition === 'both';

  /* Tone badge color */
  const toneColors = {
    'Reflective': '#6c5ce7', 'Instructional': '#0984e3', 'Celebratory': '#00b894',
    'Pastoral': '#1a3c6e', 'Urgent': '#d63031'
  };
  const toneColor = toneColors[item.tone] || '#1a3c6e';

  /* Download URL */
  let downloadUrl = pdfUrl;
  if (pdfUrl && (pdfUrl.includes('cloudinary.com') || pdfUrl.includes('res.cloudinary'))) {
    downloadUrl = pdfUrl.replace('/upload/', '/upload/fl_attachment/');
  }

  /* Related content */
  let relatedHtml = '';
  if (tags.length > 0) {
    const allItems = db.prepare(`SELECT * FROM ${type} WHERE id != ? ORDER BY date DESC LIMIT 50`).all(item.id);
    const related = allItems.filter(other => {
      let otherTags = [];
      try { otherTags = JSON.parse(other.tags || '[]'); } catch (e) { return false; }
      return otherTags.some(t => tags.includes(t));
    }).slice(0, 3);

    if (related.length > 0) {
      relatedHtml = `
        <section class="related-section">
          <div class="section-divider">
            <span class="star-icon">✦</span>
            <span class="divider-label">Related ${esc(typeLabel)}s</span>
            <span class="star-icon">✦</span>
          </div>
          <div class="related-grid">
            ${related.map(r => {
              const rCover = r.cover_photo_url || r.thumbnail_url || '';
              return `<a href="/${typePath}/${r.id}" class="related-card">
                <div class="related-cover" style="background-image:url('${esc(rCover)}');">
                  ${!rCover ? '<span class="cover-cross">✝</span>' : ''}
                </div>
                <div class="related-body">
                  <h3>${esc(r.title)}</h3>
                  <span class="related-date">${esc(r.date || '')}</span>
                </div>
              </a>`;
            }).join('')}
          </div>
        </section>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(item.title)} — Archbishop Valerian Okeke</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

    :root {
      --gold: #c9a84c;
      --gold-bright: #FFD700;
      --gold-pale: #f5ecd7;
      --navy: #1a3c6e;
      --navy-dark: #0f2847;
      --navy-deep: #0a1c33;
      --cream: #f9f5ef;
      --cream-dark: #f0e8da;
      --text: #2d2d2d;
      --text-muted: #6b6b6b;
      --white: #ffffff;
      --shadow-natural: 0 6px 30px rgba(0,0,0,0.08);
      --shadow-deep: 0 12px 40px rgba(0,0,0,0.12);
      --shadow-crisp: 0 2px 8px rgba(0,0,0,0.06);
      --radius-sm: 6px;
      --radius-md: 12px;
      --radius-lg: 16px;
      --radius-pill: 9999px;
      --space-20: 0.44rem;
      --space-30: 0.67rem;
      --space-40: 1rem;
      --space-50: 1.5rem;
      --space-60: 2.25rem;
      --space-70: 3.38rem;
      --space-80: 5.06rem;
    }

    body {
      font-family: 'Lora', Georgia, serif;
      color: var(--text);
      background: var(--cream);
      line-height: 1.75;
      font-size: 16px;
    }

    /* ── Back Button ─────────────────── */
    .back-btn {
      display: inline-block;
      padding: calc(.667em + 2px) calc(1.333em + 2px);
      background: ${esc(btnColor)};
      color: var(--white);
      text-decoration: none;
      border-radius: var(--radius-pill);
      font-family: 'Cinzel', serif;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      transition: all 0.3s ease;
    }
    .back-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(201,168,76,0.4);
    }

    .back-row {
      max-width: 900px;
      margin: 0 auto;
      padding: var(--space-50) var(--space-50) 0;
    }

    /* ── Hero ────────────────────────── */
    .hero {
      position: relative;
      min-height: 480px;
      display: flex;
      align-items: flex-end;
      padding: var(--space-80) var(--space-60) var(--space-70);
      background: ${coverPhoto ? `url('${esc(coverPhoto)}') center/cover no-repeat` : 'linear-gradient(135deg, var(--navy-deep), var(--navy), #2a5298)'};
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        rgba(10,28,51,0.95) 0%,
        rgba(10,28,51,0.6) 40%,
        rgba(10,28,51,0.25) 70%,
        rgba(10,28,51,0.1) 100%
      );
    }
    .hero-content {
      position: relative;
      z-index: 2;
      max-width: 800px;
      margin: 0 auto;
      width: 100%;
    }
    .hero-type {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 18px;
      background: var(--gold);
      color: var(--navy-deep);
      font-family: 'Cinzel', serif;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      border-radius: var(--radius-pill);
      margin-bottom: var(--space-50);
    }
    .hero-type .star { color: var(--navy-deep); }
    .hero h1 {
      font-family: 'Cinzel Decorative', 'Cinzel', serif;
      font-size: clamp(28px, 5vw, 48px);
      color: var(--white);
      font-weight: 400;
      line-height: 1.25;
      margin-bottom: var(--space-50);
      letter-spacing: 0.5px;
    }
    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-30);
      align-items: center;
    }
    .meta-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 16px;
      border-radius: var(--radius-pill);
      font-family: 'Cinzel', serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .meta-badge-date {
      background: rgba(255,255,255,0.12);
      color: var(--white);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.15);
    }
    .meta-badge-time {
      background: rgba(255,255,255,0.12);
      color: var(--gold-bright);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .meta-badge-tone {
      background: ${toneColor};
      color: var(--white);
    }
    .meta-badge-occasion {
      background: rgba(201,168,76,0.2);
      color: var(--gold-bright);
      border: 1px solid rgba(201,168,76,0.3);
    }

    /* ── Container ───────────────────── */
    .container { max-width: 900px; margin: 0 auto; padding: 0 var(--space-50); }

    /* ── Decorative Divider ──────────── */
    .section-divider {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-40);
      margin: var(--space-70) 0 var(--space-60);
    }
    .star-icon {
      color: var(--gold);
      font-size: 14px;
    }
    .divider-label {
      font-family: 'Cinzel', serif;
      font-size: 13px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 3px;
      font-weight: 600;
    }
    .dot-divider {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin: var(--space-60) 0;
    }
    .dot-divider span {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--gold);
    }

    /* ── Full Content (rendered markdown) ── */
    .content-body {
      background: var(--white);
      border-radius: var(--radius-lg);
      padding: var(--space-70) var(--space-60);
      margin: -50px auto var(--space-60);
      position: relative;
      z-index: 3;
      box-shadow: var(--shadow-deep);
      border-top: 4px solid var(--gold);
      font-family: 'Lora', Georgia, serif;
      font-size: 17px;
      line-height: 1.85;
      color: var(--text);
    }
    .content-body > *:first-child { margin-top: 0; }
    .content-body > *:last-child { margin-bottom: 0; }
    .content-body h1,
    .content-body h2,
    .content-body h3,
    .content-body h4 {
      font-family: 'Cinzel', serif;
      color: var(--navy);
      line-height: 1.3;
      margin: var(--space-60) 0 var(--space-40);
      font-weight: 600;
    }
    .content-body h1 { font-size: 28px; }
    .content-body h2 { font-size: 23px; }
    .content-body h3 { font-size: 19px; color: var(--navy-dark); }
    .content-body h4 { font-size: 16px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--gold); }
    .content-body p { margin: 0 0 var(--space-40); }
    .content-body strong { color: var(--navy-dark); font-weight: 600; }
    .content-body em { font-style: italic; color: var(--text); }
    .content-body ul,
    .content-body ol { margin: 0 0 var(--space-40) var(--space-50); }
    .content-body li { margin-bottom: var(--space-30); }
    .content-body blockquote {
      border-left: 3px solid var(--gold);
      padding: var(--space-30) var(--space-50);
      margin: var(--space-50) 0;
      font-style: italic;
      color: var(--navy);
      background: var(--cream);
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    }
    .content-body a { color: var(--gold); text-decoration: underline; text-underline-offset: 3px; }
    .content-body hr { border: none; border-top: 1px solid var(--cream-dark); margin: var(--space-60) 0; }
    @media (max-width: 640px) {
      .content-body { padding: var(--space-50) var(--space-40); font-size: 16px; }
      .content-body h1 { font-size: 23px; }
      .content-body h2 { font-size: 20px; }
      .content-body h3 { font-size: 17px; }
    }

    /* ── Key Quote ────────────────────── */
    .quote-section {
      text-align: center;
      padding: var(--space-70) var(--space-50);
      max-width: 720px;
      margin: 0 auto;
      position: relative;
    }
    .quote-mark {
      font-family: 'Cinzel Decorative', serif;
      font-size: 100px;
      color: var(--gold);
      line-height: 0.4;
      display: block;
      margin-bottom: var(--space-40);
      opacity: 0.6;
    }
    .quote-text {
      font-family: 'Lora', serif;
      font-size: 22px;
      font-style: italic;
      color: var(--navy);
      line-height: 1.6;
      font-weight: 400;
    }
    .quote-attribution {
      margin-top: var(--space-40);
      font-family: 'Cinzel', serif;
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    /* ── PDF Viewer ──────────────────── */
    .pdf-section {
      background: var(--white);
      border-radius: var(--radius-lg);
      padding: var(--space-60);
      margin: var(--space-60) auto;
      box-shadow: var(--shadow-natural);
    }
    .pdf-section h2 {
      font-family: 'Cinzel', serif;
      font-size: 14px;
      color: var(--gold);
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: var(--space-50);
      text-align: center;
    }
    .pdf-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-30);
      margin-bottom: var(--space-50);
      flex-wrap: wrap;
    }
    .pdf-controls button {
      padding: 8px 20px;
      background: var(--navy);
      color: var(--white);
      border: none;
      border-radius: var(--radius-pill);
      font-family: 'Cinzel', serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .pdf-controls button:hover { background: var(--navy-dark); transform: translateY(-1px); }
    .pdf-controls button:disabled { opacity: 0.35; cursor: default; transform: none; }
    .pdf-controls span {
      font-family: 'Cinzel', serif;
      font-size: 12px;
      color: var(--text-muted);
      letter-spacing: 1px;
    }
    #pdfCanvas {
      width: 100%;
      border: 1px solid #e8e2d8;
      border-radius: var(--radius-md);
    }

    /* ── Highlights ──────────────────── */
    .highlights-section { padding: var(--space-60) 0; }
    .highlight-item {
      display: flex;
      gap: var(--space-50);
      align-items: flex-start;
      margin-bottom: var(--space-50);
      padding: var(--space-50);
      background: var(--white);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-crisp);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .highlight-item:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-natural);
    }
    .highlight-num {
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, var(--navy), var(--navy-dark));
      color: var(--gold);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Cinzel Decorative', serif;
      font-size: 18px;
      font-weight: 700;
    }
    .highlight-text {
      font-size: 16px;
      color: var(--text);
      padding-top: 10px;
      line-height: 1.7;
    }

    /* ── Tags ─────────────────────────── */
    .tags-section {
      padding: var(--space-40) 0 var(--space-60);
      text-align: center;
    }
    .tag-pill {
      display: inline-block;
      padding: 6px 20px;
      margin: 4px;
      background: var(--navy);
      color: var(--white);
      border-radius: var(--radius-pill);
      font-family: 'Cinzel', serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      transition: all 0.2s;
    }
    .tag-pill:hover {
      background: var(--gold);
      color: var(--navy-deep);
      transform: translateY(-1px);
    }

    /* ── Download ─────────────────────── */
    .download-section {
      text-align: center;
      padding: var(--space-50) 0 var(--space-70);
    }
    .download-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 18px 48px;
      background: var(--gold);
      color: var(--navy-deep);
      text-decoration: none;
      border-radius: var(--radius-pill);
      font-family: 'Cinzel', serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      transition: all 0.3s ease;
      box-shadow: 0 4px 16px rgba(201,168,76,0.3);
    }
    .download-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 30px rgba(201,168,76,0.45);
      background: var(--gold-bright);
    }
    .download-btn .arrow { font-size: 16px; }

    /* ── Related Content ──────────────── */
    .related-section { padding-bottom: var(--space-60); }
    .related-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: var(--space-50);
    }
    .related-card {
      text-decoration: none;
      color: inherit;
      background: var(--white);
      border-radius: var(--radius-md);
      overflow: hidden;
      box-shadow: var(--shadow-crisp);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .related-card:hover {
      transform: translateY(-6px);
      box-shadow: var(--shadow-deep);
    }
    .related-cover {
      height: 180px;
      background: linear-gradient(135deg, var(--navy-deep), var(--navy)) center/cover no-repeat;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cover-cross {
      font-size: 36px;
      color: rgba(255,255,255,0.15);
    }
    .related-body {
      padding: var(--space-50);
    }
    .related-body h3 {
      font-family: 'Cinzel', serif;
      font-size: 15px;
      color: var(--navy);
      margin-bottom: 6px;
      line-height: 1.4;
    }
    .related-date {
      font-size: 13px;
      color: var(--text-muted);
    }

    /* ── Footer ──────────────────────── */
    .page-footer {
      text-align: center;
      padding: var(--space-60) var(--space-50);
      border-top: 1px solid var(--cream-dark);
    }
    .footer-crest { width: 60px; height: auto; margin-bottom: var(--space-30); display: block; margin-left: auto; margin-right: auto; }
    .footer-text {
      font-family: 'Cinzel', serif;
      font-size: 11px;
      color: var(--text-muted);
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    /* ── Responsive ──────────────────── */
    @media (max-width: 640px) {
      .hero { min-height: 360px; padding: var(--space-70) var(--space-40) var(--space-60); }
      .hero h1 { font-size: 26px; }
      .summary-card { padding: var(--space-50) var(--space-40); margin-top: -30px; }
      .quote-text { font-size: 18px; }
      .quote-mark { font-size: 70px; }
      .pdf-section { padding: var(--space-40); }
      .related-grid { grid-template-columns: 1fr; }
      .highlight-item { flex-direction: column; gap: var(--space-30); }
    }
  </style>
</head>
<body>

${showTopBtn ? `<div class="back-row">${backButtonHtml}</div>` : ''}

<!-- Hero -->
<header class="hero">
  <div class="hero-content">
    <img src="/admin/assets/crest.png" alt="" style="width:50px;height:auto;margin-bottom:16px;display:block;filter:brightness(0) invert(1);opacity:0.85;">
    <span class="hero-type"><span class="star">✦</span> ${esc(typeLabel)} <span class="star">✦</span></span>
    <h1>${esc(item.title)}</h1>
    <div class="hero-meta">
      ${item.date ? `<span class="meta-badge meta-badge-date">${esc(item.date)}</span>` : ''}
      ${item.reading_time ? `<span class="meta-badge meta-badge-time">${esc(item.reading_time)} read</span>` : ''}
      ${item.tone ? `<span class="meta-badge meta-badge-tone">${esc(item.tone)}</span>` : ''}
      ${item.occasion ? `<span class="meta-badge meta-badge-occasion">${esc(item.occasion)}</span>` : ''}
    </div>
  </div>
</header>

<div class="container">

  <!-- Full Content -->
  ${descriptionHtml ? `
  <article class="content-body">
    ${descriptionHtml}
  </article>` : ''}

  <!-- Key Quote -->
  ${item.key_quote ? `
  <div class="dot-divider"><span></span><span></span><span></span></div>
  <div class="quote-section">
    <span class="quote-mark">&ldquo;</span>
    <p class="quote-text">${esc(item.key_quote)}</p>
    <p class="quote-attribution">— Archbishop Valerian Okeke</p>
  </div>
  <div class="dot-divider"><span></span><span></span><span></span></div>` : ''}

  <!-- PDF Viewer -->
  ${pdfUrl ? `
  <div class="pdf-section">
    <h2>✦ Read Document ✦</h2>
    <div class="pdf-controls">
      <button onclick="prevPage()" id="prevBtn" disabled>← Previous</button>
      <span>Page <span id="pageNum">1</span> of <span id="pageCount">–</span></span>
      <button onclick="nextPage()" id="nextBtn">Next →</button>
      <button onclick="zoomOut()">− Zoom</button>
      <button onclick="zoomIn()">+ Zoom</button>
    </div>
    <canvas id="pdfCanvas"></canvas>
  </div>` : ''}

  <!-- Highlights -->
  ${highlights.length > 0 ? `
  <div class="section-divider">
    <span class="star-icon">✦</span>
    <span class="divider-label">Key Highlights</span>
    <span class="star-icon">✦</span>
  </div>
  <div class="highlights-section">
    ${highlights.map((h, i) => `
    <div class="highlight-item">
      <div class="highlight-num">${i + 1}</div>
      <p class="highlight-text">${esc(h)}</p>
    </div>`).join('')}
  </div>` : ''}

  <!-- Tags -->
  ${tags.length > 0 ? `
  <div class="tags-section">
    ${tags.map(t => `<span class="tag-pill">${esc(t)}</span>`).join('')}
  </div>` : ''}

  <!-- Download -->
  ${pdfUrl ? `
  <div class="download-section">
    <a href="${esc(downloadUrl)}" class="download-btn" download target="_blank">
      <span class="arrow">↓</span> Download PDF
    </a>
  </div>` : ''}

  <!-- Related -->
  ${relatedHtml}

  ${showBottomBtn ? `<div style="padding:var(--space-50) 0 var(--space-60);">${backButtonHtml}</div>` : ''}
</div>

<!-- Footer -->
<footer class="page-footer">
  <img class="footer-crest" src="/admin/assets/crest.png" alt="Archbishop Coat of Arms">
  <p class="footer-text">Archbishop Valerian Okeke &middot; Archdiocese of Onitsha</p>
</footer>

${pdfUrl ? `
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  let pdfDoc = null, pageNumVal = 1, scale = 1.5;
  const canvas = document.getElementById('pdfCanvas');
  const ctx = canvas.getContext('2d');

  var pdfSrc = '${esc(pdfUrl)}';
  /* Use proxy for external PDFs to avoid CORS issues */
  if (pdfSrc.indexOf(window.location.hostname) === -1) {
    pdfSrc = '/api/pdf-proxy?url=' + encodeURIComponent(pdfSrc);
  }
  pdfjsLib.getDocument(pdfSrc).promise.then(function(pdf) {
    pdfDoc = pdf;
    document.getElementById('pageCount').textContent = pdf.numPages;
    renderPage(1);
  }).catch(function() {
    document.querySelector('.pdf-section').innerHTML +=
      '<p style="color:#c0392b;text-align:center;margin-top:16px;">Unable to load PDF viewer. Please use the download button.</p>';
  });

  function renderPage(num) {
    pdfDoc.getPage(num).then(function(page) {
      const vp = page.getViewport({ scale: scale });
      canvas.height = vp.height;
      canvas.width = vp.width;
      page.render({ canvasContext: ctx, viewport: vp });
      document.getElementById('pageNum').textContent = num;
      document.getElementById('prevBtn').disabled = num <= 1;
      document.getElementById('nextBtn').disabled = num >= pdfDoc.numPages;
    });
  }
  function prevPage() { if (pageNumVal > 1) renderPage(--pageNumVal); }
  function nextPage() { if (pageNumVal < pdfDoc.numPages) renderPage(++pageNumVal); }
  function zoomIn() { scale = Math.min(scale + 0.25, 3); renderPage(pageNumVal); }
  function zoomOut() { scale = Math.max(scale - 0.25, 0.5); renderPage(pageNumVal); }
</script>` : ''}

</body>
</html>`;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

module.exports = { renderSinglePost };
