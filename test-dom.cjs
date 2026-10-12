const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173');
    
    // Find Next Candle link and click it
    await new Promise(r => setTimeout(r, 1000));
    const links = await page.$$('a');
    for (const link of links) {
        const text = await page.evaluate(el => el.textContent, link);
        if (text && text.includes('Next Candle')) {
            await link.click();
            break;
        }
    }

    // Wait 5 seconds for health check and SignalR to connect
    await new Promise(r => setTimeout(r, 5000));

    // Get the DOM values
    const data = await page.evaluate(() => {
        const quotex = document.getElementById('ncQuotexTime')?.innerText;
        const utc = document.getElementById('ncUtcTime')?.innerText;
        const countdown = document.getElementById('ncCountdown')?.innerText;
        const status = document.getElementById('ncStatusText')?.innerText;
        return { quotex, utc, countdown, status };
    });

    console.log('DOM Data:', data);

    await browser.close();
  } catch (err) {
    console.error('Puppeteer Error:', err);
  }
})();
