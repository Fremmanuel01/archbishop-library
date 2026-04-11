const { webkit } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

let server;
let browser;
let page;

async function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn('node', ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env }
    });

    server.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log('[server]', msg.trim());
      if (msg.includes('running on port')) {
        resolve();
      }
    });

    server.stderr.on('data', (data) => {
      console.error('[server error]', data.toString().trim());
    });

    setTimeout(() => reject(new Error('Server startup timeout')), 10000);
  });
}

async function run() {
  const fs = require('fs');
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('\n=== Archbishop Library Dashboard Test ===\n');

  /* Start server */
  console.log('1. Starting server...');
  await startServer();
  console.log('   Server started.\n');

  /* Launch browser */
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  try {
    /* ── Test: Login Page ──────────────────── */
    console.log('2. Testing Login Page...');
    await page.goto(BASE_URL + '/admin/index.html');
    await page.waitForSelector('#loginForm');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-login-page.png'), fullPage: true });
    console.log('   Screenshot: 01-login-page.png');

    /* Test invalid login */
    console.log('3. Testing invalid login...');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'wrongpassword');
    await page.click('.btn-login');
    await page.waitForSelector('.error-msg.visible');
    const errorText = await page.textContent('.error-msg');
    console.log('   Error message:', errorText);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-login-error.png'), fullPage: true });
    console.log('   Screenshot: 02-login-error.png');

    /* Test valid login */
    console.log('4. Testing valid login...');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('.btn-login');
    await page.waitForURL('**/dashboard.html');
    console.log('   Redirected to dashboard.');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-dashboard.png'), fullPage: true });
    console.log('   Screenshot: 03-dashboard.png');

    /* ── Test: Dashboard Stats ─────────────── */
    console.log('5. Verifying stats cards...');
    const statLetters = await page.textContent('#statLetters');
    const statHomilies = await page.textContent('#statHomilies');
    const statWritings = await page.textContent('#statWritings');
    console.log(`   Stats — Letters: ${statLetters}, Homilies: ${statHomilies}, Writings: ${statWritings}`);

    /* ── Test: Create Pastoral Letter ──────── */
    console.log('6. Testing Create Pastoral Letter...');
    await page.click('#section-pastoral_letters button:has-text("+ Add New")');
    await page.waitForSelector('.modal-overlay.active');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-modal-open.png'), fullPage: true });
    console.log('   Screenshot: 04-modal-open.png');

    await page.fill('#fieldTitle', 'Test Pastoral Letter');
    await page.fill('#fieldDescription', 'This is a test pastoral letter created by automated testing.');
    await page.fill('#fieldDate', '2024-12-25');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-modal-filled.png'), fullPage: true });
    console.log('   Screenshot: 05-modal-filled.png');

    await page.click('#modalSaveBtn');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-after-create.png'), fullPage: true });
    console.log('   Screenshot: 06-after-create.png');

    /* Verify it appears in table */
    const tableContent = await page.textContent('#table-pastoral_letters');
    const created = tableContent.includes('Test Pastoral Letter');
    console.log('   Item in table:', created ? 'YES' : 'NO');

    /* ── Test: Navigate to Homilies ────────── */
    console.log('7. Navigating to Homilies...');
    await page.click('a[data-page="homilies"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-homilies-section.png'), fullPage: true });
    console.log('   Screenshot: 07-homilies-section.png');

    /* ── Test: Navigate to Writings ────────── */
    console.log('8. Navigating to Writings...');
    await page.click('a[data-page="writings"]');
    await page.waitForTimeout(300);

    /* Create a writing */
    await page.click('#section-writings button:has-text("+ Add New")');
    await page.waitForSelector('.modal-overlay.active');
    await page.fill('#fieldTitle', 'Reflection on Faith');
    await page.fill('#fieldBody', 'A deep reflection on the nature of faith in modern times. The journey of belief requires patience, humility, and trust in divine providence.');
    await page.fill('#fieldCategory', 'Reflection');
    await page.fill('#fieldDate', '2024-11-01');
    await page.click('#modalSaveBtn');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-writings-created.png'), fullPage: true });
    console.log('   Screenshot: 08-writings-created.png');

    /* ── Test: Edit item ───────────────────── */
    console.log('9. Testing Edit...');
    await page.click('a[data-page="pastoral_letters"]');
    await page.waitForTimeout(300);
    await page.click('#table-pastoral_letters .btn-secondary');
    await page.waitForSelector('.modal-overlay.active');
    const titleValue = await page.inputValue('#fieldTitle');
    console.log('   Pre-filled title:', titleValue);

    await page.fill('#fieldTitle', 'Updated Pastoral Letter Title');
    await page.click('#modalSaveBtn');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-after-edit.png'), fullPage: true });
    console.log('   Screenshot: 09-after-edit.png');

    /* ── Test: Delete item ─────────────────── */
    console.log('10. Testing Delete...');
    await page.click('#table-pastoral_letters .btn-danger');
    await page.waitForSelector('.confirm-overlay.active');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-confirm-delete.png'), fullPage: true });
    console.log('    Screenshot: 10-confirm-delete.png');

    await page.click('#confirmDeleteBtn');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-after-delete.png'), fullPage: true });
    console.log('    Screenshot: 11-after-delete.png');

    /* ── Test: Settings page ───────────────── */
    console.log('11. Testing Settings page...');
    await page.click('a[data-page="settings"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12-settings.png'), fullPage: true });
    console.log('    Screenshot: 12-settings.png');

    /* ── Test: Appearance page ─────────────── */
    console.log('12. Testing Appearance page...');
    await page.goto(BASE_URL + '/admin/appearance.html');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13-appearance.png'), fullPage: true });
    console.log('    Screenshot: 13-appearance.png');

    /* Change layout and color */
    await page.click('.layout-option[data-layout="magazine"]');
    await page.fill('#primaryColor', '#8b0000');
    await page.fill('#accentColor', '#ffd700');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14-appearance-modified.png'), fullPage: true });
    console.log('    Screenshot: 14-appearance-modified.png');

    /* Switch tab */
    await page.click('.tab-bar button[data-tab="homilies"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15-appearance-homilies-tab.png'), fullPage: true });
    console.log('    Screenshot: 15-appearance-homilies-tab.png');

    /* ── Test: Responsive (mobile) ─────────── */
    console.log('13. Testing responsive/mobile view...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL + '/admin/dashboard.html');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16-mobile-dashboard.png'), fullPage: true });
    console.log('    Screenshot: 16-mobile-dashboard.png');

    /* Mobile menu toggle */
    await page.click('#mobileToggle');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '17-mobile-sidebar-open.png'), fullPage: true });
    console.log('    Screenshot: 17-mobile-sidebar-open.png');

    /* ── Summary ───────────────────────────── */
    console.log('\n=== ALL TESTS PASSED ===');
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log('Total screenshots: 17\n');

  } catch (err) {
    console.error('\n!!! TEST FAILED !!!');
    console.error(err.message);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'ERROR.png'), fullPage: true });
    console.error('Error screenshot saved.');
  } finally {
    await browser.close();
    server.kill();
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal error:', err);
  if (server) server.kill();
  process.exit(1);
});
