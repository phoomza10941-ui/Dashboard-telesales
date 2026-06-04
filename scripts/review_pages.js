const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = 'D:\\tmp_review';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ---- helper ----
  async function shot(url, filename, waitMs = 2000) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(waitMs);
      await page.screenshot({ path: path.join(OUT, filename), fullPage: true });
      console.log(`✓ ${filename}  →  ${page.url()}`);
    } catch (e) {
      console.error(`✗ ${filename}: ${e.message}`);
    } finally {
      await page.close();
    }
  }

  await shot('http://localhost:3001',             'home.png');
  await shot('http://localhost:3001/my-desk',     'my-desk.png');
  await shot('http://localhost:3001/supervisor',  'supervisor.png');
  await shot('http://localhost:3001/war-room',    'war-room.png');

  // Also try auth page if redirected
  await shot('http://localhost:3001/auth/login',  'login.png');

  await browser.close();
  console.log('Done. Screenshots in', OUT);
})();
