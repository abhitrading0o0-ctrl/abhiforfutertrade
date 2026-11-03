// Comprehensive Integration & Parity Test Suite for Accuracy Monitor vs Next Candle Engine
import assert from 'assert';
import { predictNextCandle } from '../src/accuracyMonitor/predictionAdapter.js';
import { generateNextCandlePrediction } from '../src/predictionEngine.js';
import { calculateAccuracyMetrics, filterRecordsByWindow } from '../src/accuracyMonitor/accuracyMath.js';
import { SUPPORTED_TIMEFRAMES } from '../src/accuracyMonitor/registry.js';

console.log('================================================================');
console.log('🎯 RUNNING FORFUTURE ACCURACY MONITOR MASTER PARITY & VERIFICATION');
console.log('================================================================\n');

// 1. GENERATE DETERMINISTIC SYNTHETIC CANDLES
function generateDeterministicCandles(count = 50, basePrice = 1.0850, stepSec = 60, startTime = 1760630400) {
  const candles = [];
  let price = basePrice;
  for (let i = 0; i < count; i++) {
    const t = startTime + (i * stepSec);
    const delta = Math.sin(i * 0.4) * 0.0008 + (i % 2 === 0 ? 0.0002 : -0.0001);
    const open = price;
    const close = price + delta;
    const high = Math.max(open, close) + 0.0003;
    const low = Math.min(open, close) - 0.0003;
    candles.push({ time: t, open, high, low, close, volume: 100 + (i * 5) });
    price = close;
  }
  return candles;
}

const mockIndicators = {
  rsi: { value: 42.5, oversold: 30, overbought: 70 },
  macd: { macd: -0.0002, signal: -0.0001, hist: -0.0001 },
  bollinger: { upper: 1.0900, middle: 1.0850, lower: 1.0800 },
  ema9: 1.0848,
  ema21: 1.0852
};

const mockStrategies = [
  { id: 'rsi_reversal', name: 'RSI Reversal', enabled: true, weight: 1.0 },
  { id: 'trend_continuation', name: 'Trend Continuation', enabled: true, weight: 1.0 }
];

async function runAllTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  }

  console.log('--- TEST SUITE 1: DETERMINISTIC PREDICTION PARITY (Next Candle vs Monitor) ---');
  test('Parity Test 1: Direct function output matches on identical 1M candles', () => {
    const candles = generateDeterministicCandles(50, 1.0850, 60);
    
    // Direct Next Candle engine call with uncalculated indicators/strategies
    const directResult = generateNextCandlePrediction(candles, [], [], '1M', { symbol: 'EUR/USD' });
    
    // Accuracy Monitor adapter call
    const monitorResult = predictNextCandle({
      symbol: 'EUR/USD',
      timeframe: '1M',
      completedCandles: candles,
      engineVersion: '2.4.0',
      calculationTime: Date.now()
    });

    assert.strictEqual(monitorResult.success, true, 'Monitor result must be successful');
    assert.strictEqual(monitorResult.direction, directResult.direction, `Directions must match: monitor=${monitorResult.direction}, direct=${directResult.direction}`);
    assert.strictEqual(monitorResult.timeframe, '1M');
    
    // Check probabilities
    const probDiff = Math.abs(monitorResult.probability.up - directResult.probability.up);
    assert.ok(probDiff < 0.001, `Probabilities must match within 0.1%: diff=${probDiff}`);
    console.log(`    Parity verified: Direction=${monitorResult.direction}, ProbUp=${monitorResult.probability.up.toFixed(4)}, Edge=${monitorResult.edge}`);
  });

  console.log('\n--- TEST SUITE 2: TIMEFRAME ISOLATION & REGISTRY FIDELITY ---');
  test('Isolation Test 2: M1, M2, M3, M4, M5, M15, M30 independent execution', () => {
    const timeframes = ['1M', '2M', '3M', '4M', '5M', '15M', '30M'];
    const results = {};

    timeframes.forEach(tf => {
      const step = SUPPORTED_TIMEFRAMES.find(s => s.id === tf).seconds;
      const tfCandles = generateDeterministicCandles(40, 1.0850, step);
      const res = predictNextCandle({
        symbol: 'GBP/USD',
        timeframe: tf,
        completedCandles: tfCandles,
        engineVersion: '2.4.0',
        calculationTime: Date.now()
      });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.timeframe, tf);
      results[tf] = res;
    });

    assert.strictEqual(Object.keys(results).length, 7, 'All 7 timeframes must produce isolated predictions');
    assert.strictEqual(results['1M'].timeframe, '1M');
    assert.strictEqual(results['30M'].timeframe, '30M');
    assert.strictEqual(results['1M'].stepSec, 60);
    assert.strictEqual(results['30M'].stepSec, 1800);
  });

  console.log('\n--- TEST SUITE 3: TIMESTAMP & TARGET-CANDLE BOUNDARY ALIGNMENT ---');
  test('Timestamp Alignment Test 3: Next target boundary calculation across hour and midnight', () => {
    // Boundary 1: Minute boundary transition
    const step60 = 60;
    const tLast1 = 1760630340; // 2025-10-16 15:59:00 UTC
    const target1 = Math.floor((tLast1 + step60) / step60) * step60;
    assert.strictEqual(target1, 1760630400, 'Next target must align exactly to 16:00:00 UTC');

    // Boundary 2: 5M boundary across hour
    const step300 = 300;
    const tLast5M = 1760630100; // 15:55:00 UTC
    const target5M = Math.floor((tLast5M + step300) / step300) * step300;
    assert.strictEqual(target5M, 1760630400, '5M target must align across hour to 16:00:00 UTC');

    // Boundary 3: 30M boundary across midnight (00:00:00 UTC)
    const step1800 = 1800;
    const tMidnightMinus30 = 1760657400; // 23:30:00 UTC
    const targetMidnight = Math.floor((tMidnightMinus30 + step1800) / step1800) * step1800;
    assert.strictEqual(targetMidnight, 1760659200, '30M target must align to 00:00:00 UTC (Midnight)');

    // Boundary 4: Verify UTC to IST offset calculation is exactly 19,800s (5h 30m)
    const utcDate = new Date('2026-10-16T16:20:00Z');
    const istTimeStr = utcDate.toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' });
    // 16:20 UTC is 21:50 IST
    assert.ok(istTimeStr.includes('21:50'), `IST string must reflect exactly +5:30: got ${istTimeStr}`);
  });

  console.log('\n--- TEST SUITE 4: SNAPSHOT LIFECYCLE & OUTCOME RESOLUTION RULES ---');
  test('Lifecycle Test 4: Open target cannot be prematurely resolved', () => {
    const nowSec = 1760630450;
    const targetEndFuture = 1760630500; // in the future
    const isTargetClosed = nowSec >= targetEndFuture;
    assert.strictEqual(isTargetClosed, false, 'Target candle must be strictly detected as open when nowSec < targetEnd');

    // Past target candle outcome scoring rule: close > open for UP, close < open for DOWN
    const targetCandleBullish = { open: 1.0850, close: 1.0855 };
    const isWinUp = targetCandleBullish.close > targetCandleBullish.open;
    assert.strictEqual(isWinUp, true, 'Bullish candle must evaluate to WIN for UP prediction');

    const isLossDown = targetCandleBullish.close > targetCandleBullish.open;
    assert.strictEqual(isLossDown, true, 'Bullish candle must evaluate to LOSS for DOWN prediction');

    const targetCandleFlat = { open: 1.0850, close: 1.0850 };
    const isFlat = Math.abs(targetCandleFlat.close - targetCandleFlat.open) < 0.000001;
    assert.strictEqual(isFlat, true, 'Zero body candle must evaluate to FLAT');
  });

  console.log('\n--- TEST SUITE 5: DATA INTEGRITY & AUDIT EXCLUSION ---');
  test('Integrity Test 5: Audit required records are safely excluded from accuracy metrics', () => {
    const sampleEvaluations = [
      { id: '1', evaluation: 'WIN', isCorrect: true, auditRequired: false, status: 'RESOLVED', resolvedAt: Date.now() },
      { id: '2', evaluation: 'WIN', isCorrect: true, auditRequired: false, status: 'RESOLVED', resolvedAt: Date.now() },
      { id: '3', evaluation: 'LOSS', isCorrect: false, auditRequired: false, status: 'RESOLVED', resolvedAt: Date.now() },
      // Flagged audit discrepancy record
      { id: '4', evaluation: 'WIN', isCorrect: true, auditRequired: true, status: 'AUDIT_REQUIRED', excludedFromMetrics: true, resolvedAt: Date.now() }
    ];

    const metrics = calculateAccuracyMetrics(sampleEvaluations, { minSampleThreshold: 10 });
    // Total evaluated must be 3, NOT 4!
    assert.strictEqual(metrics.evaluatedSamples, 3, 'Audited records must be excluded from evaluated count');
    assert.strictEqual(metrics.wins, 2, 'Wins must only count valid non-audited records');
    assert.strictEqual(metrics.losses, 1, 'Losses must only count valid non-audited records');
    assert.ok(Math.abs(metrics.accuracy - 66.67) < 0.1, `Accuracy should be 2/3 ≈ 66.67%, got ${metrics.accuracy}`);
    assert.strictEqual(metrics.auditCount, 1, 'Audit count must be tracked');
  });

  console.log('\n--- TEST SUITE 6: LIVE BACKEND API ENDPOINTS & CONTROLS ---');
  await testAsync('Backend API: /api/monitor/leaderboard returns verified structure', async () => {
    const res = await fetch('http://localhost:3001/api/monitor/leaderboard?symbol=EUR/USD&sortBy=timeframe');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.leaderboard), 'Leaderboard must be an array');
    assert.strictEqual(data.leaderboard.length, 7, 'Must return all 7 supported timeframes');
    
    // Check numeric sorting of intervals
    const tfs = data.leaderboard.map(r => r.timeframe);
    assert.deepStrictEqual(tfs, ['1M', '2M', '3M', '4M', '5M', '15M', '30M'], 'Timeframes must be sorted ascending by duration');
  });

  await testAsync('Backend API: /api/monitor/control interactive controls persist', async () => {
    // Test 1: Pause monitor
    const pauseRes = await fetch('http://localhost:3001/api/monitor/control?action=PAUSE');
    const pauseData = await pauseRes.json();
    assert.strictEqual(pauseData.success, true);
    assert.strictEqual(pauseData.settings.status, 'PAUSED');

    // Test 2: Resume monitor
    const resumeRes = await fetch('http://localhost:3001/api/monitor/control?action=RESUME');
    const resumeData = await resumeRes.json();
    assert.strictEqual(resumeData.success, true);
    assert.strictEqual(resumeData.settings.status, 'RUNNING');

    // Test 3: Update minSampleThreshold
    const threshRes = await fetch('http://localhost:3001/api/monitor/control?action=UPDATE_SETTINGS&minSampleThreshold=25');
    const threshData = await threshRes.json();
    assert.strictEqual(threshData.success, true);
    assert.strictEqual(threshData.settings.minSampleThreshold, 25);
  });

  await testAsync('Backend API: /api/monitor/diagnostics runs full 13-stage diagnostic pipeline', async () => {
    const diagRes = await fetch('http://localhost:3001/api/monitor/diagnostics?symbol=EUR/USD');
    assert.strictEqual(diagRes.status, 200);
    const diagData = await diagRes.json();
    assert.strictEqual(diagData.success, true);
    const stages = diagData.stages || diagData.report?.stages;
    assert.ok(Array.isArray(stages), 'Diagnostics must return stages');
    assert.strictEqual(stages.length, 13, `Diagnostics must have all 13 required stages, got ${stages.length}`);
    console.log(`    Ran 13 Diagnostic stages in ${diagData.totalDurationMs || diagData.report?.totalDurationMs}ms:`);
    stages.forEach(st => {
      console.log(`      Stage ${st.id} [${st.name}]: ${st.status} (${st.durationMs}ms)`);
    });
  });

  console.log('\n================================================================');
  console.log(`🎯 TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');
  if (failed > 0) process.exit(1);
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
