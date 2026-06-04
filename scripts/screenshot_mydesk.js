const { chromium } = require('playwright');
const path = require('path');
const OUT = 'D:\\tmp_review';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Login
  await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Fill username and password
  await page.locator('input[type="text"]').first().fill('masa');
  await page.locator('input[type="password"]').first().fill('Login1098');
  await page.locator('button[type="submit"]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  console.log('After login:', page.url());
  await page.screenshot({ path: path.join(OUT, 'after-login.png'), fullPage: true });

  // My Desk sub-pages
  const pages = [
    ['my-desk-home',    '/my-desk'],
    ['today-command',   '/my-desk/today-command'],
    ['priority-queue',  '/my-desk/priority-queue'],
    ['pending-payment', '/my-desk/pending-payment'],
    ['follow-up',       '/my-desk/follow-up'],
    ['my-performance',  '/my-desk/my-performance'],
    ['add-customer',    '/my-desk/add-customer'],
  ];

  for (const [name, route] of pages) {
    await page.goto('http://localhost:3000' + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
    console.log('DONE', name, '->', page.url());
  }

  await browser.close();
  console.log('All screenshots saved to', OUT);
})();
