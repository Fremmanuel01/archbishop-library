/* ══════════════════════════════════════════════
   Archbishop Library — Dashboard Logic
   ══════════════════════════════════════════════ */

const API = window.location.origin + '/api';
const TOKEN = localStorage.getItem('ab_token');

/* Redirect to login if no token */
if (!TOKEN) {
  window.location.href = 'index.html';
}

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
  displayApiUrl();
  loadAllData();
});

/* ── Auth header helper ───────────────────── */

function authHeaders() {
  return { 'Authorization': 'Bearer ' + TOKEN };
}

function authJsonHeaders() {
  return {
    'Authorization': 'Bearer ' + TOKEN,
    'Content-Type': 'application/json'
  };
}

/* ── Username display ─────────────────────── */

function setupUsername() {
  const username = localStorage.getItem('ab_username') || 'Admin';
  document.getElementById('displayUsername').textContent = username;
  document.getElementById('avatarInitial').textContent = username.charAt(0).toUpperCase();
}

/* ── Navigation ───────────────────────────── */

function setupNavigation() {
  const links = document.querySelectorAll('.sidebar-nav a[data-page]');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      switchPage(page);

      /* Close mobile sidebar */
      document.getElementById('sidebar').classList.remove('open');
    });
  });
}

function switchPage(page) {
  currentPage = page;

  /* Update nav active state */
  document.querySelectorAll('.sidebar-nav a[data-page]').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  /* Show/hide sections */
  document.querySelectorAll('.page-section').forEach(s => {
    s.classList.toggle('active', s.id === 'section-' + page);
  });

  /* Update topbar */
  const titles = {
    pastoral_letters: 'Pastoral Letters',
    homilies: 'Homilies',
    writings: 'Writings',
    settings: 'Settings'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  document.getElementById('breadcrumb').textContent = 'Dashboard / ' + (titles[page] || page);

  /* Show/hide stats on content pages */
  document.getElementById('statsRow').style.display =
    page === 'settings' ? 'none' : 'grid';
}

/* ── Mobile Toggle ────────────────────────── */

function setupMobileToggle() {
  document.getElementById('mobileToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

/* ── Logout ───────────────────────────────── */

function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('ab_token');
    localStorage.removeItem('ab_username');
    window.location.href = 'index.html';
  });
}

/* ── API URL display ──────────────────────── */

function displayApiUrl() {
  document.getElementById('apiBaseUrl').textContent = window.location.origin + '/api';
}

/* ── Load all data ────────────────────────── */

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
    console.error('Error loading ' + type + ':', err);
    showToast('Failed to load ' + type.replace(/_/g, ' '), 'error');
  }
}

/* ── Update stats ─────────────────────────── */

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
        <td>${item.pdf_url ? '<a href="' + escHtml(item.pdf_url) + '" target="_blank" style="color:var(--gold);">View PDF</a>' : '—'}</td>
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
        <td>${item.pdf_url ? '<a href="' + escHtml(item.pdf_url) + '" target="_blank" style="color:var(--gold);">View PDF</a>' : '—'}</td>
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

/* ── Modal: Open ──────────────────────────── */

function openModal(type, item) {
  const isEdit = !!item;
  document.getElementById('editId').value = isEdit ? item.id : '';
  document.getElementById('editType').value = type;

  const titleMap = {
    pastoral_letters: 'Pastoral Letter',
    homilies: 'Homily',
    writings: 'Writing'
  };
  document.getElementById('modalTitle').textContent =
    (isEdit ? 'Edit ' : 'Add New ') + titleMap[type];

  /* Show/hide fields based on type */
  const showIf = (id, show) => document.getElementById(id).style.display = show ? 'block' : 'none';

  showIf('groupDescription', type !== 'writings');
  showIf('groupBody', type === 'writings');
  showIf('groupOccasion', type === 'homilies');
  showIf('groupCategory', type === 'writings');
  showIf('groupPdf', type !== 'writings');
  showIf('groupThumbnail', type !== 'writings');

  /* Pre-fill for edit */
  document.getElementById('fieldTitle').value = isEdit ? item.title || '' : '';
  document.getElementById('fieldDescription').value = isEdit ? item.description || '' : '';
  document.getElementById('fieldBody').value = isEdit ? item.body || '' : '';
  document.getElementById('fieldOccasion').value = isEdit ? item.occasion || '' : '';
  document.getElementById('fieldCategory').value = isEdit ? item.category || '' : '';
  document.getElementById('fieldDate').value = isEdit ? item.date || '' : '';

  /* Clear file inputs */
  document.getElementById('fieldPdf').value = '';
  document.getElementById('fieldThumbnail').value = '';

  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.getElementById('contentForm').reset();
}

/* ── Modal: Edit item ─────────────────────── */

function editItem(type, id) {
  const item = contentCache[type].find(i => i.id === id);
  if (item) openModal(type, item);
}

/* ── Modal: Save ──────────────────────────── */

async function saveContent() {
  const type = document.getElementById('editType').value;
  const editId = document.getElementById('editId').value;
  const isEdit = !!editId;

  const title = document.getElementById('fieldTitle').value.trim();
  if (!title) {
    showToast('Title is required.', 'error');
    return;
  }

  const saveBtn = document.getElementById('modalSaveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const endpointMap = {
    pastoral_letters: '/pastoral-letters',
    homilies: '/homilies',
    writings: '/writings'
  };

  try {
    let res;

    if (type === 'writings') {
      /* Writings: JSON body, no files */
      const body = {
        title,
        body: document.getElementById('fieldBody').value,
        category: document.getElementById('fieldCategory').value,
        date: document.getElementById('fieldDate').value
      };

      res = await fetch(API + endpointMap[type] + (isEdit ? '/' + editId : ''), {
        method: isEdit ? 'PUT' : 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify(body)
      });
    } else {
      /* Pastoral Letters & Homilies: FormData with files */
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', document.getElementById('fieldDescription').value);
      formData.append('date', document.getElementById('fieldDate').value);

      if (type === 'homilies') {
        formData.append('occasion', document.getElementById('fieldOccasion').value);
      }

      const pdfFile = document.getElementById('fieldPdf').files[0];
      const thumbFile = document.getElementById('fieldThumbnail').files[0];

      if (pdfFile) formData.append('pdf', pdfFile);
      if (thumbFile) formData.append('thumbnail', thumbFile);

      res = await fetch(API + endpointMap[type] + (isEdit ? '/' + editId : ''), {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: formData
      });
    }

    const data = await res.json();

    if (data.success) {
      showToast((isEdit ? 'Updated' : 'Created') + ' successfully!', 'success');
      closeModal();
      await loadContent(type, endpointMap[type]);
    } else {
      showToast(data.message || 'Failed to save.', 'error');
    }
  } catch (err) {
    console.error('Save error:', err);
    showToast('Failed to save. Please try again.', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  }
}

/* ── Delete: Confirm ──────────────────────── */

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

  const endpointMap = {
    pastoral_letters: '/pastoral-letters',
    homilies: '/homilies',
    writings: '/writings'
  };

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
    console.error('Delete error:', err);
    showToast('Failed to delete. Please try again.', 'error');
  }
}

/* ── Change Password ──────────────────────── */

function setupPasswordForm() {
  document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (newPass.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }

    if (newPass !== confirm) {
      showToast('New passwords do not match.', 'error');
      return;
    }

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

/* ── Toast Notifications ──────────────────── */

function showToast(message, type) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 4000);
}

/* ── Clipboard ────────────────────────────── */

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!', 'success');
  }).catch(() => {
    /* Fallback for older browsers */
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
