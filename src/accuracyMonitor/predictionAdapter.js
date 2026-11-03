// ============================================================
// ForFuture — Parallel Prediction Accuracy Monitor
// Independent Prediction Context Adapter
// Evaluates next-candle predictions in an isolated context
// Reuses the genuine existing prediction engine with ZERO side effects.
// ============================================================

import { generateNextCandlePrediction } from '../predictionEngine.js';
import { TIMEFRAME_MAP, ASSET_MAP } from './registry.js';

export const ENGINE_VERSION = '4.0.0';

/**
 * Hash or stringify configuration to detect version changes
 */
export function computeConfigHash(config = {}) {
  const keys = Object.keys(config).sort();
  return keys.map(k => `${k}:${config[k]}`).join(';') || 'default';
}

/**
 * Predict next candle for an arbitrary symbol and timeframe.
 * Operates purely on immutable completed candle inputs.
 * Never mutates active chart, selected symbol, or global prediction state.
 *
 * @param {Object} context
 * @param {string} context.symbol - e.g. 'EUR/USD'
 * @param {string} context.timeframe - e.g. '1M', '3M', '5M'
 * @param {Array<Object>} context.completedCandles - Closed historical candles
 * @param {Object} [context.config] - Timeframe specific configuration
 * @param {string} [context.engineVersion] - Version of the prediction model
 * @param {number} [context.calculationTime] - Explicit timestamp of decision cutoff
 * @returns {Object} Prediction snapshot with target candle timing and metadata
 */
export function predictNextCandle({
  symbol = 'EUR/USD',
  timeframe = '1M',
  completedCandles = [],
  config = {},
  engineVersion = ENGINE_VERSION,
  calculationTime = Date.now(),
}) {
  const tfConfig = TIMEFRAME_MAP[timeframe] || { seconds: 60 };
  const stepSec = tfConfig.seconds;

  if (!completedCandles || completedCandles.length < 15) {
    return {
      success: false,
      error: 'INSUFFICIENT_CANDLES',
      requiredCandles: 15,
      providedCandles: completedCandles?.length || 0,
      symbol,
      timeframe,
    };
  }

  // Clone candles immutably to guarantee isolation
  const isolatedCandles = completedCandles.map(c => ({
    time: c.time,
    timestamp: c.timestamp || (c.time * 1000),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: Number(c.volume || c.tickCount || 0),
    spread: Number(c.spread || 0.0001),
  })).sort((a, b) => a.time - b.time);

  const latestCompleted = isolatedCandles[isolatedCandles.length - 1];
  const latestCompletedTime = latestCompleted.time;

  // Exact target candle boundary: starts when latest completed ends
  const targetStartTime = latestCompletedTime + stepSec;
  const targetEndTime = targetStartTime + stepSec;

  // Run the genuine prediction engine with isolated parameters
  const predResult = generateNextCandlePrediction(
    isolatedCandles,
    [], // compute indicators inside engine
    [], // compute strategies inside engine
    timeframe,
    { symbol, ...config }
  );

  const direction = predResult.direction; // 'UP' | 'DOWN'
  const probability = predResult.probability || { up: 0.5, down: 0.5 };
  const edge = predResult.edge || 0;
  const signalStrength = predResult.signalStrength || 'LOW';
  const regime = predResult.regime || 'RANGE';
  const configHash = computeConfigHash(config);

  const predictionId = `${symbol.replace(/[/_]/g, '')}_${timeframe}_${targetStartTime}_v${engineVersion}`;

  return {
    success: true,
    predictionId,
    symbol,
    timeframe,
    stepSec,
    engineVersion,
    configHash,
    predictionTime: calculationTime,
    cutoffCandleTime: latestCompletedTime,
    latestCompletedCandle: {
      time: latestCompleted.time,
      open: latestCompleted.open,
      high: latestCompleted.high,
      low: latestCompleted.low,
      close: latestCompleted.close,
    },
    targetCandle: {
      startTime: targetStartTime,
      endTime: targetEndTime,
    },
    direction,
    probability,
    edge,
    signalStrength,
    regime,
    features: predResult.features || {},
    status: 'PENDING', // PENDING until target candle closes
    evaluation: null,  // Will be populated upon outcome resolution
  };
}
