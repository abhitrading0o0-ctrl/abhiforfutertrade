// ============================================================
// ForFuture — Advanced Price Action & Micro-Candle Engine
// Wicks, Rejections, Pin Bars, Engulfing, Inside Bars & 3-Candle Pressure
// ============================================================

export function analyzePriceAction(candles) {
  if (!candles || candles.length < 5) return null;

  const n = candles.length;
  const current = candles[n - 1];
  const prev = candles[n - 2];
  const prev2 = candles[n - 3];
  const prev3 = n > 3 ? candles[n - 4] : prev2;

  const bodySize = Math.abs(current.close - current.open);
  const totalRange = Math.max(0.00001, current.high - current.low);
  
  const upperWick = current.high - Math.max(current.open, current.close);
  const lowerWick = Math.min(current.open, current.close) - current.low;
  
  const upperWickPct = +(upperWick / totalRange).toFixed(2);
  const lowerWickPct = +(lowerWick / totalRange).toFixed(2);
  const bodyPct = +(bodySize / totalRange).toFixed(2);

  const isBullish = current.close > current.open;
  const isBearish = current.close < current.open;
  const isDoji = bodyPct < 0.15;

  // 1. Engulfing Patterns
  const prevBody = Math.abs(prev.close - prev.open);
  const isBullEngulf = isBullish && prev.close < prev.open && current.close > prev.open && current.open <= prev.close;
  const isBearEngulf = isBearish && prev.close > prev.open && current.close < prev.open && current.open >= prev.close;

  // 2. Pin Bars / Hammers / Shooting Stars
  // Hammer: long lower wick (>= 55% of range), small body (<= 35%), small upper wick (<= 20%)
  const isHammer = lowerWickPct >= 0.55 && bodyPct <= 0.35 && upperWickPct <= 0.20;
  // Shooting Star: long upper wick (>= 55% of range), small body (<= 35%), small lower wick (<= 20%)
  const isShootingStar = upperWickPct >= 0.55 && bodyPct <= 0.35 && lowerWickPct <= 0.20;

  // 3. Inside & Outside Bars (Mother Bar Context)
  const isInsideBar = current.high <= prev.high && current.low >= prev.low;
  const isOutsideBar = current.high > prev.high && current.low < prev.low;

  // 4. Strong Wick Rejection Candle
  const isBullishRejection = lowerWickPct >= 0.50 && current.close >= (current.low + totalRange * 0.45);
  const isBearishRejection = upperWickPct >= 0.50 && current.close <= (current.high - totalRange * 0.45);

  // 5. Momentum Displacement Candle (Body significantly larger than recent average)
  const recentBodies = candles.slice(-6, -1).map(c => Math.abs(c.close - c.open));
  const avgBody = recentBodies.reduce((s, b) => s + b, 0) / Math.max(1, recentBodies.length);
  const isMomentum = bodySize >= (avgBody * 1.5) && bodyPct >= 0.60;

  // 6. Three-Candle Pressure Analysis
  // Checks last 3 candles for directional alignment, increasing/strong bodies, progressive closes
  const c1 = prev2, c2 = prev, c3 = current;
  const isThreeBull = c1.close > c1.open && c2.close > c2.open && c3.close > c3.open &&
    c2.close > c1.close && c3.close > c2.close &&
    c3.close >= c3.high - (c3.high - c3.low) * 0.25;

  const isThreeBear = c1.close < c1.open && c2.close < c2.open && c3.close < c3.open &&
    c2.close < c1.close && c3.close < c2.close &&
    c3.close <= c3.low + (c3.high - c3.low) * 0.25;

  // 7. Consecutive Rejection Candles
  // 2 consecutive candles showing wicks testing similar levels
  const prevUpperWick = prev.high - Math.max(prev.open, prev.close);
  const prevLowerWick = Math.min(prev.open, prev.close) - prev.low;
  const hasConsecutiveBullRejection = lowerWickPct > 0.40 && (prevLowerWick / (prev.high - prev.low || 1)) > 0.40 &&
    Math.abs(current.low - prev.low) <= (totalRange * 0.3);

  const hasConsecutiveBearRejection = upperWickPct > 0.40 && (prevUpperWick / (prev.high - prev.low || 1)) > 0.40 &&
    Math.abs(current.high - prev.high) <= (totalRange * 0.3);

  // 8. Overall Directional Signal from Price Action
  let signal = 'NEUTRAL';
  let triggerReason = 'No clear candlestick pattern';

  if (isBullEngulf) {
    signal = 'BULLISH';
    triggerReason = 'Bullish Engulfing pattern confirms buyer absorption';
  } else if (isBearEngulf) {
    signal = 'BEARISH';
    triggerReason = 'Bearish Engulfing pattern confirms seller absorption';
  } else if (isHammer || isBullishRejection) {
    signal = 'BULLISH';
    triggerReason = `Strong lower wick rejection (${(lowerWickPct * 100).toFixed(0)}% wick) defends lows`;
  } else if (isShootingStar || isBearishRejection) {
    signal = 'BEARISH';
    triggerReason = `Strong upper wick rejection (${(upperWickPct * 100).toFixed(0)}% wick) defends highs`;
  } else if (isThreeBull) {
    signal = 'BULLISH';
    triggerReason = 'Three-Candle bullish pressure progression towards highs';
  } else if (isThreeBear) {
    signal = 'BEARISH';
    triggerReason = 'Three-Candle bearish pressure progression towards lows';
  } else if (isMomentum && isBullish) {
    signal = 'BULLISH';
    triggerReason = 'Bullish momentum displacement candle';
  } else if (isMomentum && isBearish) {
    signal = 'BEARISH';
    triggerReason = 'Bearish momentum displacement candle';
  }

  return {
    bodySize,
    totalRange,
    upperWick,
    lowerWick,
    upperWickPct,
    lowerWickPct,
    bodyPct,
    isBullish,
    isBearish,
    isDoji,
    patterns: {
      isBullEngulf,
      isBearEngulf,
      isHammer,
      isShootingStar,
      isInsideBar,
      isOutsideBar,
      isMomentum,
      isBullishRejection,
      isBearishRejection,
      isThreeBull,
      isThreeBear,
      hasConsecutiveBullRejection,
      hasConsecutiveBearRejection
    },
    signal,
    triggerReason
  };
}
