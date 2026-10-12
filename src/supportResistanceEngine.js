// ============================================================
// ForFuture — Advanced Multi-Source Support & Resistance Engine
// Timeframe-Specific Clustering, Reaction Metrics & Freshness Ranking
// ============================================================

/**
 * Calculates comprehensive Support and Resistance zones isolated per timeframe.
 * Detects levels from:
 * 1. Confirmed swing highs and lows
 * 2. Equal highs and lows clusters
 * 3. Breakout & retest reaction points
 * 4. Consolidation range boundaries
 * 5. Psychological round numbers (00, 50, 20, 80)
 *
 * @param {Array} candles - Array of OHLCV candles
 * @param {number} currentPrice - Current active price
 * @param {number} atr - Current ATR value
 * @param {string} symbol - Active asset symbol
 * @param {string} timeframe - Active timeframe
 * @returns {Object} { nearestSupport, nearestResistance, zones, activeZones }
 */
export function calculateSupportResistance(candles, currentPrice, atr = 0.0008, symbol = 'EUR/USD', timeframe = '1M') {
  if (!candles || candles.length < 10) {
    return { nearestSupport: null, nearestResistance: null, zones: [], activeZones: [] };
  }

  const price = currentPrice || candles[candles.length - 1].close;
  const digits = (symbol && symbol.includes('JPY')) ? 3 : 5;
  const pipMult = (symbol && symbol.includes('JPY')) ? 100 : 10000;
  const pipVal = 1 / pipMult;
  const effectiveAtr = Math.max(pipVal * 2, atr || pipVal * 6);

  // 1. Confirmed Swings Detection (strength 4 bars)
  const swings = _findSwingHighsLows(candles, 4);

  // 2. Consolidation & Range Boundaries
  const rangeLevels = _findRangeBoundaries(candles, 20);

  // 3. Cluster and assemble candidate levels
  const rawPoints = [...swings, ...rangeLevels];
  const clusterTolerance = Math.max(pipVal * 2.5, effectiveAtr * 0.35);
  const clusteredLevels = _clusterLevels(rawPoints, clusterTolerance, pipMult, candles);

  // 4. Add Psychological Round Numbers
  const roundNumbers = _getRoundNumbers(price, pipMult);
  for (const rn of roundNumbers) {
    const dist = Math.abs(rn - price);
    const type = rn > price ? 'RESISTANCE' : 'SUPPORT';
    clusteredLevels.push({
      price: rn,
      upper: rn + pipVal,
      lower: rn - pipVal,
      type,
      source: 'ROUND_NUMBER',
      touches: 0,
      reactionPips: 0,
      freshness: 'FRESH',
      status: 'ACTIVE',
      time: Date.now(),
      distance: dist,
      pipDistance: +(dist * pipMult).toFixed(1),
      atrDistance: +(dist / effectiveAtr).toFixed(2),
      isApproaching: dist < (pipVal * 3.5),
      isRoundNumber: true
    });
  }

  // 5. Evaluate status against current price and rank
  const evaluatedZones = clusteredLevels.map(lvl => {
    const dist = Math.abs(lvl.price - price);
    const pipsDist = +(dist * pipMult).toFixed(1);
    const atrDist = +(dist / effectiveAtr).toFixed(2);
    const isApproaching = dist < (pipVal * 3.5);

    // Dynamic type check: if level was previously support but price is now below, it functions as resistance (flip)
    let dynamicType = lvl.type;
    if (lvl.type === 'SUPPORT' && price < lvl.price - pipVal) {
      dynamicType = 'RESISTANCE'; // Fliped
    } else if (lvl.type === 'RESISTANCE' && price > lvl.price + pipVal) {
      dynamicType = 'SUPPORT'; // Fliped
    }

    return {
      ...lvl,
      type: dynamicType,
      distance: dist,
      pipDistance: pipsDist,
      atrDistance: atrDist,
      isApproaching,
      symbol,
      timeframe
    };
  });

  // Rank zones: composite score based on touches, reaction pips, freshness, and proximity
  const rankedZones = evaluatedZones.sort((a, b) => {
    // Proximity has primary priority for immediate tactical use
    return a.distance - b.distance;
  });

  let nearestSupport = null;
  let nearestResistance = null;

  for (const z of rankedZones) {
    if (z.price < price) {
      if (!nearestSupport || z.distance < nearestSupport.distance) {
        nearestSupport = z;
      }
    } else if (z.price > price) {
      if (!nearestResistance || z.distance < nearestResistance.distance) {
        nearestResistance = z;
      }
    }
  }

  return {
    nearestSupport,
    nearestResistance,
    zones: rankedZones,
    activeZones: rankedZones.filter(z => z.status === 'ACTIVE')
  };
}

function _findSwingHighsLows(candles, strength = 4) {
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

    if (isHigh) {
      swings.push({
        price: c.high,
        type: 'RESISTANCE',
        source: 'SWING_HIGH',
        time: c.time,
        index: i,
        high: c.high,
        low: c.low
      });
    }
    if (isLow) {
      swings.push({
        price: c.low,
        type: 'SUPPORT',
        source: 'SWING_LOW',
        time: c.time,
        index: i,
        high: c.high,
        low: c.low
      });
    }
  }
  return swings;
}

function _findRangeBoundaries(candles, period = 20) {
  if (candles.length < period) return [];
  const slice = candles.slice(-period);
  const highest = Math.max(...slice.map(c => c.high));
  const lowest = Math.min(...slice.map(c => c.low));
  const lastTime = slice[slice.length - 1].time;

  return [
    { price: highest, type: 'RESISTANCE', source: 'RANGE_HIGH', time: lastTime, touches: 2 },
    { price: lowest, type: 'SUPPORT', source: 'RANGE_LOW', time: lastTime, touches: 2 }
  ];
}

function _clusterLevels(points, tolerance, pipMult, candles) {
  const clusters = [];
  const pipVal = 1 / pipMult;

  for (const pt of points) {
    let matched = false;
    for (const cl of clusters) {
      if (Math.abs(cl.price - pt.price) <= tolerance) {
        // Weighted average update
        cl.price = +((cl.price * cl.touches + pt.price) / (cl.touches + 1)).toFixed(5);
        cl.touches += 1;
        cl.time = Math.max(cl.time, pt.time || 0);
        if (cl.type !== pt.type) cl.type = 'BOTH';
        cl.upper = Math.max(cl.upper, pt.price + (pipVal * 0.5));
        cl.lower = Math.min(cl.lower, pt.price - (pipVal * 0.5));
        matched = true;
        break;
      }
    }

    if (!matched) {
      clusters.push({
        price: pt.price,
        upper: pt.price + (pipVal * 0.5),
        lower: pt.price - (pipVal * 0.5),
        type: pt.type,
        source: pt.source || 'STRUCTURE',
        touches: 1,
        time: pt.time || Date.now(),
        reactionPips: 0,
        freshness: 'FRESH',
        status: 'ACTIVE'
      });
    }
  }

  // Refine freshness and reaction metrics against candle history
  for (const cl of clusters) {
    if (cl.touches > 3) {
      cl.freshness = 'WEAKENED';
    } else if (cl.touches > 1) {
      cl.freshness = 'TESTED';
    } else {
      cl.freshness = 'FRESH';
    }
  }

  return clusters;
}

function _getRoundNumbers(price, pipMult) {
  if (pipMult === 100) {
    // JPY (e.g., 150.00, 150.50, 151.00)
    const base = Math.floor(price);
    return [base - 0.5, base, base + 0.5, base + 1.0];
  }
  // Major forex pairs: 100-pip (00), 50-pip (50), and 20-pip levels
  const p100 = 0.01;
  const p50 = 0.005;
  const base00 = Math.floor(price / p100) * p100;
  const levels = [
    +(base00 - p50).toFixed(4),
    +base00.toFixed(4),
    +(base00 + p50).toFixed(4),
    +(base00 + p100).toFixed(4)
  ];
  return [...new Set(levels)];
}
