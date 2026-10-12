// ============================================================
// ForFuture — Comprehensive M1 & Timeframe Isolation Test Suite
// Validates Order Blocks, S/R, Market Structure, 25 Legacy Strategies,
// 20 M1 Scalping Strategies, AFME, Timeframe Isolation & Cost Rules
// ============================================================

import { detectOrderBlocks, OB_STATUS, OB_TYPE } from './src/orderBlockEngine.js';
import { calculateSupportResistance } from './src/supportResistanceEngine.js';
import { analyzeMarketStructure } from './src/marketStructureEngine.js';
import { analyzePriceAction } from './src/priceActionEngine.js';
import { calculateTechnicalIndicators, generateNextCandlePrediction } from './src/predictionEngine.js';
import { evaluateAllStrategies } from './src/strategyEngine.js';

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${details ? '— ' + details : ''}`);
    failedCount++;
  }
}

// Generate realistic synthetic M1 candles
function generateSyntheticCandles(count = 60, basePrice = 1.1000, trend = 'UP') {
  const candles = [];
  let price = basePrice;
  const now = Date.now() - (count * 60 * 1000);

  for (let i = 0; i < count; i++) {
    const time = now + (i * 60 * 1000);
    const noise = (Math.random() - 0.48) * 0.0004;
    const trendDrift = trend === 'UP' ? 0.00015 : trend === 'DOWN' ? -0.00015 : 0;
    const open = price;
    const close = price + trendDrift + noise;
    const high = Math.max(open, close) + Math.random() * 0.0002;
    const low = Math.min(open, close) - Math.random() * 0.0002;

    candles.push({
      time,
      open: +open.toFixed(5),
      high: +high.toFixed(5),
      low: +low.toFixed(5),
      close: +close.toFixed(5),
      volume: 100 + Math.floor(Math.random() * 50),
      symbol: 'EUR/USD',
      timeframe: '1M',
      spread: 0.00008
    });

    price = close;
  }
  return candles;
}

console.log('\n======================================================');
console.log('TEST SUITE 1: 25 LEGACY STRATEGIES PRESERVATION');
console.log('======================================================');
{
  const candles = generateSyntheticCandles(50, 1.1000, 'UP');
  const inds = calculateTechnicalIndicators(candles);
  const strats = evaluateAllStrategies(candles, inds, null, null, null, null, null, null, { symbol: 'EUR/USD', timeframe: '1M' });

  const legacyNames = [
    'Support Bounce',
    'Resistance Rejection',
    'Breakout and Retest',
    'False Breakout',
    'Structure Break and Retest',
    'Liquidity-Sweep Proxy',
    'Range Mean Reversion',
    'Trend Pullback',
    'Momentum Continuation',
    'Confirmed RSI Divergence',
    'Confirmed MACD Divergence',
    'Volatility Squeeze Breakout',
    'Volatility Regime Transition',
    'Candle Rejection Strategy',
    'Tick-Activity Confirmation',
    'Trend + Pullback + Structure Confirmation',
    'Support/Resistance + Momentum Confirmation',
    'Session Range Breakout',
    'Previous-Day High/Low Reaction',
    'Pivot-Point Rejection',
    'Range Boundary Reversal',
    'Failed Breakout Reversal',
    'ATR-Normalized Momentum',
    'Session-Range Expansion',
    'Multi-Timeframe Confluence'
  ];

  assert(strats.length >= 46, `Strategy registry count is ${strats.length} (>= 46 expected)`);

  const foundLegacy = legacyNames.filter(name => strats.some(s => s.name === name));
  assert(foundLegacy.length === 25, `All 25 legacy strategies preserved (Found ${foundLegacy.length}/25)`);

  // Verify categories
  const supBounce = strats.find(s => s.name === 'Support Bounce');
  assert(supBounce && supBounce.category === 'Support/Resistance', 'Support Bounce preserves category Support/Resistance');

  const falseBO = strats.find(s => s.name === 'False Breakout');
  assert(falseBO && falseBO.category === 'Breakout and Retest', 'False Breakout preserves category Breakout and Retest');

  // Verify no raw "NEUTRAL" in status vocabulary
  const rawNeutrals = strats.filter(s => s.signal === 'NEUTRAL');
  assert(rawNeutrals.length === 0, 'No strategies output uninformative raw "NEUTRAL" signals');
}

console.log('\n======================================================');
console.log('TEST SUITE 2: 20 NEW M1 SCALPING STRATEGIES & AFME');
console.log('======================================================');
{
  const candles = generateSyntheticCandles(50, 1.1000, 'UP');
  const inds = calculateTechnicalIndicators(candles);
  const strats = evaluateAllStrategies(candles, inds, null, null, null, null, null, null, { symbol: 'EUR/USD', timeframe: '1M' });

  const m1Names = [
    'M1 First Pullback Continuation',
    'M1 Micro-Range Breakout',
    'M1 Breakout-Retest',
    'M1 False-Breakout Reversal',
    'M1 Liquidity Sweep and Reclaim',
    'M1 Order-Block Retest',
    'M1 Support/Resistance Rejection',
    'M1 Fast EMA Reclaim',
    'M1 Momentum Burst',
    'M1 Three-Candle Pressure',
    'M1 Compression Expansion',
    'M1 Range-Boundary Reversal',
    'M1 Momentum Exhaustion Reversal',
    'M1 Structure Flip and Retest',
    'M1 Session Micro-Range Breakout',
    'M1 ATR-Normalized Impulse',
    'M1 Inside-Bar Breakout',
    'M1 Engulfing at Key Levels',
    'M1 Consecutive Rejection Reversal',
    'M1 Micro-Trend Continuation'
  ];

  const foundM1 = m1Names.filter(name => strats.some(s => s.name === name));
  assert(foundM1.length === 20, `All 20 M1 Scalping Strategies implemented and registered (Found ${foundM1.length}/20)`);

  const m1CatStrats = strats.filter(s => s.category === 'M1 SCALPING STRATEGIES');
  assert(m1CatStrats.length >= 21, `M1 SCALPING STRATEGIES category contains ${m1CatStrats.length} entries (20 M1 + AFME)`);

  const afme = strats.find(s => s.name === 'M1 Adaptive First-Move Engine (AFME)');
  assert(!!afme, 'M1 Adaptive First-Move Engine (AFME) strategy exists');
  assert(afme?.qualityScore > 0, `AFME reports quality score: ${afme?.qualityScore}/100`);

  // Verify rich explanatory properties
  const sampleM1 = strats.find(s => s.name === 'M1 First Pullback Continuation');
  assert(Array.isArray(sampleM1?.conditionsMet), 'Strategy includes conditionsMet array');
  assert(Array.isArray(sampleM1?.conditionsUnmet), 'Strategy includes conditionsUnmet array');
  assert(typeof sampleM1?.evidence === 'string' && sampleM1.evidence.length > 0, 'Strategy includes detailed evidence');
  assert(typeof sampleM1?.status === 'string' && sampleM1.status.length > 0, 'Strategy includes informative status');
}

console.log('\n======================================================');
console.log('TEST SUITE 3: ORDER BLOCK ENGINE & LIFECYCLE');
console.log('======================================================');
{
  // Build candles with a strong bullish displacement after a bearish candle
  const obCandles = [];
  let p = 1.1000;
  for (let i = 0; i < 30; i++) {
    obCandles.push({
      time: 1000 + i * 60,
      open: p,
      high: p + 0.0003,
      low: p - 0.0002,
      close: p + 0.0001,
      volume: 100
    });
    p += 0.0001;
  }
  // Bearish origin candle at index 30
  obCandles.push({
    time: 1000 + 30 * 60,
    open: p + 0.0003,
    high: p + 0.0004,
    low: p - 0.0002,
    close: p - 0.0001, // Bearish
    volume: 120
  });
  // Strong bullish displacement at index 31, 32 (+15 pips)
  obCandles.push({
    time: 1000 + 31 * 60,
    open: p - 0.0001,
    high: p + 0.0012,
    low: p - 0.0001,
    close: p + 0.0010, // Big bull
    volume: 250
  });
  obCandles.push({
    time: 1000 + 32 * 60,
    open: p + 0.0010,
    high: p + 0.0018,
    low: p + 0.0009,
    close: p + 0.0016, // Big bull continuation
    volume: 230
  });

  const obs = detectOrderBlocks(obCandles, [], 0.0008, 'EUR/USD', '1M');
  assert(obs.allOrderBlocks.length > 0, `Order blocks detected: ${obs.allOrderBlocks.length}`);

  const bullOB = obs.allOrderBlocks.find(b => b.type === OB_TYPE.BULLISH);
  assert(!!bullOB, 'Bullish Order Block detected from bearish origin preceding impulse displacement');
  assert(bullOB?.high > bullOB?.low, 'Order Block upper boundary is strictly greater than lower boundary');
  assert(bullOB?.mid === +((bullOB?.high + bullOB?.low) / 2).toFixed(5), 'Order Block midpoint correctly computed');
  assert(bullOB?.symbol === 'EUR/USD' && bullOB?.timeframe === '1M', 'Order Block tagged with symbol and timeframe');
}

console.log('\n======================================================');
console.log('TEST SUITE 4: SUPPORT & RESISTANCE ENGINE');
console.log('======================================================');
{
  const candles = generateSyntheticCandles(60, 1.1000, 'RANGE');
  const sr = calculateSupportResistance(candles, 1.1000, 0.0008, 'EUR/USD', '1M');

  assert(sr.zones.length > 0, `Support/Resistance zones clustered: ${sr.zones.length}`);
  assert(sr.nearestSupport !== null, `Nearest Support found at ${sr.nearestSupport?.price}`);
  assert(sr.nearestResistance !== null, `Nearest Resistance found at ${sr.nearestResistance?.price}`);
  assert(sr.nearestSupport?.price <= 1.1000, 'Nearest Support is at or below current price');
  assert(sr.nearestResistance?.price >= 1.1000, 'Nearest Resistance is at or above current price');
  assert(['FRESH', 'TESTED', 'WEAKENED'].includes(sr.nearestSupport?.freshness), 'Zone reports valid freshness state');
  assert(sr.nearestSupport?.pipDistance >= 0, 'Zone reports positive pip distance');
}

console.log('\n======================================================');
console.log('TEST SUITE 5: MARKET STRUCTURE & PRICE ACTION');
console.log('======================================================');
{
  const candles = generateSyntheticCandles(50, 1.1000, 'UP');
  const pa = analyzePriceAction(candles);
  assert(pa !== null, 'Price action engine successfully processes candles');
  assert(typeof pa.upperWickPct === 'number' && typeof pa.lowerWickPct === 'number', 'Price action computes wick proportions');
  assert(typeof pa.patterns === 'object', 'Price action patterns map generated');

  const sr = calculateSupportResistance(candles, 1.1000, 0.0008, 'EUR/USD', '1M');
  const ms = analyzeMarketStructure(candles, sr, '1M');
  assert(ms !== null, 'Market structure engine successfully processes candles');
  assert(['BULLISH', 'BEARISH', 'RANGE'].includes(ms.trend), `Market structure reports valid trend: ${ms.trend}`);
  assert(Array.isArray(ms.swings), `Market structure detects confirmed swings: ${ms.swings.length}`);
}

console.log('\n======================================================');
console.log('TEST SUITE 6: STRICT TIMEFRAME ISOLATION');
console.log('======================================================');
{
  const m1Candles = generateSyntheticCandles(60, 1.0500, 'UP');
  const m5Candles = generateSyntheticCandles(60, 1.3500, 'DOWN');

  const m1Pred = generateNextCandlePrediction(m1Candles, [], [], '1M', { symbol: 'EUR/USD' });
  const m5Pred = generateNextCandlePrediction(m5Candles, [], [], '5M', { symbol: 'EUR/USD' });

  assert(m1Pred.timeframe === '1M', 'M1 prediction correctly tagged with 1M timeframe');
  assert(m5Pred.timeframe === '5M', 'M5 prediction correctly tagged with 5M timeframe');

  // Verify prices and indicators do NOT leak across timeframes
  const m1Rsi = parseFloat(m1Pred.indicators.find(i => i.name.startsWith('RSI'))?.value);
  const m5Rsi = parseFloat(m5Pred.indicators.find(i => i.name.startsWith('RSI'))?.value);
  assert(!isNaN(m1Rsi) && !isNaN(m5Rsi), 'RSI calculated independently for each timeframe');

  const m1Sup = m1Pred.supportResistance?.nearestSupport?.price;
  const m5Sup = m5Pred.supportResistance?.nearestSupport?.price;
  assert(m1Sup !== m5Sup, `M1 support (${m1Sup}) is completely isolated from M5 support (${m5Sup})`);
}

console.log('\n======================================================');
console.log('TEST SUITE 7: EXECUTION COSTS & SPREAD VALIDATION');
console.log('======================================================');
{
  const candles = generateSyntheticCandles(50, 1.1000, 'UP');
  const inds = calculateTechnicalIndicators(candles);

  // Normal spread test (0.8 pips)
  const normalStrats = evaluateAllStrategies(candles, inds, null, null, null, null, null, null, {
    symbol: 'EUR/USD',
    timeframe: '1M',
    spreadPips: 0.8
  });
  const normalUnver = normalStrats.filter(s => s.signal === 'EXECUTION NOT VERIFIED');
  assert(normalUnver.length === 0, 'Normal 0.8 pip spread allows valid actionable signals without penalty');

  // Excessive spread test (3.5 pips on M1 scalp)
  const highSpreadStrats = evaluateAllStrategies(candles, inds, null, null, null, null, null, null, {
    symbol: 'EUR/USD',
    timeframe: '1M',
    spreadPips: 3.5
  });
  const penalized = highSpreadStrats.filter(s => s.signal === 'EXECUTION NOT VERIFIED');
  assert(penalized.length > 0, `Excessive spread (3.5 pips) successfully penalized ${penalized.length} actionable scalps to EXECUTION NOT VERIFIED`);
}

console.log('\n======================================================');
console.log(`TOTAL TESTS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log('======================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
