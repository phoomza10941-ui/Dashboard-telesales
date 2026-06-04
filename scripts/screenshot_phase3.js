const { chromium } = require('playwright');
const path = require('path');
const OUT = 'D:\\tmp_review';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Login
  await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="text"]').first().fill('masa');
  await page.locator('input[type="password"]').first().fill('Login1098');
  await page.locator('button[type="submit"]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Add Customer
  await page.goto('http://localhost:3000/my-desk/add-customer', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'add-customer-p3.png'), fullPage: true });
  console.log('DONE add-customer-p3.png');

  // My Performance
  await page.goto('http://localhost:3000/my-desk/my-performance', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'my-performance-p3.png'), fullPage: true });
  console.log('DONE my-performance-p3.png');

  await browser.close();
  console.log('All done');
})();
