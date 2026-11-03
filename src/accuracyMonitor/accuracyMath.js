// ============================================================
// ForFuture — Parallel Prediction Accuracy Monitor
// Accuracy Mathematics & Statistical Metrics Engine
// Implements verified metrics, confidence intervals, and baselines.
// ============================================================

/**
 * Wilson score interval for a binomial proportion at 95% confidence.
 * Provides defensible bounds even with small sample sizes.
 *
 * @param {number} wins - Number of successes
 * @param {number} total - Total eligible sample count
 * @param {number} [confidence=0.95] - Confidence level
 * @returns {{ lower: number, upper: number, margin: number }}
 */
export function calculateWilsonConfidenceInterval(wins, total, confidence = 0.95) {
  if (!total || total <= 0) {
    return { lower: 0, upper: 0, margin: 0 };
  }

  // z-value for 95% is ~1.95996
  const z = confidence === 0.99 ? 2.5758 : confidence === 0.90 ? 1.6449 : 1.95996;
  const z2 = z * z;
  const p = wins / total;

  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const radical = (p * (1 - p) / total) + (z2 / (4 * total * total));
  const margin = (z * Math.sqrt(Math.max(0, radical))) / denominator;

  const lower = Math.max(0, center - margin) * 100;
  const upper = Math.min(1, center + margin) * 100;

  return {
    lower: +lower.toFixed(2),
    upper: +upper.toFixed(2),
    margin: +(margin * 100).toFixed(2),
  };
}

/**
 * Evaluates target candle outcome against prediction.
 * Strict definition:
 * - UP: target close > target open
 * - DOWN: target close < target open
 * - FLAT / DOJI: target close == target open (unscorable, excluded from directional stats)
 *
 * @param {Object} prediction - Stored prediction snapshot
 * @param {Object} targetCandle - Completed target candle
 * @param {number} [pipTolerance=0.000005] - Pip tolerance for flat doji classification
 * @returns {Object} Resolution record
 */
export function resolveTargetOutcome(prediction, targetCandle, pipTolerance = 0.000005) {
  const open = Number(targetCandle.open);
  const close = Number(targetCandle.close);
  const high = Number(targetCandle.high);
  const low = Number(targetCandle.low);
  const diff = close - open;

  let actualDirection;
  let isFlat = false;

  if (Math.abs(diff) <= pipTolerance) {
    actualDirection = 'FLAT';
    isFlat = true;
  } else if (diff > 0) {
    actualDirection = 'UP';
  } else {
    actualDirection = 'DOWN';
  }

  const predDir = (prediction.direction || '').toUpperCase();
  let evaluation;
  let isCorrect = false;

  if (isFlat) {
    evaluation = 'FLAT'; // Unscorable
  } else if (predDir === actualDirection) {
    evaluation = 'WIN';
    isCorrect = true;
  } else {
    evaluation = 'LOSS';
    isCorrect = false;
  }

  return {
    predictionId: prediction.predictionId,
    symbol: prediction.symbol,
    timeframe: prediction.timeframe,
    predictedDirection: predDir,
    predictedProbability: prediction.probability,
    predictedEdge: prediction.edge,
    targetStartTime: prediction.targetCandle?.startTime || targetCandle.time,
    targetEndTime: prediction.targetCandle?.endTime || (targetCandle.time + (prediction.stepSec || 60)),
    actualOpen: open,
    actualHigh: high,
    actualLow: low,
    actualClose: close,
    actualDirection,
    isFlat,
    isCorrect,
    evaluation, // 'WIN' | 'LOSS' | 'FLAT'
    resolvedAt: Date.now(),
    evaluationVersion: '1.0',
  };
}

/**
 * Calculate comprehensive accuracy and statistical metrics across a set of resolved evaluations.
 *
 * @param {Array<Object>} records - Array of resolved prediction evaluations
 * @param {Object} [options]
 * @param {number} [options.minSampleThreshold=30]
 * @param {string} [options.window='ALL']
 * @returns {Object} Full metrics payload
 */
export function calculateAccuracyMetrics(records = [], options = {}) {
  const minSampleThreshold = options.minSampleThreshold || 30;

  let totalRecorded = records.length;
  let pendingCount = 0;
  let flatCount = 0;
  let invalidCount = 0;
  let auditCount = 0;
  let wins = 0;
  let losses = 0;

  // Directional tracking
  let predUpCount = 0;
  let predDownCount = 0;
  let actualUpCount = 0;
  let actualDownCount = 0;

  // Confusion matrix
  let tp = 0; // Pred UP, Actual UP
  let fp = 0; // Pred UP, Actual DOWN
  let tn = 0; // Pred DOWN, Actual DOWN
  let fn = 0; // Pred DOWN, Actual UP

  // Probabilistic metrics
  let brierSum = 0;
  let brierCount = 0;
  let logLossSum = 0;
  let logLossCount = 0;

  const eligibleRecords = [];

  for (const r of records) {
    if (r.auditRequired || r.status === 'AUDIT_REQUIRED' || r.excludedFromMetrics) {
      auditCount++;
      continue; // Strictly excluded from verified accuracy statistics
    }

    if (r.status === 'PENDING' || r.evaluation === 'PENDING' || !r.resolvedAt) {
      pendingCount++;
      continue;
    }

    if (r.isFlat || r.actualDirection === 'FLAT' || r.evaluation === 'FLAT') {
      flatCount++;
      continue; // Excluded from directional accuracy numerator and denominator
    }

    if (r.status === 'INVALID' || r.evaluation === 'INVALID') {
      invalidCount++;
      continue;
    }

    const isWin = r.isCorrect === true || r.evaluation === 'WIN';
    const predDir = (r.predictedDirection || r.direction || '').toUpperCase();
    const actDir = (r.actualDirection || '').toUpperCase();

    if (isWin) {
      wins++;
    } else {
      losses++;
    }

    eligibleRecords.push(r);

    if (predDir === 'UP') predUpCount++;
    if (predDir === 'DOWN') predDownCount++;
    if (actDir === 'UP') actualUpCount++;
    if (actDir === 'DOWN') actualDownCount++;

    if (predDir === 'UP' && actDir === 'UP') tp++;
    else if (predDir === 'UP' && actDir === 'DOWN') fp++;
    else if (predDir === 'DOWN' && actDir === 'DOWN') tn++;
    else if (predDir === 'DOWN' && actDir === 'UP') fn++;

    // Brier score calculation (using recorded probability snapshot at decision time)
    const probUp = r.predictedProbability?.up ?? (r.probability?.up ?? (predDir === 'UP' ? 0.55 : 0.45));
    if (typeof probUp === 'number') {
      const actualOutcomeValue = actDir === 'UP' ? 1.0 : 0.0;
      brierSum += Math.pow(probUp - actualOutcomeValue, 2);
      brierCount++;

      // Log loss
      const eps = 1e-6;
      const clipped = Math.max(eps, Math.min(1 - eps, probUp));
      logLossSum += actualOutcomeValue === 1.0 ? -Math.log(clipped) : -Math.log(1 - clipped);
      logLossCount++;
    }
  }

  const eligibleCount = wins + losses;
  const accuracy = eligibleCount > 0 ? +((wins / eligibleCount) * 100).toFixed(2) : null;
  const isProvisional = eligibleCount < minSampleThreshold;

  // Wilson Score Confidence Interval
  const confidenceInterval = calculateWilsonConfidenceInterval(wins, eligibleCount, 0.95);

  // Balanced Accuracy: (Recall_UP + Recall_DOWN) / 2
  let recallUp = null;
  let recallDown = null;
  let balancedAccuracy = null;
  let balancedAccAvailable = false;

  const actualUpTotal = tp + fn;
  const actualDownTotal = tn + fp;

  if (actualUpTotal >= 3 && actualDownTotal >= 3) {
    recallUp = +(tp / actualUpTotal).toFixed(4);
    recallDown = +(tn / actualDownTotal).toFixed(4);
    balancedAccuracy = +(((recallUp + recallDown) / 2) * 100).toFixed(2);
    balancedAccAvailable = true;
  }

  // Directional Breakdown
  const upWins = tp;
  const upTotal = predUpCount;
  const upAccuracy = upTotal > 0 ? +((upWins / upTotal) * 100).toFixed(2) : null;

  const downWins = tn;
  const downTotal = predDownCount;
  const downAccuracy = downTotal > 0 ? +((downWins / downTotal) * 100).toFixed(2) : null;

  // Baseline Comparisons
  const randomBaseline = 50.0;
  const baselineDiff = accuracy !== null ? +(accuracy - randomBaseline).toFixed(2) : null;

  const majorityCount = Math.max(actualUpCount, actualDownCount);
  const majorityClassBaseline = eligibleCount > 0 ? +((majorityCount / eligibleCount) * 100).toFixed(2) : 50.0;
  const majorityDiff = accuracy !== null ? +(accuracy - majorityClassBaseline).toFixed(2) : null;

  // Probability Metrics
  const brierScore = brierCount > 0 ? +(brierSum / brierCount).toFixed(4) : null;
  const logLoss = logLossCount > 0 ? +(logLossSum / logLossCount).toFixed(4) : null;

  return {
    totalRecorded,
    evaluatedSamples: eligibleCount,
    pendingCount,
    flatCount,
    invalidCount,
    auditCount,
    wins,
    losses,
    accuracy, // percentage e.g. 58.33
    isProvisional,
    minSampleThreshold,
    confidenceInterval: {
      lower: confidenceInterval.lower,
      upper: confidenceInterval.upper,
      margin: confidenceInterval.margin,
      formatted: eligibleCount > 0 ? `[${confidenceInterval.lower}% — ${confidenceInterval.upper}%]` : '—',
    },
    balancedAccuracy,
    balancedAccAvailable,
    recallUp,
    recallDown,
    directionalBreakdown: {
      up: { predictions: predUpCount, wins: upWins, accuracy: upAccuracy },
      down: { predictions: predDownCount, wins: downWins, accuracy: downAccuracy },
      actualDistribution: { up: actualUpCount, down: actualDownCount },
    },
    confusionMatrix: {
      tp, // True Bullish (Pred UP, Act UP)
      fp, // False Bullish (Pred UP, Act DOWN)
      tn, // True Bearish (Pred DOWN, Act DOWN)
      fn, // False Bearish (Pred DOWN, Act UP)
    },
    baselines: {
      randomBaseline,
      baselineDiff,
      majorityClassBaseline,
      majorityDiff,
      majorityClass: actualUpCount >= actualDownCount ? 'UP' : 'DOWN',
    },
    probabilistic: {
      brierScore,
      logLoss,
      scoredCount: brierCount,
    },
  };
}

/**
 * Filter evaluation records by time window or count.
 *
 * @param {Array<Object>} records - All resolved records
 * @param {string} window - '24H' | '7D' | '30D' | 'ALL' | 'LAST_25' | 'LAST_50' | 'LAST_100'
 * @param {number} [referenceTime=Date.now()] - Wall-clock reference timestamp
 * @returns {Array<Object>} Filtered slice
 */
export function filterRecordsByWindow(records = [], window = 'ALL', referenceTime = Date.now()) {
  if (!records || records.length === 0) return [];

  // Sort chronological by resolution or prediction time
  const sorted = [...records].sort((a, b) => {
    const tA = a.resolvedAt || a.predictionTime || 0;
    const tB = b.resolvedAt || b.predictionTime || 0;
    return tA - tB;
  });

  if (window === 'LAST_25') return sorted.slice(-25);
  if (window === 'LAST_50') return sorted.slice(-50);
  if (window === 'LAST_100') return sorted.slice(-100);

  let cutoffMs = 0;
  if (window === '24H') cutoffMs = referenceTime - 24 * 60 * 60 * 1000;
  else if (window === '7D') cutoffMs = referenceTime - 7 * 24 * 60 * 60 * 1000;
  else if (window === '30D') cutoffMs = referenceTime - 30 * 24 * 60 * 60 * 1000;
  else return sorted; // 'ALL'

  return sorted.filter(r => (r.resolvedAt || r.predictionTime || 0) >= cutoffMs);
}
