// ============================================================
// ForFuture — Parallel Prediction Accuracy Monitor
// Canonical Timeframe Aggregator & OHLC Validator
// Implements verified aggregation of M1 candles into M2, M3, M4
// with boundary alignment and strict completeness validation.
// ============================================================

/**
 * Validates a series of OHLC candles for financial data integrity.
 * Rejects missing, malformed, non-finite prices, or invalid OHLC relationships.
 *
 * @param {Array<Object>} candles
 * @returns {{ valid: boolean, error?: string, sanitizedCandles: Array<Object> }}
 */
export function validateCandleSeries(candles) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return { valid: false, error: 'NO_CANDLES_PROVIDED', sanitizedCandles: [] };
  }

  const sanitized = [];
  const seenTimestamps = new Set();

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!c || typeof c !== 'object') {
      return { valid: false, error: `MALFORMED_CANDLE_AT_INDEX_${i}`, sanitizedCandles: [] };
    }

    const time = Number(c.time ?? Math.floor(c.timestamp / 1000));
    const open = Number(c.open);
    const high = Number(c.high);
    const low = Number(c.low);
    const close = Number(c.close);
    const volume = Number(c.volume ?? c.tickCount ?? 0);

    // Validate numeric finite prices
    if (!Number.isFinite(time) || time <= 0) {
      return { valid: false, error: `INVALID_TIMESTAMP_AT_INDEX_${i}`, sanitizedCandles: [] };
    }
    if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
      return { valid: false, error: `NON_FINITE_PRICE_AT_INDEX_${i}`, sanitizedCandles: [] };
    }
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
      return { valid: false, error: `NON_POSITIVE_PRICE_AT_INDEX_${i}`, sanitizedCandles: [] };
    }

    // Validate OHLC relationship: High must be >= max(open, close), Low must be <= min(open, close)
    if (high < low || high < open || high < close || low > open || low > close) {
      return { valid: false, error: `INVALID_OHLC_BOUNDS_AT_INDEX_${i}`, sanitizedCandles: [] };
    }

    // Deduplicate duplicate timestamps
    if (seenTimestamps.has(time)) {
      continue; // Skip duplicate bar
    }
    seenTimestamps.add(time);

    sanitized.push({
      time,
      timestamp: time * 1000,
      open,
      high,
      low,
      close,
      volume: isNaN(volume) ? 1 : volume,
      spread: Number(c.spread ?? 0.0001),
      status: c.status || 'CLOSED',
      complete: c.complete !== false,
      symbol: c.symbol,
      timeframe: c.timeframe,
      provider: c.provider,
    });
  }

  // Sort chronologically ascending
  sanitized.sort((a, b) => a.time - b.time);

  return { valid: sanitized.length > 0, sanitizedCandles: sanitized };
}

/**
 * Aggregates verified completed M1 constituent candles into custom minute candles (M2, M3, M4).
 * Strictly aligns boundaries to Math.floor(c.time / stepSec) * stepSec.
 *
 * Requirements:
 * 1. Retrieve valid M1 candle history.
 * 2. Align boundaries to documented timeframe convention.
 * 3. Group only exact required constituent M1 candles (multiplier count).
 * 4. Open from first constituent candle.
 * 5. High = max constituent high.
 * 6. Low = min constituent low.
 * 7. Close from last constituent candle.
 * 8. Aggregate volume from constituents.
 * 9. Ensure no missing constituent candle is silently treated as valid.
 * 10. Mark derived candle completed only when all required component intervals have completed.
 *
 * @param {Array<Object>} m1Candles - Chronologically sorted completed M1 candles
 * @param {number} multiplier - Minutes per derived candle (e.g. 2 for 2M, 3 for 3M, 4 for 4M)
 * @param {string} [symbol='EUR/USD']
 * @returns {Array<Object>} Completed derived candles
 */
export function aggregateM1Candles(m1Candles = [], multiplier = 2, symbol = 'EUR/USD') {
  if (!Array.isArray(m1Candles) || m1Candles.length === 0 || multiplier <= 1) {
    return [];
  }

  const { valid, sanitizedCandles } = validateCandleSeries(m1Candles);
  if (!valid || sanitizedCandles.length < multiplier) {
    return [];
  }

  const stepSec = multiplier * 60;
  const groups = new Map(); // bucketStart -> Array<Candle>

  for (const c of sanitizedCandles) {
    const bucketStart = Math.floor(c.time / stepSec) * stepSec;
    if (!groups.has(bucketStart)) {
      groups.set(bucketStart, []);
    }
    groups.get(bucketStart).push(c);
  }

  const derivedCandles = [];
  const sortedBucketStarts = Array.from(groups.keys()).sort((a, b) => a - b);

  for (const bucketStart of sortedBucketStarts) {
    const constituents = groups.get(bucketStart);

    // Strict completeness check: must have exact multiplier count of constituent M1 candles
    if (constituents.length !== multiplier) {
      // Incomplete group (e.g. market gap or currently forming candle) -> skip
      continue;
    }

    // Verify constituent timestamps are exact consecutive 60s intervals:
    // bucketStart, bucketStart + 60, bucketStart + 120, etc.
    let isConsecutive = true;
    for (let k = 0; k < multiplier; k++) {
      const expectedTime = bucketStart + k * 60;
      if (constituents[k].time !== expectedTime) {
        isConsecutive = false;
        break;
      }
    }

    if (!isConsecutive) {
      // Gap in constituent candles -> reject derived candle
      continue;
    }

    const first = constituents[0];
    const last = constituents[multiplier - 1];

    let maxHigh = first.high;
    let minLow = first.low;
    let sumVol = 0;

    for (let k = 0; k < multiplier; k++) {
      const bar = constituents[k];
      if (bar.high > maxHigh) maxHigh = bar.high;
      if (bar.low < minLow) minLow = bar.low;
      sumVol += (bar.volume || 1);
    }

    derivedCandles.push({
      time: bucketStart,
      timestamp: bucketStart * 1000,
      open: first.open,
      high: maxHigh,
      low: minLow,
      close: last.close,
      mid: last.close,
      volume: sumVol,
      volumeType: 'TICK',
      spread: last.spread || 0.0001,
      complete: true,
      status: 'CLOSED',
      symbol,
      timeframe: `${multiplier}M`,
      startTime: bucketStart,
      endTime: bucketStart + stepSec,
      derived: true,
      sourceData: 'M1',
      constituentCount: multiplier,
    });
  }

  return derivedCandles;
}
