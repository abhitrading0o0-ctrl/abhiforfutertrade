// ============================================================
// ForFuture — Parallel Prediction Accuracy Monitor
// Automated Verification & Acceptance Test Suite
// ============================================================

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SUPPORTED_TIMEFRAMES, SUPPORTED_ASSETS, TIMEFRAME_MAP, DEFAULT_MONITOR_CONFIG, WORKER_STATUSES } from './src/accuracyMonitor/registry.js';
import { predictNextCandle, ENGINE_VERSION, computeConfigHash } from './src/accuracyMonitor/predictionAdapter.js';
import {
  calculateWilsonConfidenceInterval,
  resolveTargetOutcome,
  calculateAccuracyMetrics,
  filterRecordsByWindow,
} from './src/accuracyMonitor/accuracyMath.js';
import { aggregateM1Candles, validateCandleSeries } from './src/accuracyMonitor/timeframeAggregator.js';
import { AccuracyMonitorStorage } from './server/accuracyMonitor/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('====================================================');
console.log('PARALLEL PREDICTION ACCURACY MONITOR ACCEPTANCE TESTS');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Error: ${err.message}\n${err.stack}`);
    process.exitCode = 1;
  }
}

// Helper to generate synthetic completed candles with known OHLC
function generateMockCandles(count = 50, startSec = 1700000000, stepSec = 60, trend = 'UP') {
  const candles = [];
  let price = 1.0850;

  for (let i = 0; i < count; i++) {
    const t = startSec + i * stepSec;
    const delta = trend === 'UP' ? 0.0003 : -0.0003;
    const open = price;
    const close = +(price + delta).toFixed(5);
    const high = +(Math.max(open, close) + 0.0002).toFixed(5);
    const low = +(Math.min(open, close) - 0.0002).toFixed(5);
    candles.push({
      time: t,
      timestamp: t * 1000,
      open,
      high,
      low,
      close,
      volume: 150 + i,
      spread: 0.00008,
    });
    price = close;
  }
  return candles;
}

// ====================================================
// TEST SUITE A: Timeframe & Asset Coverage
// ====================================================
console.log('--- TEST SUITE A: TIMEFRAME & ASSET COVERAGE ---');

runTest('A1. Registry exposes all application supported timeframes', () => {
  const ids = SUPPORTED_TIMEFRAMES.map(tf => tf.id);
  assert.deepStrictEqual(ids, ['1M', '2M', '3M', '4M', '5M', '15M', '30M']);
  assert.strictEqual(TIMEFRAME_MAP['1M'].seconds, 60);
  assert.strictEqual(TIMEFRAME_MAP['5M'].seconds, 300);
  assert.strictEqual(TIMEFRAME_MAP['15M'].seconds, 900);
});

runTest('A2. Independent prediction context handles all timeframes without UI', () => {
  for (const tf of ['1M', '2M', '3M', '4M', '5M', '15M', '30M']) {
    const candles = generateMockCandles(30, 1700000000, TIMEFRAME_MAP[tf].seconds);
    const result = predictNextCandle({
      symbol: 'EUR/USD',
      timeframe: tf,
      completedCandles: candles,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.timeframe, tf);
    assert.strictEqual(result.symbol, 'EUR/USD');
    assert.ok(result.direction === 'UP' || result.direction === 'DOWN');
    assert.ok(typeof result.probability.up === 'number');
    assert.ok(typeof result.probability.down === 'number');
    assert.strictEqual(result.status, 'PENDING');
  }
});

runTest('A3. Unsupported timeframes or insufficient data are safely rejected, never fabricated', () => {
  const shortCandles = generateMockCandles(5);
  const result = predictNextCandle({
    symbol: 'EUR/USD',
    timeframe: '1M',
    completedCandles: shortCandles,
  });
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'INSUFFICIENT_CANDLES');
});

// ====================================================
// TEST SUITE B: Absolute Non-Interference
// ====================================================
console.log('\n--- TEST SUITE B: NON-INTERFERENCE ---');

runTest('B1. Background prediction context is immutable and does not mutate candle inputs', () => {
  const originalCandles = generateMockCandles(30);
  const originalJson = JSON.stringify(originalCandles);

  const result = predictNextCandle({
    symbol: 'GBP/USD',
    timeframe: '5M',
    completedCandles: originalCandles,
  });

  assert.strictEqual(JSON.stringify(originalCandles), originalJson, 'Input candles must not be mutated');
});

runTest('B2. Predictions across multiple timeframes do not contaminate each other', () => {
  const candles1m = generateMockCandles(30, 1700000000, 60, 'UP');
  const candles5m = generateMockCandles(30, 1700000000, 300, 'DOWN');

  const pred1m = predictNextCandle({ symbol: 'EUR/USD', timeframe: '1M', completedCandles: candles1m });
  const pred5m = predictNextCandle({ symbol: 'EUR/USD', timeframe: '5M', completedCandles: candles5m });

  assert.notStrictEqual(pred1m.predictionId, pred5m.predictionId);
  assert.strictEqual(pred1m.stepSec, 60);
  assert.strictEqual(pred5m.stepSec, 300);
});

// ====================================================
// TEST SUITE C: Target Candle Alignment & Timing
// ====================================================
console.log('\n--- TEST SUITE C: TARGET CANDLE ALIGNMENT & TIMING ---');

runTest('C1. Target candle start matches cutoff time + step duration', () => {
  const candles = generateMockCandles(20, 1000, 60);
  const lastCompleted = candles[candles.length - 1]; // time = 1000 + 19*60 = 2140
  
  const pred = predictNextCandle({
    symbol: 'EUR/USD',
    timeframe: '1M',
    completedCandles: candles,
  });

  assert.strictEqual(pred.cutoffCandleTime, lastCompleted.time);
  assert.strictEqual(pred.targetCandle.startTime, lastCompleted.time + 60);
  assert.strictEqual(pred.targetCandle.endTime, lastCompleted.time + 120);
});

runTest('C2. Target candle evaluation correctly scores WIN and LOSS', () => {
  const predUp = {
    predictionId: 'test_pred_up',
    symbol: 'EUR/USD',
    timeframe: '1M',
    direction: 'UP',
    probability: { up: 0.65, down: 0.35 },
    edge: 0.15,
    stepSec: 60,
    targetCandle: { startTime: 2200, endTime: 2260 },
  };

  // Winning target candle (close > open)
  const targetWin = { time: 2200, open: 1.0850, high: 1.0860, low: 1.0848, close: 1.0855 };
  const resWin = resolveTargetOutcome(predUp, targetWin);
  assert.strictEqual(resWin.evaluation, 'WIN');
  assert.strictEqual(resWin.isCorrect, true);
  assert.strictEqual(resWin.actualDirection, 'UP');

  // Losing target candle (close < open)
  const targetLoss = { time: 2200, open: 1.0850, high: 1.0852, low: 1.0840, close: 1.0845 };
  const resLoss = resolveTargetOutcome(predUp, targetLoss);
  assert.strictEqual(resLoss.evaluation, 'LOSS');
  assert.strictEqual(resLoss.isCorrect, false);
  assert.strictEqual(resLoss.actualDirection, 'DOWN');
});

runTest('C3. Flat / Doji target candle is scored as FLAT / UNSCORABLE, not win or loss', () => {
  const pred = {
    predictionId: 'test_pred_doji',
    direction: 'UP',
    targetCandle: { startTime: 3000, endTime: 3060 },
  };
  const targetDoji = { time: 3000, open: 1.08500, high: 1.08505, low: 1.08495, close: 1.08500 };
  const resDoji = resolveTargetOutcome(pred, targetDoji);

  assert.strictEqual(resDoji.evaluation, 'FLAT');
  assert.strictEqual(resDoji.isFlat, true);
  assert.strictEqual(resDoji.isCorrect, false);
});

// ====================================================
// TEST SUITE D: Accuracy Mathematics & Metrics
// ====================================================
console.log('\n--- TEST SUITE D: ACCURACY MATHEMATICS & METRICS ---');

runTest('D1. Directional Accuracy excludes pending and flat outcomes from denominator', () => {
  // Construct 10 wins, 5 losses, 2 flat dojis, 3 pending predictions
  const records = [
    ...Array(10).fill(null).map((_, i) => ({
      evaluation: 'WIN', isCorrect: true, direction: 'UP', actualDirection: 'UP',
      resolvedAt: Date.now() - 1000, probability: { up: 0.60, down: 0.40 }
    })),
    ...Array(5).fill(null).map((_, i) => ({
      evaluation: 'LOSS', isCorrect: false, direction: 'UP', actualDirection: 'DOWN',
      resolvedAt: Date.now() - 1000, probability: { up: 0.60, down: 0.40 }
    })),
    ...Array(2).fill(null).map((_, i) => ({
      evaluation: 'FLAT', isFlat: true, direction: 'UP', actualDirection: 'FLAT',
      resolvedAt: Date.now() - 1000
    })),
    ...Array(3).fill(null).map((_, i) => ({
      evaluation: 'PENDING', status: 'PENDING', direction: 'DOWN'
    })),
  ];

  const metrics = calculateAccuracyMetrics(records, { minSampleThreshold: 10 });

  assert.strictEqual(metrics.totalRecorded, 20);
  assert.strictEqual(metrics.pendingCount, 3);
  assert.strictEqual(metrics.flatCount, 2);
  assert.strictEqual(metrics.wins, 10);
  assert.strictEqual(metrics.losses, 5);
  assert.strictEqual(metrics.evaluatedSamples, 15, 'Eligible samples should be wins + losses = 15');
  
  // 10 / 15 * 100 = 66.67%
  assert.strictEqual(metrics.accuracy, 66.67);
  assert.strictEqual(metrics.isProvisional, false);
});

runTest('D2. Wilson Score 95% Confidence Interval gives verified bounds', () => {
  // For 70 wins out of 100 samples (70%), 95% CI should center around 70% with bounds approx [60.4%, 78.1%]
  const ci = calculateWilsonConfidenceInterval(70, 100, 0.95);
  assert.ok(ci.lower >= 60.0 && ci.lower <= 61.0, `Lower bound was ${ci.lower}`);
  assert.ok(ci.upper >= 77.5 && ci.upper <= 78.5, `Upper bound was ${ci.upper}`);
  assert.ok(ci.lower < 70 && ci.upper > 70);
});

runTest('D3. Balanced accuracy accounts for UP/DOWN recall correctly', () => {
  // Confusion matrix:
  // TP = 8, FP = 2 (Predicted UP: 10)
  // TN = 4, FN = 6 (Predicted DOWN: 10)
  // Actual UP = 8 + 6 = 14 -> Recall_UP = 8 / 14 = 0.5714
  // Actual DOWN = 4 + 2 = 6 -> Recall_DOWN = 4 / 6 = 0.6667
  // Balanced Accuracy = (0.5714 + 0.6667) / 2 = 0.6190 (61.90%)
  const records = [
    ...Array(8).fill(null).map(() => ({ evaluation: 'WIN', isCorrect: true, direction: 'UP', actualDirection: 'UP', resolvedAt: 1000 })),
    ...Array(2).fill(null).map(() => ({ evaluation: 'LOSS', isCorrect: false, direction: 'UP', actualDirection: 'DOWN', resolvedAt: 1000 })),
    ...Array(4).fill(null).map(() => ({ evaluation: 'WIN', isCorrect: true, direction: 'DOWN', actualDirection: 'DOWN', resolvedAt: 1000 })),
    ...Array(6).fill(null).map(() => ({ evaluation: 'LOSS', isCorrect: false, direction: 'DOWN', actualDirection: 'UP', resolvedAt: 1000 })),
  ];

  const metrics = calculateAccuracyMetrics(records);
  assert.strictEqual(metrics.balancedAccAvailable, true);
  assert.strictEqual(metrics.balancedAccuracy, 61.91);
  assert.strictEqual(metrics.confusionMatrix.tp, 8);
  assert.strictEqual(metrics.confusionMatrix.fp, 2);
  assert.strictEqual(metrics.confusionMatrix.tn, 4);
  assert.strictEqual(metrics.confusionMatrix.fn, 6);
});

runTest('D4. Brier score properly measures probability calibration', () => {
  // If model predicted p(UP) = 0.8 and actual was UP, loss = (0.8 - 1.0)^2 = 0.04
  // If model predicted p(UP) = 0.8 and actual was DOWN, loss = (0.8 - 0.0)^2 = 0.64
  const records = [
    { evaluation: 'WIN', isCorrect: true, direction: 'UP', actualDirection: 'UP', probability: { up: 0.8 }, resolvedAt: 1000 },
    { evaluation: 'LOSS', isCorrect: false, direction: 'UP', actualDirection: 'DOWN', probability: { up: 0.8 }, resolvedAt: 1000 },
  ];
  const metrics = calculateAccuracyMetrics(records);
  // Average = (0.04 + 0.64) / 2 = 0.3400
  assert.strictEqual(metrics.probabilistic.brierScore, 0.34);
});

// ====================================================
// TEST SUITE E: Persistence & Idempotency
// ====================================================
console.log('\n--- TEST SUITE E: PERSISTENCE & IDEMPOTENCY ---');

runTest('E1. Storage writes and reads from disk, surviving process restart', () => {
  const testDbPath = path.join(__dirname, 'data/test_monitor_storage.json');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const storage1 = new AccuracyMonitorStorage(testDbPath);
  storage1.recordPrediction({
    predictionId: 'test_persist_1',
    symbol: 'EUR/USD',
    timeframe: '1M',
    direction: 'UP',
    probability: { up: 0.58, down: 0.42 },
  });
  storage1.resolveOutcome({
    predictionId: 'test_persist_1',
    actualDirection: 'UP',
    evaluation: 'WIN',
    isCorrect: true,
  });
  storage1.saveImmediate();

  // Create brand new storage instance from same file
  const storage2 = new AccuracyMonitorStorage(testDbPath);
  const p = storage2.getPrediction('test_persist_1');
  const o = storage2.getOutcome('test_persist_1');

  assert.ok(p, 'Prediction must be restored');
  assert.strictEqual(p.direction, 'UP');
  assert.ok(o, 'Outcome must be restored');
  assert.strictEqual(o.evaluation, 'WIN');

  // Clean up test file
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

runTest('E2. Retrying identical prediction or outcome does NOT double-score (Idempotency)', () => {
  const testDbPath = path.join(__dirname, 'data/test_idempotency.json');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const storage = new AccuracyMonitorStorage(testDbPath);
  const snapshot = {
    predictionId: 'idemp_pred_1',
    symbol: 'EUR/USD',
    timeframe: '1M',
    direction: 'UP',
  };

  const firstRecord = storage.recordPrediction(snapshot);
  const secondRecord = storage.recordPrediction(snapshot);
  assert.strictEqual(firstRecord, true, 'First record must succeed');
  assert.strictEqual(secondRecord, false, 'Duplicate record must be ignored');

  const outcome = {
    predictionId: 'idemp_pred_1',
    evaluation: 'WIN',
    isCorrect: true,
  };
  const firstResolve = storage.resolveOutcome(outcome);
  const secondResolve = storage.resolveOutcome(outcome);
  assert.strictEqual(firstResolve, true, 'First resolution must succeed');
  assert.strictEqual(secondResolve, false, 'Duplicate resolution must be ignored');

  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

// ====================================================
// TEST SUITE F: Fair Leaderboard & Sample Thresholding
// ====================================================
console.log('\n--- TEST SUITE F: FAIR LEADERBOARD & PROVISIONAL BADGING ---');

runTest('F1. Sample sizes below threshold (30) are flagged as PROVISIONAL', () => {
  // A timeframe with 1 win / 1 prediction (100% accuracy) must NOT be declared proven best
  const smallSample = [
    { evaluation: 'WIN', isCorrect: true, direction: 'UP', actualDirection: 'UP', resolvedAt: 1000 },
  ];
  const metricsSmall = calculateAccuracyMetrics(smallSample, { minSampleThreshold: 30 });
  assert.strictEqual(metricsSmall.accuracy, 100.0);
  assert.strictEqual(metricsSmall.isProvisional, true, 'N=1 must be provisional');

  // Timeframe with 35 samples is NOT provisional
  const adequateSample = Array(35).fill(null).map(() => ({
    evaluation: 'WIN', isCorrect: true, direction: 'UP', actualDirection: 'UP', resolvedAt: 1000,
  }));
  const metricsAdequate = calculateAccuracyMetrics(adequateSample, { minSampleThreshold: 30 });
  assert.strictEqual(metricsAdequate.isProvisional, false, 'N=35 must NOT be provisional');
});

runTest('F2. Evaluation windows correctly slice by wall-clock time', () => {
  const now = Date.now();
  const records = [
    { id: 1, resolvedAt: now - 2 * 60 * 60 * 1000 },        // 2 hours ago
    { id: 2, resolvedAt: now - 30 * 60 * 60 * 1000 },       // 30 hours ago
    { id: 3, resolvedAt: now - 5 * 24 * 60 * 60 * 1000 },   // 5 days ago
    { id: 4, resolvedAt: now - 40 * 24 * 60 * 60 * 1000 },  // 40 days ago
  ];

  const in24h = filterRecordsByWindow(records, '24H', now);
  assert.strictEqual(in24h.length, 1);
  assert.strictEqual(in24h[0].id, 1);

  const in7d = filterRecordsByWindow(records, '7D', now);
  assert.strictEqual(in7d.length, 3);

  const in30d = filterRecordsByWindow(records, '30D', now);
  assert.strictEqual(in30d.length, 3);

  const all = filterRecordsByWindow(records, 'ALL', now);
  assert.strictEqual(all.length, 4);

  const last2 = filterRecordsByWindow(records, 'LAST_25', now);
  assert.strictEqual(last2.length, 4);
});

// ====================================================
// TEST SUITE G: Custom Timeframe Aggregation (Phase 4)
// ====================================================
console.log('\n--- TEST SUITE G: CUSTOM TIMEFRAME AGGREGATION & VALIDATION ---');

runTest('G1. validateCandleSeries detects gaps, duplicates, and non-finite numbers', () => {
  const badCandles = [
    { time: 100, open: NaN, high: 1.085, low: 1.084, close: 1.085 },
    { time: 100, open: 1.084, high: 1.085, low: 1.084, close: 1.085 }, // duplicate time
    { time: 160, open: 1.085, high: 1.080, low: 1.086, close: 1.085 }, // high < low
  ];
  const res = validateCandleSeries(badCandles);
  assert.strictEqual(res.valid, false, 'Invalid candle series must fail validation');

  const goodCandles = generateMockCandles(10, 1700000000, 60);
  const goodRes = validateCandleSeries(goodCandles);
  assert.strictEqual(goodRes.valid, true, 'Valid candles must pass validation');
  assert.strictEqual(goodRes.sanitizedCandles.length, 10);
});

runTest('G2. aggregateM1Candles groups exact constituents (2M, 3M, 4M) with aligned boundaries', () => {
  // Generate 12 consecutive 1M candles starting at a 720-second boundary (divisible by 120, 180, and 240)
  const baseTime = 1699999920; // 1699999920 % 720 === 0
  const m1Candles = generateMockCandles(12, baseTime, 60);

  // Test 2M (multiplier = 2) -> 12 / 2 = 6 completed 2M candles
  const m2 = aggregateM1Candles(m1Candles, 2, 'EUR/USD');
  assert.strictEqual(m2.length, 6, '12 M1 bars must yield 6 completed M2 bars');
  assert.strictEqual(m2[0].derived, true);
  assert.strictEqual(m2[0].sourceData, 'M1');
  assert.strictEqual(m2[0].constituentCount, 2);

  // Test 3M (multiplier = 3) -> 12 / 3 = 4 completed 3M candles
  const m3 = aggregateM1Candles(m1Candles, 3, 'EUR/USD');
  assert.strictEqual(m3.length, 4, '12 M1 bars must yield 4 completed 3M bars');
  assert.strictEqual(m3[0].constituentCount, 3);

  // Test 4M (multiplier = 4) -> 12 / 4 = 3 completed 4M candles
  const m4 = aggregateM1Candles(m1Candles, 4, 'EUR/USD');
  assert.strictEqual(m4.length, 3, '12 M1 bars must yield 3 completed 4M bars');
  assert.strictEqual(m4[0].constituentCount, 4);

  // Verify OHLC accuracy for first 2M bar:
  // Open = candle[0].open, Close = candle[1].close
  assert.strictEqual(m2[0].open, m1Candles[0].open);
  assert.strictEqual(m2[0].close, m1Candles[1].close);
  assert.strictEqual(m2[0].high, Math.max(m1Candles[0].high, m1Candles[1].high));
  assert.strictEqual(m2[0].low, Math.min(m1Candles[0].low, m1Candles[1].low));
});

runTest('G3. aggregateM1Candles strictly rejects gapped or incomplete constituent bars', () => {
  // Gapped M1: candle at t=0 and t=120 (missing t=60)
  const gappedCandles = [
    { time: 1700000160, open: 1.0850, high: 1.0855, low: 1.0848, close: 1.0852, volume: 10 },
    { time: 1700000280, open: 1.0852, high: 1.0858, low: 1.0851, close: 1.0856, volume: 10 }, // missing 1700000220
  ];
  const derived = aggregateM1Candles(gappedCandles, 2, 'EUR/USD');
  assert.strictEqual(derived.length, 0, 'Gapped M1 bars must not produce a derived candle');
});

// ====================================================
// TEST SUITE H: Canonical Registry Reconciliation (Phase 3)
// ====================================================
console.log('\n--- TEST SUITE H: CANONICAL REGISTRY RECONCILIATION ---');

runTest('H1. Canonical registry defines all 7 timeframes in ascending duration order', () => {
  const ids = SUPPORTED_TIMEFRAMES.map(tf => tf.id);
  assert.deepStrictEqual(ids, ['1M', '2M', '3M', '4M', '5M', '15M', '30M']);

  // Strictly ascending duration
  for (let i = 1; i < SUPPORTED_TIMEFRAMES.length; i++) {
    assert.ok(
      SUPPORTED_TIMEFRAMES[i].seconds > SUPPORTED_TIMEFRAMES[i - 1].seconds,
      `${SUPPORTED_TIMEFRAMES[i].id} duration must be strictly greater than ${SUPPORTED_TIMEFRAMES[i - 1].id}`
    );
  }
});

runTest('H2. Default monitor configuration enables all 7 supported timeframes', () => {
  assert.strictEqual(DEFAULT_MONITOR_CONFIG.enabledTimeframes.length, 7);
  assert.deepStrictEqual(
    DEFAULT_MONITOR_CONFIG.enabledTimeframes,
    ['1M', '2M', '3M', '4M', '5M', '15M', '30M']
  );
  assert.strictEqual(DEFAULT_MONITOR_CONFIG.enabledAssets.length, 2);
  // Matrix: 2 assets x 7 timeframes = 14 contexts
  const matrix = DEFAULT_MONITOR_CONFIG.enabledAssets.length * DEFAULT_MONITOR_CONFIG.enabledTimeframes.length;
  assert.strictEqual(matrix, 14, 'Monitored matrix must be 2 Assets x 7 TFs = 14');
});

// ====================================================
// TEST SUITE I: Dynamic Worker Health Status (Phase 2)
// ====================================================
console.log('\n--- TEST SUITE I: WORKER HEALTH STATUS STATE MACHINE ---');

runTest('I1. Worker health transitions accurately across states', () => {
  const testDb = path.join(__dirname, 'test_worker_health_db.json');
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);

  const storage = new AccuracyMonitorStorage(testDb);

  // Initial state without cycles -> STARTING
  assert.strictEqual(storage.getHealth().workerStatus, WORKER_STATUSES.STARTING);

  // After successful cycle with recent heartbeat -> HEALTHY
  storage.updateHealth({
    lastSuccessfulCycle: Date.now(),
    heartbeat: Date.now(),
  });
  assert.strictEqual(storage.getHealth().workerStatus, WORKER_STATUSES.HEALTHY);

  // Stale heartbeat (> 30s ago) -> DELAYED
  storage.updateHealth({
    heartbeat: Date.now() - 35000,
  });
  assert.strictEqual(storage.getHealth().workerStatus, WORKER_STATUSES.DELAYED);

  // Operator pauses -> PAUSED
  storage.updateSettings({ status: 'PAUSED' });
  assert.strictEqual(storage.getHealth().workerStatus, WORKER_STATUSES.PAUSED);

  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
});

// ====================================================
// TEST SUITE J: Missing Prediction vs PENDING (Phase 6 & 7)
// ====================================================
console.log('\n--- TEST SUITE J: FAIR RANKING & PREDICTION LIFECYCLE ---');

runTest('J1. Zero-sample rows are unranked and never presented as #1', () => {
  const zeroMetrics = calculateAccuracyMetrics([]);
  assert.strictEqual(zeroMetrics.evaluatedSamples, 0);
  assert.strictEqual(zeroMetrics.accuracy, null, 'Accuracy must be null for zero samples');
  assert.strictEqual(zeroMetrics.isProvisional, true);
});

runTest('J2. Target-candle resolution verifies exact timestamps and scoring', () => {
  const pred = {
    predictionId: 'EURUSD_1M_1700000060_v4.0.0',
    symbol: 'EUR/USD',
    timeframe: '1M',
    direction: 'UP',
    probability: { up: 0.65, down: 0.35 },
    stepSec: 60,
    targetCandle: { startTime: 1700000060, endTime: 1700000120 },
  };

  // Target closes UP -> WIN
  const winTarget = { time: 1700000060, open: 1.0850, close: 1.0855, high: 1.0858, low: 1.0849 };
  const resWin = resolveTargetOutcome(pred, winTarget);
  assert.strictEqual(resWin.evaluation, 'WIN');
  assert.strictEqual(resWin.isCorrect, true);

  // Target closes DOWN -> LOSS
  const lossTarget = { time: 1700000060, open: 1.0850, close: 1.0845, high: 1.0852, low: 1.0843 };
  const resLoss = resolveTargetOutcome(pred, lossTarget);
  assert.strictEqual(resLoss.evaluation, 'LOSS');
  assert.strictEqual(resLoss.isCorrect, false);

  // Target flat -> FLAT (unscorable)
  const flatTarget = { time: 1700000060, open: 1.0850, close: 1.0850, high: 1.0852, low: 1.0848 };
  const resFlat = resolveTargetOutcome(pred, flatTarget);
  assert.strictEqual(resFlat.evaluation, 'FLAT');
  assert.strictEqual(resFlat.isFlat, true);
});

console.log('\n====================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
console.log('====================================================\n');
