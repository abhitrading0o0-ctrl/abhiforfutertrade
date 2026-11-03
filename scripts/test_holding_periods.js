import fs from 'fs';
import { calculateTechnicalIndicators } from '../src/predictionEngine.js';
import { evaluateAllStrategies } from '../src/strategyEngine.js';

const datasets = JSON.parse(fs.readFileSync('historical_test_data.json', 'utf8'));

const topM1Strats = [
  'M1 ATR-Normalized Impulse',
  'M1 Micro-Range Breakout',
  'M1 Momentum Burst',
  'M1 Inside-Bar Breakout',
  'M1 Compression Expansion',
  'M1 Adaptive First-Move Engine (AFME)',
  'M1 First Pullback Continuation'
];

console.log('Comparing 1-bar vs 3-bar holding outcomes for confirmed M1 setups:\n');

for (const stratName of topM1Strats) {
  let c1Wins = 0, c3Wins = 0, total = 0;
  let c1NetPips = 0, c3NetPips = 0;
  let c1GrossPips = 0, c3GrossPips = 0;
  let c3MaxPips = 0;

  for (const [sym, candles] of Object.entries(datasets)) {
    const pipMult = sym.includes('JPY') ? 100 : 10000;
    const spread = sym.includes('JPY') ? 0.9 : 0.8;

    for (let i = 35; i < candles.length - 4; i++) {
      const slice = candles.slice(0, i + 1);
      const cur = candles[i];
      const inds = calculateTechnicalIndicators(slice);
      const strats = evaluateAllStrategies(slice, inds, null, null, null, null, null, null, { symbol: sym, timeframe: '1M', spreadPips: spread });
      const target = strats.find(s => s.name === stratName);

      if (target && (target.signal === 'BULLISH' || target.signal === 'BEARISH')) {
        total++;
        const isBull = target.signal === 'BULLISH';

        // 1-candle outcome
        const c1 = candles[i + 1];
        const g1 = isBull ? (c1.close - cur.close) * pipMult : (cur.close - c1.close) * pipMult;
        if (g1 > 0) c1Wins++;
        c1GrossPips += g1;
        c1NetPips += (g1 - spread);

        // 3-candle outcome
        const exit3 = candles[i + 3];
        const g3 = isBull ? (exit3.close - cur.close) * pipMult : (cur.close - exit3.close) * pipMult;
        if (g3 > 0) c3Wins++;
        c3GrossPips += g3;
        c3NetPips += (g3 - spread);

        // Max favorable excursion over 3 bars
        const c3Slice = candles.slice(i + 1, i + 4);
        const maxFav = isBull
          ? Math.max(...c3Slice.map(c => c.high - cur.close)) * pipMult
          : Math.max(...c3Slice.map(c => cur.close - c.low)) * pipMult;
        c3MaxPips += maxFav;
      }
    }
  }

  const c1WR = (c1Wins / total * 100).toFixed(1);
  const c3WR = (c3Wins / total * 100).toFixed(1);
  const avgMFE = (c3MaxPips / total).toFixed(1);

  console.log(`${stratName.padEnd(36)}: N=${String(total).padStart(3)} | 1-bar: ${c1WR}% (Net: ${c1NetPips.toFixed(1).padStart(7)}p) | 3-bar: ${c3WR}% (Net: ${c3NetPips.toFixed(1).padStart(7)}p) | Avg 3-bar MFE: +${avgMFE}p`);
}
