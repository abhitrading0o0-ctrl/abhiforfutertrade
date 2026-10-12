// ============================================================
// ForFuture — Advanced Order Block Engine
// Algorithmic Detection, Lifecycle Tracking & Multi-Timeframe Isolation
// ============================================================

/**
 * Lifecycle states:
 * - PROVISIONAL: Displacement occurred, but structural break (BOS/CHoCH) not yet finalized
 * - CONFIRMED: Displacement + structural break verified by candle close
 * - UNTESTED: Confirmed zone that price has not re-entered
 * - TESTED: Price has wicked into the zone without violating the invalidation boundary
 * - MITIGATED: Price has penetrated past the 50% midpoint or zone has been heavily absorbed
 * - INVALIDATED: Price closed beyond the opposing invalidation boundary
 */

export const OB_STATUS = {
  PROVISIONAL: 'PROVISIONAL',
  CONFIRMED: 'CONFIRMED',
  UNTESTED: 'UNTESTED',
  TESTED: 'TESTED',
  MITIGATED: 'MITIGATED',
  INVALIDATED: 'INVALIDATED'
};

export const OB_TYPE = {
  BULLISH: 'BULLISH',
  BEARISH: 'BEARISH'
};

/**
 * Detect Order Blocks from historical candles and structural events
 * Strict isolation: only consumes candles belonging to the specified symbol and timeframe.
 *
 * @param {Array} candles - Array of OHLCV candles
 * @param {Array} swings - Confirmed swings from Market Structure
 * @param {number} atr - Current Average True Range
 * @param {string} symbol - Current active symbol
 * @param {string} timeframe - Current active timeframe
 * @returns {Object} { nearestBullishOB, nearestBearishOB, activeOrderBlocks, allOrderBlocks }
 */
export function detectOrderBlocks(candles, swings = [], atr = 0.0008, symbol = 'EUR/USD', timeframe = '1M') {
  if (!candles || candles.length < 10) {
    return {
      nearestBullishOB: null,
      nearestBearishOB: null,
      activeOrderBlocks: [],
      allOrderBlocks: []
    };
  }

  const n = candles.length;
  const currentPrice = candles[n - 1].close;
  const pipMult = (symbol && symbol.includes('JPY')) ? 100 : 10000;
  const effectiveATR = Math.max(0.0001, atr || 0.0005);
  const minDisplacement = effectiveATR * 1.1; // Qualifying displacement threshold

  const candidates = [];

  // Look back over historical candles (excluding forming candle)
  const lookback = Math.min(n - 2, 120);

  for (let i = n - lookback; i < n - 1; i++) {
    if (i < 2) continue;
    const originCandle = candles[i];
    const originIsBearish = originCandle.close < originCandle.open;
    const originIsBullish = originCandle.close > originCandle.open;

    // ----------------------------------------------------
    // 1. BULLISH ORDER BLOCK DETECTION
    // Origin: Bearish candle preceding strong bullish displacement
    // ----------------------------------------------------
    if (originIsBearish) {
      // Measure displacement across subsequent 1 to 3 candles
      let maxSubsequentHigh = originCandle.high;
      let displacementMove = 0;
      let displacementCandleCount = 0;

      for (let k = 1; k <= 3 && (i + k) < n; k++) {
        const nextC = candles[i + k];
        if (nextC.high > maxSubsequentHigh) maxSubsequentHigh = nextC.high;
        const move = nextC.close - originCandle.low;
        if (move > displacementMove) {
          displacementMove = move;
          displacementCandleCount = k;
        }
      }

      const hasDisplacement = displacementMove >= minDisplacement;
      
      // Check if this displacement resulted in a structural break (broke a prior swing high)
      const priorSwingHighs = swings.filter(s => s.type === 'HIGH' && s.index < i && s.index > (i - 40));
      const brokeStructure = priorSwingHighs.some(sh => maxSubsequentHigh > sh.price);

      if (hasDisplacement) {
        const zoneHigh = originCandle.high;
        const zoneLow = originCandle.low;
        const zoneMid = +((zoneHigh + zoneLow) / 2).toFixed(5);

        // Evaluate zone lifecycle from (i + displacementCandleCount + 1) up to current candle
        let status = brokeStructure ? OB_STATUS.UNTESTED : OB_STATUS.PROVISIONAL;
        let touches = 0;
        let reactionPips = 0;
        let lastTestTime = null;

        for (let j = i + displacementCandleCount + 1; j < n; j++) {
          const testCandle = candles[j];

          // Invalidation check: candle body closes below zone low
          if (testCandle.close < zoneLow) {
            status = OB_STATUS.INVALIDATED;
            break;
          }

          // Test / Mitigation check: price dips into zone
          if (testCandle.low <= zoneHigh && testCandle.high >= zoneLow) {
            touches++;
            lastTestTime = testCandle.time;

            if (testCandle.low <= zoneMid) {
              status = OB_STATUS.MITIGATED;
            } else if (status !== OB_STATUS.MITIGATED) {
              status = OB_STATUS.TESTED;
            }

            // Measure reaction from this touch
            const reaction = testCandle.close - testCandle.low;
            if (reaction > reactionPips) reactionPips = reaction;
          }
        }

        const distFromCurrent = currentPrice >= zoneHigh 
          ? currentPrice - zoneHigh 
          : zoneLow - currentPrice;
        const pipsDist = +(distFromCurrent * pipMult).toFixed(1);

        candidates.push({
          id: `${symbol}_${timeframe}_BULL_OB_${originCandle.time}`,
          type: OB_TYPE.BULLISH,
          high: zoneHigh,
          low: zoneLow,
          mid: zoneMid,
          time: originCandle.time,
          index: i,
          symbol,
          timeframe,
          status,
          touches,
          reactionPips: +(reactionPips * pipMult).toFixed(1),
          distance: distFromCurrent,
          pipDistance: pipsDist,
          formationReason: `Bearish candle before +${(displacementMove * pipMult).toFixed(1)} pip impulse${brokeStructure ? ' with BOS' : ''}`,
          lastTestTime
        });
      }
    }

    // ----------------------------------------------------
    // 2. BEARISH ORDER BLOCK DETECTION
    // Origin: Bullish candle preceding strong bearish displacement
    // ----------------------------------------------------
    if (originIsBullish) {
      let minSubsequentLow = originCandle.low;
      let displacementMove = 0;
      let displacementCandleCount = 0;

      for (let k = 1; k <= 3 && (i + k) < n; k++) {
        const nextC = candles[i + k];
        if (nextC.low < minSubsequentLow) minSubsequentLow = nextC.low;
        const move = originCandle.high - nextC.close;
        if (move > displacementMove) {
          displacementMove = move;
          displacementCandleCount = k;
        }
      }

      const hasDisplacement = displacementMove >= minDisplacement;
      const priorSwingLows = swings.filter(s => s.type === 'LOW' && s.index < i && s.index > (i - 40));
      const brokeStructure = priorSwingLows.some(sl => minSubsequentLow < sl.price);

      if (hasDisplacement) {
        const zoneHigh = originCandle.high;
        const zoneLow = originCandle.low;
        const zoneMid = +((zoneHigh + zoneLow) / 2).toFixed(5);

        let status = brokeStructure ? OB_STATUS.UNTESTED : OB_STATUS.PROVISIONAL;
        let touches = 0;
        let reactionPips = 0;
        let lastTestTime = null;

        for (let j = i + displacementCandleCount + 1; j < n; j++) {
          const testCandle = candles[j];

          // Invalidation check: candle body closes above zone high
          if (testCandle.close > zoneHigh) {
            status = OB_STATUS.INVALIDATED;
            break;
          }

          // Test / Mitigation check: price rises into zone
          if (testCandle.high >= zoneLow && testCandle.low <= zoneHigh) {
            touches++;
            lastTestTime = testCandle.time;

            if (testCandle.high >= zoneMid) {
              status = OB_STATUS.MITIGATED;
            } else if (status !== OB_STATUS.MITIGATED) {
              status = OB_STATUS.TESTED;
            }

            const reaction = testCandle.high - testCandle.close;
            if (reaction > reactionPips) reactionPips = reaction;
          }
        }

        const distFromCurrent = currentPrice <= zoneLow 
          ? zoneLow - currentPrice 
          : currentPrice - zoneHigh;
        const pipsDist = +(distFromCurrent * pipMult).toFixed(1);

        candidates.push({
          id: `${symbol}_${timeframe}_BEAR_OB_${originCandle.time}`,
          type: OB_TYPE.BEARISH,
          high: zoneHigh,
          low: zoneLow,
          mid: zoneMid,
          time: originCandle.time,
          index: i,
          symbol,
          timeframe,
          status,
          touches,
          reactionPips: +(reactionPips * pipMult).toFixed(1),
          distance: distFromCurrent,
          pipDistance: pipsDist,
          formationReason: `Bullish candle before -${(displacementMove * pipMult).toFixed(1)} pip drop${brokeStructure ? ' with BOS' : ''}`,
          lastTestTime
        });
      }
    }
  }

  // Filter active (non-invalidated) order blocks
  const activeOrderBlocks = candidates.filter(ob => ob.status !== OB_STATUS.INVALIDATED);

  // Find nearest valid bullish OB below price
  const bullishActive = activeOrderBlocks
    .filter(ob => ob.type === OB_TYPE.BULLISH && ob.high <= currentPrice * 1.002)
    .sort((a, b) => a.distance - b.distance);
  const nearestBullishOB = bullishActive.length > 0 ? bullishActive[0] : null;

  // Find nearest valid bearish OB above price
  const bearishActive = activeOrderBlocks
    .filter(ob => ob.type === OB_TYPE.BEARISH && ob.low >= currentPrice * 0.998)
    .sort((a, b) => a.distance - b.distance);
  const nearestBearishOB = bearishActive.length > 0 ? bearishActive[0] : null;

  return {
    nearestBullishOB,
    nearestBearishOB,
    activeOrderBlocks: activeOrderBlocks.sort((a, b) => b.time - a.time),
    allOrderBlocks: candidates.sort((a, b) => b.time - a.time)
  };
}
