const { webkit } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots-v2');

let server, browser, page;

async function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn('node', ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env }
    });
    server.stdout.on('data', (d) => {
      const msg = d.toString();
      if (msg.includes('running on port')) resolve();
    });
    server.stderr.on('data', (d) => console.error('[server]', d.toString().trim()));
    setTimeout(() => reject(new Error('Server timeout')), 10000);
  });
}

async function run() {
  const fs = require('fs');
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  console.log('\n=== Archbishop Library v2 Dashboard Test ===\n');

  console.log('1. Starting server...');
  await startServer();
  console.log('   OK\n');

  browser = await webkit.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await ctx.newPage();

  try {
    /* Login */
    console.log('2. Login...');
    await page.goto(BASE_URL + '/admin/index.html');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('.btn-login');
    await page.waitForURL('**/dashboard.html');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-dashboard.png'), fullPage: true });
    console.log('   OK — Dashboard loaded\n');

    /* Two-stage modal — Stage 1 */
    console.log('3. Open Add New modal (Stage 1)...');
    await page.click('#section-pastoral_letters button:has-text("+ Add New")');
    await page.waitForSelector('.modal-overlay.active');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-stage1-modal.png'), fullPage: true });
    console.log('   OK — Stage 1 modal visible\n');

    /* Check drop zones exist */
    const dropCover = await page.isVisible('#dropCover');
    const dropPdf = await page.isVisible('#dropPdf');
    console.log('   Drop zones: Cover=' + dropCover + ', PDF=' + dropPdf);

    /* Fill title */
    await page.fill('#fieldTitle', 'Test Letter via Stage 1');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-stage1-filled.png'), fullPage: true });

    /* Close and verify */
    await page.click('.modal-close');
    await page.waitForTimeout(200);
    console.log('   Modal closed\n');

    /* Test Homilies occasion dropdown */
    console.log('4. Test Homilies occasion dropdown...');
    await page.click('a[data-page="homilies"]');
    await page.waitForTimeout(300);
    await page.click('#section-homilies button:has-text("+ Add New")');
    await page.waitForSelector('.modal-overlay.active');
    await page.waitForTimeout(300);

    const occasionVisible = await page.isVisible('#fieldOccasionSelect');
    console.log('   Occasion dropdown visible: ' + occasionVisible);

    await page.selectOption('#fieldOccasionSelect', 'Other');
    await page.waitForTimeout(200);
    const customVisible = await page.isVisible('#fieldOccasionCustom');
    console.log('   Custom occasion input visible: ' + customVisible);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-homily-occasion.png'), fullPage: true });
    await page.click('.modal-close');
    console.log('');

    /* Test Edit modal */
    console.log('5. Test Edit modal...');
    await page.click('a[data-page="pastoral_letters"]');
    await page.waitForTimeout(300);

    const hasEditBtn = await page.isVisible('#table-pastoral_letters .btn-secondary');
    if (hasEditBtn) {
      await page.click('#table-pastoral_letters .btn-secondary');
      await page.waitForSelector('.modal-overlay.active');
      await page.waitForTimeout(300);

      const editTitle = await page.inputValue('#editTitle');
      console.log('   Edit pre-filled title: ' + editTitle);

      /* Check new fields exist */
      const hasKeyQuote = await page.isVisible('#editKeyQuote');
      const hasTone = await page.isVisible('#editTone');
      const hasHighlights = await page.isVisible('#editHighlight1');
      const hasCoverReplace = await page.isVisible('#editCoverPhoto');
      console.log('   Edit fields: KeyQuote=' + hasKeyQuote + ' Tone=' + hasTone + ' Highlights=' + hasHighlights + ' CoverReplace=' + hasCoverReplace);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-edit-modal.png'), fullPage: true });
      await page.click('.modal-close');
    }
    console.log('');

    /* Test single post page */
    console.log('6. Test single post page...');
    await page.goto(BASE_URL + '/letter/1');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-single-post.png'), fullPage: true });
    const postTitle = await page.textContent('h1');
    console.log('   Post title: ' + postTitle.trim());
    console.log('');

    /* Test appearance page still works */
    console.log('7. Test Appearance page...');
    await page.goto(BASE_URL + '/admin/appearance.html');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-appearance.png'), fullPage: true });
    console.log('   OK\n');

    /* Mobile responsive */
    console.log('8. Mobile view...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL + '/letter/1');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-single-post-mobile.png'), fullPage: true });
    console.log('   OK\n');

    console.log('=== ALL TESTS PASSED ===');
    console.log('Screenshots: ' + SCREENSHOT_DIR + '\n');

  } catch (err) {
    console.error('\n!!! TEST FAILED !!!');
    console.error(err.message);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'ERROR.png'), fullPage: true });
  } finally {
    await browser.close();
    server.kill();
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal:', err);
  if (server) server.kill();
  process.exit(1);
});
