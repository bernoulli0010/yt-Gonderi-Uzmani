const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));

  const filePath = 'file://' + path.resolve('app/video-uretim-hatti.html');
  console.log('Opening:', filePath);
  
  await page.goto(filePath);
  await page.waitForTimeout(2000); // wait for auto-search and rendering
  
  await browser.close();
})();
