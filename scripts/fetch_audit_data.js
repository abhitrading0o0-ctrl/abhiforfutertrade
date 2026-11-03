// scripts/fetch_audit_data.js
import fs from 'fs';
import path from 'path';

async function fetchAndSave() {
  const envPath = path.resolve('.env');
  let key = '';
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/TWELVE_DATA_API_KEY=([a-zA-Z0-9]+)/);
    if (match) key = match[1];
  }

  if (!key) {
    console.error('No TWELVE_DATA_API_KEY found');
    process.exit(1);
  }

  const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY'];
  const dataset = {};

  for (const sym of symbols) {
    console.log(`Fetching 500 M1 candles for ${sym}...`);
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=1min&outputsize=500&apikey=${key}&timezone=UTC`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'ok' || !data.values) {
      console.error(`Failed to fetch ${sym}:`, data);
      continue;
    }

    // Parse into standard candle format, sorted ascending by time
    const raw = [...data.values].reverse(); // Do not mutate data.values in place
    const parsed = raw.map(c => {
      const timeSec = Math.floor(new Date(c.datetime.replace(' ', 'T') + 'Z').getTime() / 1000);
      return {
        time: timeSec,
        timestamp: timeSec,
        datetime: c.datetime,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseInt(c.volume || '100', 10),
        symbol: sym,
        timeframe: '1M',
        spread: sym.includes('JPY') ? 0.008 : 0.00008,
      };
    });

    dataset[sym] = parsed;
    console.log(`Successfully parsed ${parsed.length} candles for ${sym}`);
  }

  const outPath = path.resolve('historical_test_data.json');
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2));
  console.log(`Saved dataset to ${outPath}`);
}

fetchAndSave().catch(console.error);
