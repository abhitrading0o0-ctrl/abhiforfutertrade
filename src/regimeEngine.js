// ============================================================
// MARKET REGIME ENGINE (Stage 3)
// Volatility, Choppiness, ADX, Trend/Range Classification
// ============================================================

export function analyzeMarketRegime(candles, indicators) {
  if (!candles || candles.length < 30) return null;

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const n = candles.length;
  
  // Realized Volatility (StdDev of returns)
  const returns = [];
  for (let i = 1; i < n; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length;
  const realizedVol = Math.sqrt(variance);

  // Choppiness Index (14)
  const chop14 = _calcChoppiness(highs, lows, closes, 14);

  // ADX/DMI (14)
  const adxData = _calcADX(highs, lows, closes, 14);

  // BB Width
  const slice = closes.slice(-20);
  const mean = slice.reduce((a, b) => a + b, 0) / 20;
  const var20 = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 20;
  const std20 = Math.sqrt(var20);
  const bbWidth = (std20 * 4) / mean;

  // Retrieve ATR from existing indicators if possible, or calculate
  const atr = _calcATR(candles, 14);

  // Classification Logic
  let regime = 'RANGE_BOUND';
  let volatilityState = 'NORMAL';

  if (bbWidth > 0.0025 || realizedVol > 0.0005) {
    volatilityState = 'HIGH';
  } else if (bbWidth < 0.001 || realizedVol < 0.00015) {
    volatilityState = 'LOW (COMPRESSION)';
  }

  const isTrending = adxData.adx > 25 && chop14 < 40;
  
  if (isTrending) {
    regime = adxData.plusDI > adxData.minusDI ? 'TRENDING_UP' : 'TRENDING_DOWN';
  } else {
    if (volatilityState.includes('LOW')) {
      regime = 'CONSOLIDATING';
    } else {
      regime = 'RANGE_BOUND';
    }
  }

  // Breakout Condition
  if (regime === 'CONSOLIDATING' && closes[n-1] > mean + (std20 * 1.5)) {
    regime = 'BREAKOUT_UP';
  } else if (regime === 'CONSOLIDATING' && closes[n-1] < mean - (std20 * 1.5)) {
    regime = 'BREAKOUT_DOWN';
  }

  return {
    regime,
    volatilityState,
    metrics: {
      realizedVol,
      choppiness: chop14,
      adx: adxData.adx,
      bbWidth,
      atr
    }
  };
}

function _calcChoppiness(highs, lows, closes, period) {
  const n = closes.length;
  if (n < period) return 50;

  const trs = [];
  for (let i = n - period; i < n; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }

  const sumTR = trs.reduce((a, b) => a + b, 0);
  const highestHigh = Math.max(...highs.slice(-period));
  const lowestLow = Math.min(...lows.slice(-period));
  const denom = highestHigh - lowestLow;
  
  if (denom === 0) return 50;
  return 100 * Math.log10(sumTR / denom) / Math.log10(period);
}

function _calcADX(highs, lows, closes, period) {
  const n = closes.length;
  if (n < period + 1) return { adx: 0, plusDI: 0, minusDI: 0 };
  
  let trSum = 0, pDmSum = 0, mDmSum = 0;
  for (let i = n - period; i < n; i++) {
    const upMove = highs[i] - highs[i-1];
    const downMove = lows[i-1] - lows[i];
    
    let pDm = 0, mDm = 0;
    if (upMove > downMove && upMove > 0) pDm = upMove;
    if (downMove > upMove && downMove > 0) mDm = downMove;
    
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]));
    
    trSum += tr;
    pDmSum += pDm;
    mDmSum += mDm;
  }
  
  if (trSum === 0) return { adx: 0, plusDI: 0, minusDI: 0 };
  
  const plusDI = 100 * (pDmSum / trSum);
  const minusDI = 100 * (mDmSum / trSum);
  
  const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100 || 0;
  return { adx: dx, plusDI, minusDI };
}

function _calcATR(candles, period) {
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}
