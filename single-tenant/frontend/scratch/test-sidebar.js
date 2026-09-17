import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:8074/dashboard');
  await page.waitForTimeout(1000);

  if (page.url().includes('/login')) {
    console.log('Logging in...');
    await page.fill('input[type="email"]', 'superadmin@kopikeliling.com');
    await page.fill('input[type="password"]', 'Password123@');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 5000 });
  }

  console.log('Current URL:', page.url());

  const asideBefore = await page.evaluate(() => {
    const el = document.querySelector('aside');
    return el ? {
      width: el.getBoundingClientRect().width,
      classList: Array.from(el.classList),
      html: el.outerHTML.substring(0, 300)
    } : 'NOT_FOUND';
  });
  console.log('Sidebar before click:', JSON.stringify(asideBefore, null, 2));

  // Find hamburger button
  const toggleBtn = page.locator('button[aria-label*="menu navigasi"]');
  console.log('Toggle button count:', await toggleBtn.count());
  console.log('Is visible:', await toggleBtn.isVisible());

  await toggleBtn.click();
  await page.waitForTimeout(500);

  const asideAfter = await page.evaluate(() => {
    const el = document.querySelector('aside');
    return el ? {
      width: el.getBoundingClientRect().width,
      classList: Array.from(el.classList),
    } : 'NOT_FOUND';
  });
  console.log('Sidebar after click:', JSON.stringify(asideAfter, null, 2));

  await page.screenshot({ path: 'scratch/sidebar-test.png' });
  await browser.close();
}

run().catch(console.error);
