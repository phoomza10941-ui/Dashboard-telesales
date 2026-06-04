const { chromium } = require('playwright');
const path = require('path');
const OUT = 'D:\\tmp_review';

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Supervisor (no login needed)
  const supPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await supPage.goto('http://localhost:3000/supervisor/team-performance', { waitUntil: 'networkidle' });
  await supPage.waitForTimeout(1500);
  await supPage.screenshot({ path: path.join(OUT, 'supervisor-p2.png'), fullPage: true });
  console.log('DONE supervisor-p2.png');
  await supPage.close();

  // My Performance (needs login)
  const agentPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await agentPage.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle' });
  await agentPage.locator('input[type="text"]').first().fill('masa');
  await agentPage.locator('input[type="password"]').first().fill('Login1098');
  await agentPage.locator('button[type="submit"]').click();
  await agentPage.waitForLoadState('networkidle');
  await agentPage.waitForTimeout(1500);
  await agentPage.goto('http://localhost:3000/my-desk/my-performance', { waitUntil: 'networkidle' });
  await agentPage.waitForTimeout(1500);
  await agentPage.screenshot({ path: path.join(OUT, 'my-performance-p2.png'), fullPage: true });
  console.log('DONE my-performance-p2.png');
  await agentPage.close();

  await browser.close();
  console.log('All done');
})();
