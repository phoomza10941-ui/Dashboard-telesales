const { chromium } = require('playwright');
const path = require('path');
const OUT = 'D:\\tmp_review';

(async () => {
  const browser = await chromium.launch({ headless: true });

  // War Room & Supervisor (no login)
  async function shotPublic(url, f) {
    const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2000);
    await p.screenshot({ path: path.join(OUT, f), fullPage: true });
    console.log('DONE', f);
    await p.close();
  }
  await shotPublic('http://localhost:3000/war-room', 'final-war-room.png');
  await shotPublic('http://localhost:3000/supervisor/team-performance', 'final-supervisor.png');

  // My Desk pages (needs login)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="text"]').first().fill('masa');
  await page.locator('input[type="password"]').first().fill('Login1098');
  await page.locator('button[type="submit"]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const myDeskPages = [
    ['final-today-command.png',   '/my-desk/today-command'],
    ['final-priority-queue.png',  '/my-desk/priority-queue'],
    ['final-pending-payment.png', '/my-desk/pending-payment'],
    ['final-follow-up.png',       '/my-desk/follow-up'],
    ['final-my-performance.png',  '/my-desk/my-performance'],
    ['final-add-customer.png',    '/my-desk/add-customer'],
  ];
  for (const [f, route] of myDeskPages) {
    await page.goto('http://localhost:3000' + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, f), fullPage: true });
    console.log('DONE', f);
  }

  await browser.close();
  console.log('All final screenshots done');
})();
