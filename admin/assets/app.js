/* ══════════════════════════════════════════════
   Archbishop Library — Dashboard Logic (v2)
   ══════════════════════════════════════════════ */

const API = window.location.origin + '/api';
const TOKEN = localStorage.getItem('ab_token');

if (!TOKEN) window.location.href = 'index.html';

/* ── State ────────────────────────────────── */

let currentPage = 'pastoral_letters';
let contentCache = { pastoral_letters: [], homilies: [], writings: [] };
let pendingDeleteType = null;
let pendingDeleteId = null;

/* ── Init ─────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  setupUsername();
  setupNavigation();
  setupMobileToggle();
  setupLogout();
  setupPasswordForm();
  setupDropZones();
  displayApiUrl();
  loadAllData();
});

/* ── Auth helpers ─────────────────────────── */

function authHeaders() {
  return { 'Authorization': 'Bearer ' + TOKEN };
}

function authJsonHeaders() {
  return { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };
}

/* ── Username ─────────────────────────────── */

function setupUsername() {
  const u = localStorage.getItem('ab_username') || 'Admin';
  document.getElementById('displayUsername').textContent = u;
  document.getElementById('avatarInitial').textContent = u.charAt(0).toUpperCase();
}

/* ── Navigation ───────────────────────────── */

function setupNavigation() {
  document.querySelectorAll('.sidebar-nav a[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchPage(link.dataset.page);
      document.getElementById('sidebar').classList.remove('open');
    });
  });
}

function switchPage(page) {
  currentPage = page;
  document.querySelectorAll('.sidebar-nav a[data-page]').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
  document.querySelectorAll('.page-section').forEach(s => {
    s.classList.toggle('active', s.id === 'section-' + page);
  });
  const titles = { pastoral_letters: 'Pastoral Letters', homilies: 'Homilies', writings: 'Writings', settings: 'Settings' };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  document.getElementById('breadcrumb').textContent = 'Dashboard / ' + (titles[page] || page);
  document.getElementById('statsRow').style.display = page === 'settings' ? 'none' : 'grid';
}

function setupMobileToggle() {
  document.getElementById('mobileToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('ab_token');
    localStorage.removeItem('ab_username');
    window.location.href = 'index.html';
  });
}

function displayApiUrl() {
  document.getElementById('apiBaseUrl').textContent = window.location.origin + '/api';
}

/* ── Load data ────────────────────────────── */

async function loadAllData() {
  await Promise.all([
    loadContent('pastoral_letters', '/pastoral-letters'),
    loadContent('homilies', '/homilies'),
    loadContent('writings', '/writings')
  ]);
}

async function loadContent(type, endpoint) {
  try {
    const res = await fetch(API + endpoint);
    const data = await res.json();
    if (data.success) {
      contentCache[type] = data.data;
      renderTable(type);
      updateStats();
    }
  } catch (err) {
    showToast('Failed to load ' + type.replace(/_/g, ' '), 'error');
  }
}

function updateStats() {
  document.getElementById('statLetters').textContent = contentCache.pastoral_letters.length;
  document.getElementById('statHomilies').textContent = contentCache.homilies.length;
  document.getElementById('statWritings').textContent = contentCache.writings.length;
}

/* ── Render tables ────────────────────────── */

function renderTable(type) {
  const tbody = document.getElementById('table-' + type);
  const empty = document.getElementById('empty-' + type);
  const items = contentCache[type];

  if (!items.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    tbody.closest('table').style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  tbody.closest('table').style.display = 'table';

  if (type === 'pastoral_letters') {
    tbody.innerHTML = items.map(item => `
      <tr>
        <td><strong>${escHtml(item.title)}</strong></td>
        <td>${item.date || '—'}</td>
        <td>${item.pdf_url ? '<a href="' + escHtml(item.pdf_url) + '" target="_blank" style="color:var(--gold);">View PDF</a> <a href="#" download style="display:inline-block;margin-left:6px;padding:4px 10px;background:var(--navy);color:#fff;border-radius:4px;font-size:12px;text-decoration:none;" onclick="event.preventDefault();downloadFile(\'' + escJs(item.pdf_url) + '\',\'' + escJs(item.title) + '\')">Download</a>' : '—'}</td>
        <td class="actions">
          <button class="btn-secondary" onclick="editItem('pastoral_letters', ${item.id})">Edit</button>
          <button class="btn-danger" onclick="confirmDelete('pastoral_letters', ${item.id}, '${escJs(item.title)}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } else if (type === 'homilies') {
    tbody.innerHTML = items.map(item => `
      <tr>
        <td><strong>${escHtml(item.title)}</strong></td>
        <td>${escHtml(item.occasion || '—')}</td>
        <td>${item.date || '—'}</td>
        <td>${item.pdf_url ? '<a href="' + escHtml(item.pdf_url) + '" target="_blank" style="color:var(--gold);">View PDF</a> <a href="#" download style="display:inline-block;margin-left:6px;padding:4px 10px;background:var(--navy);color:#fff;border-radius:4px;font-size:12px;text-decoration:none;" onclick="event.preventDefault();downloadFile(\'' + escJs(item.pdf_url) + '\',\'' + escJs(item.title) + '\')">Download</a>' : '—'}</td>
        <td class="actions">
          <button class="btn-secondary" onclick="editItem('homilies', ${item.id})">Edit</button>
          <button class="btn-danger" onclick="confirmDelete('homilies', ${item.id}, '${escJs(item.title)}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } else if (type === 'writings') {
    tbody.innerHTML = items.map(item => `
      <tr>
        <td><strong>${escHtml(item.title)}</strong></td>
        <td>${escHtml(item.category || '—')}</td>
        <td>${item.date || '—'}</td>
        <td class="actions">
          <button class="btn-secondary" onclick="editItem('writings', ${item.id})">Edit</button>
          <button class="btn-danger" onclick="confirmDelete('writings', ${item.id}, '${escJs(item.title)}')">Delete</button>
        </td>
      </tr>
    `).join('');
  }
}

/* ══════════════════════════════════════════════
   Two-Stage Upload Modal
   ══════════════════════════════════════════════ */

function openModal(type) {
  document.getElementById('editType').value = type;

  const titleMap = { pastoral_letters: 'Pastoral Letter', homilies: 'Homily', writings: 'Writing' };
  document.getElementById('modalTitle').textContent = 'Add New ' + titleMap[type];

  /* Show/hide occasion dropdown for homilies */
  document.getElementById('groupOccasionUpload').style.display = type === 'homilies' ? 'block' : 'none';
  document.getElementById('groupOccasionCustom').style.display = 'none';
  document.getElementById('fieldOccasionSelect').value = '';

  /* Cover photo: only for pastoral letters; auto-cover notice for others */
  const isPastoral = type === 'pastoral_letters';
  document.getElementById('groupCoverUpload').style.display = isPastoral ? 'block' : 'none';
  document.getElementById('noticeAutoCover').style.display = isPastoral ? 'none' : 'flex';

  /* Reset state */
  document.getElementById('fieldTitle').value = '';
  document.getElementById('fileCover').value = '';
  document.getElementById('filePdf').value = '';
  document.getElementById('previewCover').style.display = 'none';
  document.getElementById('promptCover').style.display = 'block';
  document.getElementById('previewPdf').style.display = 'none';
  document.getElementById('promptPdf').style.display = 'block';

  /* Show stage 1, hide others */
  document.getElementById('modalStage1').style.display = 'block';
  document.getElementById('modalLoading').style.display = 'none';
  document.getElementById('modalStage2').style.display = 'none';
  document.getElementById('modalEdit').style.display = 'none';

  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

function toggleCustomOccasion() {
  const val = document.getElementById('fieldOccasionSelect').value;
  document.getElementById('groupOccasionCustom').style.display = val === 'Other' ? 'block' : 'none';
}

/* ── Drop Zone Setup ──────────────────────── */

function setupDropZones() {
  ['dropCover', 'dropPdf'].forEach(id => {
    const zone = document.getElementById(id);
    if (!zone) return;

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const inputId = id === 'dropCover' ? 'fileCover' : 'filePdf';
      const previewId = id === 'dropCover' ? 'previewCover' : 'previewPdf';
      const input = document.getElementById(inputId);

      /* Create a DataTransfer to set files */
      const dt = new DataTransfer();
      if (e.dataTransfer.files.length) {
        dt.items.add(e.dataTransfer.files[0]);
        input.files = dt.files;
        handleFilePreview(input, previewId, id);
      }
    });
  });
}

function handleFilePreview(input, previewId, zoneId) {
  const file = input.files[0];
  if (!file) return;

  const promptId = zoneId === 'dropCover' ? 'promptCover' : 'promptPdf';
  document.getElementById(promptId).style.display = 'none';

  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.getElementById(previewId);
      img.src = e.target.result;
      img.style.display = 'block';
    };
    reader.readAsDataURL(file);
  } else {
    const div = document.getElementById(previewId);
    div.innerHTML = '📄 <strong>' + escHtml(file.name) + '</strong><br><small>' + (file.size / 1024 / 1024).toFixed(1) + ' MB</small>';
    div.style.display = 'block';
  }
}

/* ── Stage 1: Upload & Process ────────────── */

async function uploadAndProcess() {
  const type = document.getElementById('editType').value;
  const title = document.getElementById('fieldTitle').value.trim();

  if (!title) {
    showToast('Title is required.', 'error');
    return;
  }

  const btn = document.getElementById('uploadBtn');
  btn.disabled = true;

  /* Show loading */
  document.getElementById('modalStage1').style.display = 'none';
  document.getElementById('modalLoading').style.display = 'block';

  const endpointMap = { pastoral_letters: '/pastoral-letters', homilies: '/homilies', writings: '/writings' };

  const formData = new FormData();
  formData.append('title', title);

  /* Occasion for homilies */
  if (type === 'homilies') {
    const selVal = document.getElementById('fieldOccasionSelect').value;
    const occasion = selVal === 'Other'
      ? document.getElementById('fieldOccasionCustom').value
      : selVal;
    if (occasion) formData.append('occasion', occasion);
  }

  const coverFile = document.getElementById('fileCover').files[0];
  const pdfFile = document.getElementById('filePdf').files[0];
  if (coverFile) formData.append('cover_photo', coverFile);
  if (pdfFile) formData.append('pdf_file', pdfFile);

  try {
    const res = await fetch(API + endpointMap[type], {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      showStage2(data.data, data.ai_processed, type);
      await loadContent(type, endpointMap[type]);
    } else {
      showToast(data.message || 'Upload failed.', 'error');
      document.getElementById('modalLoading').style.display = 'none';
      document.getElementById('modalStage1').style.display = 'block';
    }
  } catch (err) {
    showToast('Upload failed. Please try again.', 'error');
    document.getElementById('modalLoading').style.display = 'none';
    document.getElementById('modalStage1').style.display = 'block';
  } finally {
    btn.disabled = false;
  }
}

/* ── Stage 2: Review AI Results ───────────── */

function showStage2(record, aiProcessed, type) {
  document.getElementById('modalLoading').style.display = 'none';
  document.getElementById('modalStage2').style.display = 'block';

  document.getElementById('stage2Id').value = record.id;
  document.getElementById('modalTitle').textContent = 'Review & Publish';

  /* AI notice */
  document.getElementById('aiNotice').style.display = aiProcessed ? 'none' : 'block';

  /* Parse JSON fields */
  let tags = [];
  let highlights = [];
  try { tags = JSON.parse(record.tags || '[]'); } catch (e) {}
  try { highlights = JSON.parse(record.highlights || '[]'); } catch (e) {}

  /* Fill fields */
  document.getElementById('s2Title').value = record.title || '';
  document.getElementById('s2Summary').value = record.description || record.body || '';
  document.getElementById('s2Date').value = record.date || '';
  document.getElementById('s2KeyQuote').value = record.key_quote || '';
  document.getElementById('s2Tags').value = tags.join(', ');
  document.getElementById('s2ReadingTime').value = record.reading_time || '';
  document.getElementById('s2Tone').value = record.tone || '';
  document.getElementById('s2Highlight1').value = highlights[0] || '';
  document.getElementById('s2Highlight2').value = highlights[1] || '';
  document.getElementById('s2Highlight3').value = highlights[2] || '';

  /* Show occasion/category fields */
  document.getElementById('s2GroupOccasion').style.display = type === 'homilies' ? 'block' : 'none';
  document.getElementById('s2GroupCategory').style.display = type === 'writings' ? 'block' : 'none';
  document.getElementById('s2Occasion').value = record.occasion || '';
  document.getElementById('s2Category').value = record.category || '';
}

/* ── Stage 2: Publish ─────────────────────── */

async function publishContent() {
  const type = document.getElementById('editType').value;
  const id = document.getElementById('stage2Id').value;

  const endpointMap = { pastoral_letters: '/pastoral-letters', homilies: '/homilies', writings: '/writings' };

  const tags = document.getElementById('s2Tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const highlights = [
    document.getElementById('s2Highlight1').value,
    document.getElementById('s2Highlight2').value,
    document.getElementById('s2Highlight3').value
  ].filter(Boolean);

  const body = {
    title: document.getElementById('s2Title').value,
    description: document.getElementById('s2Summary').value,
    date: document.getElementById('s2Date').value,
    key_quote: document.getElementById('s2KeyQuote').value,
    tags: JSON.stringify(tags),
    reading_time: document.getElementById('s2ReadingTime').value,
    tone: document.getElementById('s2Tone').value,
    highlights: JSON.stringify(highlights)
  };

  if (type === 'homilies') body.occasion = document.getElementById('s2Occasion').value;
  if (type === 'writings') {
    body.body = document.getElementById('s2Summary').value;
    body.category = document.getElementById('s2Category').value;
  }

  const btn = document.getElementById('publishBtn');
  btn.disabled = true;
  btn.textContent = 'Publishing…';

  try {
    const res = await fetch(API + endpointMap[type] + '/' + id, {
      method: 'PUT',
      headers: authJsonHeaders(),
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (data.success) {
      showToast('Published successfully!', 'success');
      closeModal();
      await loadContent(type, endpointMap[type]);
    } else {
      showToast(data.message || 'Failed to publish.', 'error');
    }
  } catch (err) {
    showToast('Failed to publish.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Publish';
  }
}

/* ── Stage 2: Cancel (delete uploaded record) */

async function cancelStage2() {
  const type = document.getElementById('editType').value;
  const id = document.getElementById('stage2Id').value;
  const endpointMap = { pastoral_letters: '/pastoral-letters', homilies: '/homilies', writings: '/writings' };

  if (id) {
    try {
      await fetch(API + endpointMap[type] + '/' + id, {
        method: 'DELETE',
        headers: authHeaders()
      });
      await loadContent(type, endpointMap[type]);
    } catch (e) { /* ignore */ }
  }

  closeModal();
  showToast('Upload cancelled.', 'error');
}

/* ══════════════════════════════════════════════
   Edit Modal (for existing records)
   ══════════════════════════════════════════════ */

function editItem(type, id) {
  const item = contentCache[type].find(i => i.id === id);
  if (!item) return;

  document.getElementById('editType').value = type;
  document.getElementById('editId').value = id;

  const titleMap = { pastoral_letters: 'Pastoral Letter', homilies: 'Homily', writings: 'Writing' };
  document.getElementById('modalTitle').textContent = 'Edit ' + titleMap[type];

  /* Parse JSON */
  let tags = [];
  let highlights = [];
  try { tags = JSON.parse(item.tags || '[]'); } catch (e) {}
  try { highlights = JSON.parse(item.highlights || '[]'); } catch (e) {}

  document.getElementById('editTitle').value = item.title || '';
  document.getElementById('editDescription').value = item.description || item.body || '';
  document.getElementById('editDate').value = item.date || '';
  document.getElementById('editKeyQuote').value = item.key_quote || '';
  document.getElementById('editTags').value = tags.join(', ');
  document.getElementById('editReadingTime').value = item.reading_time || '';
  document.getElementById('editTone').value = item.tone || '';
  document.getElementById('editHighlight1').value = highlights[0] || '';
  document.getElementById('editHighlight2').value = highlights[1] || '';
  document.getElementById('editHighlight3').value = highlights[2] || '';

  document.getElementById('editGroupOccasion').style.display = type === 'homilies' ? 'block' : 'none';
  document.getElementById('editGroupCategory').style.display = type === 'writings' ? 'block' : 'none';
  document.getElementById('editGroupCoverPhoto').style.display = type === 'pastoral_letters' ? 'block' : 'none';
  document.getElementById('editOccasion').value = item.occasion || '';
  document.getElementById('editCategory').value = item.category || '';

  /* Clear file inputs */
  document.getElementById('editCoverPhoto').value = '';
  document.getElementById('editPdfFile').value = '';

  /* Show edit mode, hide others */
  document.getElementById('modalStage1').style.display = 'none';
  document.getElementById('modalLoading').style.display = 'none';
  document.getElementById('modalStage2').style.display = 'none';
  document.getElementById('modalEdit').style.display = 'block';

  document.getElementById('modalOverlay').classList.add('active');
}

async function saveEdit() {
  const type = document.getElementById('editType').value;
  const id = document.getElementById('editId').value;
  const endpointMap = { pastoral_letters: '/pastoral-letters', homilies: '/homilies', writings: '/writings' };

  const btn = document.getElementById('editSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const tags = document.getElementById('editTags').value.split(',').map(t => t.trim()).filter(Boolean);
  const highlights = [
    document.getElementById('editHighlight1').value,
    document.getElementById('editHighlight2').value,
    document.getElementById('editHighlight3').value
  ].filter(Boolean);

  /* Check if we need to upload files */
  const coverFile = document.getElementById('editCoverPhoto').files[0];
  const pdfFile = document.getElementById('editPdfFile').files[0];

  try {
    let res;

    if (coverFile || pdfFile) {
      /* Use FormData for file uploads */
      const formData = new FormData();
      formData.append('title', document.getElementById('editTitle').value);
      formData.append('description', document.getElementById('editDescription').value);
      formData.append('date', document.getElementById('editDate').value);
      formData.append('key_quote', document.getElementById('editKeyQuote').value);
      formData.append('tags', JSON.stringify(tags));
      formData.append('reading_time', document.getElementById('editReadingTime').value);
      formData.append('tone', document.getElementById('editTone').value);
      formData.append('highlights', JSON.stringify(highlights));

      if (type === 'homilies') formData.append('occasion', document.getElementById('editOccasion').value);
      if (type === 'writings') {
        formData.append('body', document.getElementById('editDescription').value);
        formData.append('category', document.getElementById('editCategory').value);
      }

      if (coverFile) formData.append('cover_photo', coverFile);
      if (pdfFile) formData.append('pdf_file', pdfFile);

      res = await fetch(API + endpointMap[type] + '/' + id, {
        method: 'PUT',
        headers: authHeaders(),
        body: formData
      });
    } else {
      /* JSON body, no files */
      const body = {
        title: document.getElementById('editTitle').value,
        description: document.getElementById('editDescription').value,
        date: document.getElementById('editDate').value,
        key_quote: document.getElementById('editKeyQuote').value,
        tags: JSON.stringify(tags),
        reading_time: document.getElementById('editReadingTime').value,
        tone: document.getElementById('editTone').value,
        highlights: JSON.stringify(highlights)
      };

      if (type === 'homilies') body.occasion = document.getElementById('editOccasion').value;
      if (type === 'writings') {
        body.body = document.getElementById('editDescription').value;
        body.category = document.getElementById('editCategory').value;
      }

      res = await fetch(API + endpointMap[type] + '/' + id, {
        method: 'PUT',
        headers: authJsonHeaders(),
        body: JSON.stringify(body)
      });
    }

    const data = await res.json();

    if (data.success) {
      showToast('Updated successfully!', 'success');
      closeModal();
      await loadContent(type, endpointMap[type]);
    } else {
      showToast(data.message || 'Failed to save.', 'error');
    }
  } catch (err) {
    showToast('Failed to save.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
}

/* ══════════════════════════════════════════════
   Delete
   ══════════════════════════════════════════════ */

function confirmDelete(type, id, title) {
  pendingDeleteType = type;
  pendingDeleteId = id;
  document.getElementById('confirmMessage').textContent =
    'Are you sure you want to delete "' + title + '"? This action cannot be undone.';
  document.getElementById('confirmOverlay').classList.add('active');
  document.getElementById('confirmDeleteBtn').onclick = () => executeDelete();
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('active');
  pendingDeleteType = null;
  pendingDeleteId = null;
}

async function executeDelete() {
  const type = pendingDeleteType;
  const id = pendingDeleteId;
  closeConfirm();

  const endpointMap = { pastoral_letters: '/pastoral-letters', homilies: '/homilies', writings: '/writings' };

  try {
    const res = await fetch(API + endpointMap[type] + '/' + id, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast('Deleted successfully.', 'success');
      await loadContent(type, endpointMap[type]);
    } else {
      showToast(data.message || 'Failed to delete.', 'error');
    }
  } catch (err) {
    showToast('Failed to delete.', 'error');
  }
}

/* ── Change Password ──────────────────────── */

function setupPasswordForm() {
  document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (newPass.length < 6) { showToast('New password must be at least 6 characters.', 'error'); return; }
    if (newPass !== confirm) { showToast('New passwords do not match.', 'error'); return; }

    try {
      const res = await fetch(API + '/auth/change-password', {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({ currentPassword: current, newPassword: newPass })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Password updated successfully.', 'success');
        document.getElementById('changePasswordForm').reset();
      } else {
        showToast(data.message || 'Failed to update password.', 'error');
      }
    } catch (err) {
      showToast('Failed to update password.', 'error');
    }
  });
}

/* ── Toast ─────────────────────────────────── */

function showToast(message, type) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
}

/* ── Clipboard ────────────────────────────── */

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!', 'success');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied to clipboard!', 'success');
  });
}

/* ── File Download ────────────────────────── */

function downloadFile(url, title) {
  if (!url) return;
  let downloadUrl = url;
  if (url.includes('cloudinary.com') || url.includes('res.cloudinary')) {
    downloadUrl = url.replace('/upload/', '/upload/fl_attachment/');
  }
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = (title || 'document').replace(/[^a-zA-Z0-9\s\-_]/g, '') + '.pdf';
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ── Escape helpers ───────────────────────── */

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escJs(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}
