// ============================================================
// ForFuture — Advanced Market Structure & Liquidity Engine
// Swings, HH/HL/LH/LL, BOS, CHoCH, Sweeps & Reclaim Analysis
// ============================================================

export function analyzeMarketStructure(candles, supportResistance, timeframe = '1M') {
  if (!candles || candles.length < 12) return null;

  const n = candles.length;
  const currentCandle = candles[n - 1];
  const prevCandle = candles[n - 2];

  // 1. Identify confirmed pivot swings (adaptive strength 3 -> 2)
  let swings = _findConfirmedPivots(candles, 3);
  if (swings.length < 3) {
    swings = _findConfirmedPivots(candles, 2);
  }

  // 2. Structural Labeling (HH, HL, LH, LL)
  const labeledSwings = _labelSwings(swings);

  // 3. BOS & CHoCH Structural Break Detection
  const structureState = _detectBOSandCHoCH(candles, labeledSwings);

  // 4. Equal Highs/Lows and Liquidity Sweeps
  const liquidity = _detectLiquiditySweeps(candles, labeledSwings, supportResistance);

  // 5. Breakout and Retest Status
  const breakoutState = _detectBreakoutsAndRetests(candles, labeledSwings, supportResistance);

  // Fallback trend if swings are sparse in a strong unilateral trend
  let finalTrend = structureState.trend;
  if (finalTrend === 'RANGE' && candles.length >= 10) {
    const half = Math.floor(candles.length / 2);
    const firstAvg = candles.slice(0, half).reduce((s, c) => s + c.close, 0) / half;
    const secondAvg = candles.slice(half).reduce((s, c) => s + c.close, 0) / (candles.length - half);
    if (secondAvg > firstAvg + 0.0003) finalTrend = 'BULLISH';
    else if (secondAvg < firstAvg - 0.0003) finalTrend = 'BEARISH';
  }

  return {
    swings: labeledSwings,
    trend: finalTrend,
    lastEvent: structureState.lastEvent,
    lastEventPrice: structureState.lastEventPrice,
    lastEventIndex: structureState.lastEventIndex,
    isConfirmedBreak: structureState.isConfirmedBreak,
    liquidity,
    breakoutState,
    timeframe
  };
}

function _findConfirmedPivots(candles, strength = 3) {
  const swings = [];
  const n = candles.length;
  for (let i = strength; i < n - strength; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= strength; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) isHigh = false;
      if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) isLow = false;
    }

    if (isHigh) swings.push({ price: c.high, type: 'HIGH', time: c.time, index: i, high: c.high, low: c.low });
    if (isLow) swings.push({ price: c.low, type: 'LOW', time: c.time, index: i, high: c.high, low: c.low });
  }
  return swings;
}

function _labelSwings(swings) {
  const labeled = [];
  let lastHigh = null;
  let lastLow = null;

  for (const s of swings) {
    if (s.type === 'HIGH') {
      const label = lastHigh ? (s.price > lastHigh.price ? 'HH' : 'LH') : 'HH';
      labeled.push({ ...s, label });
      lastHigh = s;
    } else {
      const label = lastLow ? (s.price > lastLow.price ? 'HL' : 'LL') : 'LL';
      labeled.push({ ...s, label });
      lastLow = s;
    }
  }
  return labeled;
}

function _detectBOSandCHoCH(candles, swings) {
  if (swings.length < 3) return { trend: 'RANGE', lastEvent: null, lastEventPrice: null, lastEventIndex: -1, isConfirmedBreak: false };

  const recent = swings.slice(-6);
  const n = candles.length;
  const current = candles[n - 1];

  let trend = 'RANGE';
  let lastEvent = null;
  let lastEventPrice = null;
  let lastEventIndex = -1;
  let isConfirmedBreak = false;

  const highs = recent.filter(s => s.type === 'HIGH');
  const lows = recent.filter(s => s.type === 'LOW');

  const lastHigh = highs[highs.length - 1];
  const prevHigh = highs.length > 1 ? highs[highs.length - 2] : null;
  const lastLow = lows[lows.length - 1];
  const prevLow = lows.length > 1 ? lows[lows.length - 2] : null;

  // Determine structural trend based on swing sequence
  if (lastHigh && prevHigh && lastLow && prevLow) {
    if (lastHigh.price > prevHigh.price && lastLow.price >= prevLow.price) {
      trend = 'BULLISH';
    } else if (lastLow.price < prevLow.price && lastHigh.price <= prevHigh.price) {
      trend = 'BEARISH';
    }
  }

  // Check recent closed candles for confirmed candle close breaks beyond swing levels
  for (let i = n - 10; i < n; i++) {
    if (i < 0) continue;
    const c = candles[i];

    if (lastHigh && c.close > lastHigh.price && i > lastHigh.index) {
      if (trend === 'BEARISH') {
        lastEvent = 'BULLISH_CHOCH'; // Trend change from bearish to bullish
        trend = 'BULLISH';
      } else {
        lastEvent = 'BULLISH_BOS'; // Trend continuation
      }
      lastEventPrice = lastHigh.price;
      lastEventIndex = i;
      isConfirmedBreak = true;
    } else if (lastLow && c.close < lastLow.price && i > lastLow.index) {
      if (trend === 'BULLISH') {
        lastEvent = 'BEARISH_CHOCH'; // Trend change from bullish to bearish
        trend = 'BEARISH';
      } else {
        lastEvent = 'BEARISH_BOS'; // Trend continuation
      }
      lastEventPrice = lastLow.price;
      lastEventIndex = i;
      isConfirmedBreak = true;
    }
  }

  // Fallback if no recent break
  if (!lastEvent && swings.length >= 4) {
    const sLast = swings[swings.length - 1];
    const sPrev = swings[swings.length - 2];
    if (sLast.label === 'HH' && sPrev.label === 'HL') {
      trend = 'BULLISH';
      lastEvent = 'BULLISH_BOS';
    } else if (sLast.label === 'LL' && sPrev.label === 'LH') {
      trend = 'BEARISH';
      lastEvent = 'BEARISH_BOS';
    }
  }

  return { trend, lastEvent, lastEventPrice, lastEventIndex, isConfirmedBreak };
}

function _detectLiquiditySweeps(candles, swings, sr) {
  const n = candles.length;
  const lastCandle = candles[n - 1];
  const prevCandle = n > 1 ? candles[n - 2] : lastCandle;
  const threshold = 0.00035; // ~3.5 pips

  let hasSweep = false;
  let sweepType = null;
  let sweepPrice = null;
  let hasReclaim = false;
  let sweepCandleIndex = -1;

  // Check past 3 candles for wick breach of previous swing high/low with body closing back inside
  const recentCandles = [
    { c: prevCandle, idx: n - 2 },
    { c: lastCandle, idx: n - 1 }
  ];

  for (const { c, idx } of recentCandles) {
    for (const s of swings.slice(-6)) {
      if (idx <= s.index) continue;

      // High sweep: wick exceeded swing high, but close remained below it
      if (s.type === 'HIGH' && c.high > s.price && c.close < s.price) {
        if ((c.high - s.price) < threshold) {
          hasSweep = true;
          sweepType = 'SWEEP_HIGH';
          sweepPrice = s.price;
          sweepCandleIndex = idx;
          // Reclaim check: current candle confirmed bearish rejection
          if (lastCandle.close < prevCandle.low || (lastCandle.close < lastCandle.open && lastCandle.close < s.price)) {
            hasReclaim = true;
          }
          break;
        }
      }

      // Low sweep: wick pierced swing low, but close remained above it
      if (s.type === 'LOW' && c.low < s.price && c.close > s.price) {
        if ((s.price - c.low) < threshold) {
          hasSweep = true;
          sweepType = 'SWEEP_LOW';
          sweepPrice = s.price;
          sweepCandleIndex = idx;
          // Reclaim check: current candle confirmed bullish rejection
          if (lastCandle.close > prevCandle.high || (lastCandle.close > lastCandle.open && lastCandle.close > s.price)) {
            hasReclaim = true;
          }
          break;
        }
      }
    }
    if (hasSweep) break;
  }

  // Equal highs / equal lows detection
  const eqHighs = _findEqual(swings.filter(s => s.type === 'HIGH'), threshold * 0.7);
  const eqLows = _findEqual(swings.filter(s => s.type === 'LOW'), threshold * 0.7);

  return {
    hasSweep,
    sweepType,
    sweepPrice,
    hasReclaim,
    sweepCandleIndex,
    equalHighs: eqHighs.length > 0 ? eqHighs[0].price : null,
    equalLows: eqLows.length > 0 ? eqLows[0].price : null
  };
}

function _findEqual(nodes, threshold) {
  for (let i = 0; i < nodes.length - 1; i++) {
    if (Math.abs(nodes[i].price - nodes[i + 1].price) <= threshold) {
      return [nodes[i], nodes[i + 1]];
    }
  }
  return [];
}

function _detectBreakoutsAndRetests(candles, swings, sr) {
  const n = candles.length;
  if (n < 6) return { isBreakout: false, isRetest: false, type: null, level: null };

  const current = candles[n - 1];
  const prev = candles[n - 2];
  const tolerance = 0.0002;

  let isBreakout = false;
  let isRetest = false;
  let type = null;
  let level = null;

  // Check recent swing break
  const recentHighs = swings.filter(s => s.type === 'HIGH').slice(-3);
  const recentLows = swings.filter(s => s.type === 'LOW').slice(-3);

  // Bullish breakout & retest
  for (const sh of recentHighs) {
    if (prev.close > sh.price && current.low <= (sh.price + tolerance) && current.close > sh.price) {
      isRetest = true;
      type = 'BULLISH_RETEST';
      level = sh.price;
      break;
    } else if (current.close > sh.price && prev.close <= sh.price) {
      isBreakout = true;
      type = 'BULLISH_BREAKOUT';
      level = sh.price;
      break;
    }
  }

  // Bearish breakout & retest
  if (!isBreakout && !isRetest) {
    for (const sl of recentLows) {
      if (prev.close < sl.price && current.high >= (sl.price - tolerance) && current.close < sl.price) {
        isRetest = true;
        type = 'BEARISH_RETEST';
        level = sl.price;
        break;
      } else if (current.close < sl.price && prev.close >= sl.price) {
        isBreakout = true;
        type = 'BEARISH_BREAKOUT';
        level = sl.price;
        break;
      }
    }
  }

  return { isBreakout, isRetest, type, level };
}
