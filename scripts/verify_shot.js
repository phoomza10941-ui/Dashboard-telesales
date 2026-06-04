const { chromium } = require('playwright');
const path = require('path'); const OUT = 'D:/tmp_review';
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.setViewportSize({ width: 1920, height: 1080 });
  await p.goto('http://localhost:3000/war-room', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: path.join(OUT, 'fixed-war-room.png') });
  await p.setViewportSize({ width: 1600, height: 1000 });
  await p.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle' });
  await p.locator('input[type="text"]').first().fill('masa');
  await p.locator('input[type="password"]').first().fill('Login1098');
  await p.locator('button[type="submit"]').click();
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(2500);
  for (const [n,r] of [['fixed-today','/my-desk/today-command'],['fixed-perf','/my-desk/my-performance']]) {
    await p.goto('http://localhost:3000'+r, { waitUntil:'networkidle' }); await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(OUT, n+'.png') });
  }
  await b.close(); console.log('done');
})();
