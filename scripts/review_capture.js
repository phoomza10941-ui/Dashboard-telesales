const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = 'D:\\tmp_review';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  async function shot(name, route, full = true) {
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: full });
      console.log('DONE', name, '->', page.url());
    } catch (e) {
      console.log('FAIL', name, e.message);
    }
  }

  // Public pages
  await shot('00-login', '/auth/login', false);
  await shot('01-register', '/auth/register', true);
  // War room (TV dashboard) - capture at 16:9 no full page
  await page.setViewportSize({ width: 1920, height: 1080 });
  await shot('02-war-room', '/war-room', false);
  await page.setViewportSize({ width: 1600, height: 1000 });

  // Login
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.locator('input[type="text"]').first().fill('masa');
  await page.locator('input[type="password"]').first().fill('Login1098');
  await page.locator('button[type="submit"]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  console.log('After login:', page.url());

  // My Desk
  const mydesk = [
    ['10-today-command', '/my-desk/today-command'],
    ['11-priority-queue', '/my-desk/priority-queue'],
    ['12-pending-payment', '/my-desk/pending-payment'],
    ['13-follow-up', '/my-desk/follow-up'],
    ['14-my-performance', '/my-desk/my-performance'],
    ['15-add-customer', '/my-desk/add-customer'],
    ['16-customers-list', '/my-desk/customers-list'],
    ['17-script-helper', '/my-desk/script-helper'],
    ['18-coaching', '/my-desk/coaching'],
    ['19-canceled', '/my-desk/canceled'],
  ];
  for (const [n, r] of mydesk) await shot(n, r);

  // Supervisor
  const sup = [
    ['30-team-performance', '/supervisor/team-performance'],
    ['31-ai-coaching', '/supervisor/ai-coaching'],
    ['32-coaching-log', '/supervisor/coaching-log'],
    ['33-hot-cases', '/supervisor/hot-cases'],
    ['34-drop-off-risk', '/supervisor/drop-off-risk'],
    ['35-funnel-diagnosis', '/supervisor/funnel-diagnosis'],
    ['36-follow-up-compliance', '/supervisor/follow-up-compliance'],
    ['37-lead-quality', '/supervisor/lead-quality'],
    ['38-objection-by-person', '/supervisor/objection-by-person'],
    ['39-script-recommendation', '/supervisor/script-recommendation'],
    ['40-report', '/supervisor/report'],
    ['41-settings', '/supervisor/settings'],
  ];
  for (const [n, r] of sup) await shot(n, r);

  await browser.close();
  console.log('All screenshots saved to', OUT);
})();
