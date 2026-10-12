const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => {
      console.log(`[Browser] ${msg.type()}: ${msg.text()}`);
    });

    page.on('pageerror', error => {
      console.log(`[Browser] PAGE ERROR: ${error.message}`);
    });

    console.log('Navigating to Next Candle page...');
    await page.goto('http://localhost:5173/next-candle'); // Or whatever the URL is. Or click.
    
    // Actually let's just click the Next Candle nav link to be safe since we don't know the exact URL route.
    await page.goto('http://localhost:5173');
    await new Promise(r => setTimeout(r, 1000));
    
    // Find Next Candle link
    const links = await page.$$('a');
    for (const link of links) {
        const text = await page.evaluate(el => el.textContent, link);
        if (text && text.includes('Next Candle')) {
            console.log('Clicking Next Candle link...');
            await link.click();
            break;
        }
    }

    await new Promise(r => setTimeout(r, 4000));

    console.log('Done.');
    await browser.close();
  } catch (err) {
    console.error('Puppeteer Error:', err);
  }
})();
