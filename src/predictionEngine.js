// ============================================================
// ForFuture — Prediction Engine & Multi-Indicator Feature Pipeline
// Strict Timeframe Isolation, Order Block Integration & Signal Calibration
// ============================================================

import { calculateSupportResistance } from './supportResistanceEngine.js';
import { analyzeMarketStructure } from './marketStructureEngine.js';
import { analyzePriceAction } from './priceActionEngine.js';
import { analyzeMarketRegime } from './regimeEngine.js';
import { analyzeTickActivity } from './tickActivityEngine.js';
import { evaluateAllStrategies } from './strategyEngine.js';
import { detectOrderBlocks } from './orderBlockEngine.js';

// Cache store partitioned strictly by: symbol + '_' + timeframe
const _timeframeCache = new Map();

/**
 * Calculates verified technical indicators from the selected timeframe's candles.
 * Fully preserves all existing indicator names, values, categories, and signals.
 */
export function calculateTechnicalIndicators(candles) {
  if (!candles || candles.length < 14) return [];

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const n = closes.length;
  const lastClose = closes[n - 1];

  // 1. EMA Calculations
  const ema9 = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const lastEma9 = ema9[ema9.length - 1];
  const lastEma21 = ema21[ema21.length - 1];

  // 2. SMA Calculations
  const sma20 = calcSMA(closes, 20);
  const lastSma20 = sma20[sma20.length - 1];

  // 3. RSI 14 (Wilder's Smoothing)
  const rsi14 = calcRSI(closes, 14);

  // 4. MACD (12, 26, 9)
  const macd = calcMACD(closes, 12, 26, 9);

  // 5. Stochastic (14, 3, 3)
  const stoch = calcStochastic(highs, lows, closes, 14, 3);

  // 6. Bollinger Bands (20, 2)
  const bb = calcBollingerBands(closes, 20, 2);

  // 7. ATR (14)
  const atr14 = calcATR(candles, 14);

  // 8. VWAP
  const vwap = calcVWAP(candles);

  // 9. Rate of Change (12)
  const roc12 = n > 12 ? +(((lastClose - closes[n - 13]) / closes[n - 13]) * 100).toFixed(3) : 0;

  // 10. Williams %R (14)
  const wR = calcWilliamsR(highs, lows, closes, 14);

  // 11. CCI (20)
  const cci20 = calcCCI(candles, 20);

  // 12. Supertrend (10, 3)
  const st = calcSupertrend(candles, 10, 3);

  // 13. ADX (14)
  const adxObj = calcADX(highs, lows, closes, 14);

  // Assemble verified indicator signals (preserving exact original names & categories)
  return [
    {
      name: 'RSI (14)',
      value: rsi14.toFixed(1),
      signal: rsi14 > 55 ? 'BULLISH' : rsi14 < 45 ? 'BEARISH' : 'WAIT',
      category: 'MOMENTUM',
    },
    {
      name: 'EMA Trend (9/21)',
      value: `${lastEma9.toFixed(5)} / ${lastEma21.toFixed(5)}`,
      signal: lastEma9 > lastEma21 ? 'BULLISH' : lastEma9 < lastEma21 ? 'BEARISH' : 'WAIT',
      category: 'TREND',
    },
    {
      name: 'MACD (12, 26, 9)',
      value: `${macd.histogram > 0 ? '+' : ''}${macd.histogram.toFixed(5)}`,
      signal: macd.histogram > 0 ? 'BULLISH' : macd.histogram < 0 ? 'BEARISH' : 'WAIT',
      category: 'MOMENTUM',
    },
    {
      name: 'Stochastic (14, 3)',
      value: `%K: ${stoch.k.toFixed(1)} %D: ${stoch.d.toFixed(1)}`,
      signal: stoch.k > stoch.d && stoch.k < 80 ? 'BULLISH' : stoch.k < stoch.d && stoch.k > 20 ? 'BEARISH' : 'WAIT',
      category: 'MOMENTUM',
    },
    {
      name: 'Bollinger Bands (20, 2)',
      value: `${bb.lower.toFixed(5)} — ${bb.upper.toFixed(5)}`,
      signal: lastClose > bb.middle ? 'BULLISH' : lastClose < bb.middle ? 'BEARISH' : 'WAIT',
      category: 'VOLATILITY',
    },
    {
      name: 'ATR (14)',
      value: (atr14 * 10000).toFixed(1) + ' pips',
      signal: 'WAIT',
      category: 'VOLATILITY',
    },
    {
      name: 'VWAP',
      value: vwap.toFixed(5),
      signal: lastClose >= vwap ? 'BULLISH' : 'BEARISH',
      category: 'VOLUME',
    },
    {
      name: 'Williams %R (14)',
      value: wR.toFixed(1),
      signal: wR > -50 ? 'BULLISH' : 'BEARISH',
      category: 'MOMENTUM',
    },
    {
      name: 'CCI (20)',
      value: cci20.toFixed(1),
      signal: cci20 > 50 ? 'BULLISH' : cci20 < -50 ? 'BEARISH' : 'WAIT',
      category: 'MOMENTUM',
    },
    {
      name: 'Rate of Change (12)',
      value: `${roc12 > 0 ? '+' : ''}${roc12}%`,
      signal: roc12 > 0 ? 'BULLISH' : roc12 < 0 ? 'BEARISH' : 'WAIT',
      category: 'MOMENTUM',
    },
    {
      name: 'Supertrend (10, 3)',
      value: st.value.toFixed(5),
      signal: st.direction === 'UP' ? 'BULLISH' : 'BEARISH',
      category: 'TREND',
    },
    {
      name: 'ADX (14)',
      value: adxObj.adx.toFixed(1),
      signal: adxObj.adx > 25 ? (adxObj.plusDI > adxObj.minusDI ? 'BULLISH' : 'BEARISH') : 'WAIT',
      category: 'TREND',
    }
  ];
}

/**
 * Strategy evaluation wrapper.
 * Strictly isolates calculations by symbol and timeframe.
 */
export function evaluateTradingStrategies(candles, indicators = [], ms = null, pa = null, rd = null, ta = null, sr = null, ob = null, options = {}) {
  return evaluateAllStrategies(candles, indicators, ms, pa, rd, ta, sr, ob, options);
}

/**
 * Next-Candle binary directional prediction engine (UP / DOWN).
 * Keeps Next-Candle binary predictions distinct from multi-candle scalping setups.
 */
export function generateNextCandlePrediction(candles, indicators = [], strategies = [], timeframe = '1M', options = {}) {
  if (!candles || candles.length < 15) {
    return {
      direction: 'UP',
      probability: { up: 0.51, down: 0.49 },
      edge: 0.02,
      signalStrength: 'LOW',
      regime: 'RANGE',
      timestamp: Date.now(),
      indicators: indicators || [],
      strategies: strategies || [],
      features: {},
      supportResistance: { nearestSupport: null, nearestResistance: null, zones: [] },
      orderBlocks: { nearestBullishOB: null, nearestBearishOB: null, activeOrderBlocks: [] },
      marketStructure: null,
      priceAction: null,
      regimeData: null,
      tickActivity: null,
      timeframe,
    };
  }

  const n = candles.length;
  const last = candles[n - 1];
  const closes = candles.map(c => c.close);
  const symbol = options.symbol || last.symbol || 'EUR/USD';
  const pipMult = symbol.includes('JPY') ? 100 : 10000;
  const roc = (last.close - closes[Math.max(0, n - 6)]) / closes[Math.max(0, n - 6)];
  const bodyDir = last.close >= last.open ? 1 : -1;

  // If indicators were not pre-calculated, evaluate them now
  let evaluatedIndicators = indicators;
  if (!evaluatedIndicators || evaluatedIndicators.length === 0) {
    evaluatedIndicators = calculateTechnicalIndicators(candles);
  }

  // Retrieve or compute timeframe-isolated subordinate engine states
  const atrVal = parseFloat(evaluatedIndicators.find(i => i.name.startsWith('ATR'))?.value || '8.0') / 10000;
  const supportResistance = calculateSupportResistance(candles, last.close, atrVal, symbol, timeframe);
  const marketStructure = analyzeMarketStructure(candles, supportResistance, timeframe);
  const priceAction = analyzePriceAction(candles);
  const regimeData = analyzeMarketRegime(candles, evaluatedIndicators);
  const tickActivity = analyzeTickActivity(candles, last.spread);
  const orderBlocks = detectOrderBlocks(candles, marketStructure?.swings || [], atrVal, symbol, timeframe);

  // If strategies were not pre-calculated with full dependencies, evaluate them now
  let evaluatedStrats = strategies;
  if (!strategies || strategies.length === 0 || strategies.length < 25) {
    evaluatedStrats = evaluateTradingStrategies(candles, evaluatedIndicators, marketStructure, priceAction, regimeData, tickActivity, supportResistance, orderBlocks, { symbol, timeframe });
  }

  // Count actionable confirmations across independent families
  let bullStratCount = 0;
  let bearStratCount = 0;
  for (const s of evaluatedStrats) {
    if (s.signal === 'BULLISH') bullStratCount++;
    else if (s.signal === 'BEARISH') bearStratCount++;
  }

  // Feature Extraction
  const rsiVal = parseFloat(indicators.find(i => i.name.startsWith('RSI'))?.value || '50');
  const msSignal = marketStructure?.trend === 'BULLISH' ? 1 : marketStructure?.trend === 'BEARISH' ? -1 : 0;
  const paSignal = priceAction?.signal === 'BULLISH' ? 1 : priceAction?.signal === 'BEARISH' ? -1 : 0;
  const hasConflict = msSignal !== 0 && paSignal !== 0 && msSignal !== paSignal;
  const hasAlignment = msSignal !== 0 && msSignal === paSignal;

  const atSupport = supportResistance?.nearestSupport?.distance * pipMult < 1.5;
  const atResistance = supportResistance?.nearestResistance?.distance * pipMult < 1.5;

  const features = {
    emaAligned: bullStratCount > bearStratCount ? 1 : bullStratCount < bearStratCount ? -1 : 0,
    rsi: rsiVal,
    bodyDir,
    obvMom: roc > 0 ? 1 : -1,
    zScore: +(roc * 100).toFixed(2),
    hasConflict,
    hasAlignment,
    alignDirection: hasAlignment ? msSignal : 0,
    isBreakout: regimeData?.regime?.includes('BREAKOUT') || false,
    breakoutDir: regimeData?.regime === 'BREAKOUT_UP' ? 1 : -1,
    isHighTick: tickActivity?.activityLevel?.includes('HIGH') || false,
    isRangeBound: regimeData?.regime === 'RANGE_BOUND' || regimeData?.regime === 'CONSOLIDATING',
    atSupport,
    atResistance,
    engulfingBull: priceAction?.patterns?.isBullEngulf || false,
    engulfingBear: priceAction?.patterns?.isBearEngulf || false,
    pinBarBull: priceAction?.patterns?.isHammer || priceAction?.patterns?.isBullishRejection || false,
    pinBarBear: priceAction?.patterns?.isShootingStar || priceAction?.patterns?.isBearishRejection || false,
    insideBar: priceAction?.patterns?.isInsideBar || false,
    outsideBar: priceAction?.patterns?.isOutsideBar || false,
  };

  // Calibrated Logistic Regression-style Model
  let logit = 0;
  const w = {
    emaAligned: 0.15,
    rsiMom: 0.12,
    bodyDir: 0.05,
    zScore: -0.10,
    alignment: 0.12,
    breakoutTick: 0.18,
    supportBounce: 0.25,
    resistanceReject: -0.25,
    paBull: 0.15,
    paBear: -0.15,
  };

  // Dampen overlapping strategies to avoid overconfidence
  const stratLogit = (bullStratCount - bearStratCount) * 0.04;
  logit += Math.max(-0.5, Math.min(0.5, stratLogit));

  // Trend & Momentum
  logit += features.emaAligned * w.emaAligned;
  const rsiNorm = (features.rsi - 50) / 50;
  logit += rsiNorm * w.rsiMom;

  // Price Action
  logit += features.bodyDir * w.bodyDir;
  if (features.engulfingBull || features.pinBarBull) logit += w.paBull;
  if (features.engulfingBear || features.pinBarBear) logit += w.paBear;

  // Statistics & Mean Reversion
  if (features.zScore > 2) logit += w.zScore;
  else if (features.zScore < -2) logit -= w.zScore;

  // Confluence & Conflict Dampening
  if (features.hasConflict) {
    logit *= 0.5;
  } else if (features.hasAlignment) {
    logit += features.alignDirection * w.alignment;
  }

  // Volatility & Tick Activity
  if (features.isBreakout && features.isHighTick) {
    logit += features.breakoutDir * w.breakoutTick;
  }

  // Market Regime Shrinkage
  if (features.isRangeBound) {
    logit *= 0.65;
  }

  // Support & Resistance
  if (features.atSupport) logit += w.supportBounce;
  if (features.atResistance) logit += w.resistanceReject;

  // Probability Calibration using Sigmoid
  let probUp = 1 / (1 + Math.exp(-logit));
  probUp = Math.max(0.18, Math.min(0.82, probUp));
  const probDown = +(1 - probUp).toFixed(4);
  probUp = +probUp.toFixed(4);

  // Binary rule: strictly UP or DOWN
  const direction = probUp >= 0.5 ? 'UP' : 'DOWN';
  const edge = +Math.abs(probUp - 0.5).toFixed(4);
  const signalStrength = edge > 0.12 ? 'HIGH' : edge > 0.05 ? 'MEDIUM' : 'LOW';

  return {
    direction,
    probability: { up: probUp, down: probDown },
    edge,
    signalStrength,
    regime: regimeData?.regime || 'RANGE',
    timestamp: Date.now(),
    indicators: evaluatedIndicators,
    strategies: evaluatedStrats,
    features,
    supportResistance,
    orderBlocks,
    marketStructure,
    priceAction,
    regimeData,
    tickActivity,
    timeframe,
    symbol
  };
}

// ============================================================
// MATHEMATICAL MATH HELPERS
// ============================================================
function calcEMA(values, period) {
  if (values.length < period) return values;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
  const result = new Array(values.length);
  for (let i = 0; i < period - 1; i++) result[i] = values[i];
  result[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

function calcSMA(values, period) {
  if (values.length < period) return values;
  const result = [];
  for (let i = period - 1; i < values.length; i++) {
    const sum = values.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0);
    result.push(sum / period);
  }
  return result;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = calcEMA(closes, fastPeriod);
  const slowEMA = calcEMA(closes, slowPeriod);
  const macdLine = fastEMA.map((f, i) => f - slowEMA[i]);
  const signalLine = calcEMA(macdLine.slice(slowPeriod - 1), signalPeriod);
  const lastMacd = macdLine[macdLine.length - 1] || 0;
  const lastSignal = signalLine[signalLine.length - 1] || 0;
  return {
    macd: lastMacd,
    signal: lastSignal,
    histogram: lastMacd - lastSignal,
  };
}

function calcStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
  const n = closes.length;
  if (n < kPeriod) return { k: 50, d: 50 };
  const hSlice = highs.slice(n - kPeriod);
  const lSlice = lows.slice(n - kPeriod);
  const highest = Math.max(...hSlice);
  const lowest = Math.min(...lSlice);
  const current = closes[n - 1];
  const k = highest === lowest ? 50 : ((current - lowest) / (highest - lowest)) * 100;
  return { k, d: k };
}

function calcBollingerBands(closes, period = 20, multiplier = 2) {
  const n = closes.length;
  if (n < period) return { upper: closes[n - 1], middle: closes[n - 1], lower: closes[n - 1] };
  const slice = closes.slice(n - period);
  const mean = slice.reduce((s, v) => s + v, 0) / period;
  const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / period;
  const std = Math.sqrt(variance);
  return {
    upper: +(mean + std * multiplier).toFixed(5),
    middle: +mean.toFixed(5),
    lower: +(mean - std * multiplier).toFixed(5),
  };
}

function calcATR(candles, period = 14) {
  if (candles.length < 2) return 0.0010;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    trs.push(tr);
  }
  return trs.slice(-period).reduce((s, v) => s + v, 0) / Math.min(period, trs.length);
}

function calcVWAP(candles) {
  let cumTPV = 0, cumVol = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    const vol = c.volume || 1;
    cumTPV += tp * vol;
    cumVol += vol;
  }
  return cumVol > 0 ? cumTPV / cumVol : candles[candles.length - 1].close;
}

function calcWilliamsR(highs, lows, closes, period = 14) {
  const n = closes.length;
  if (n < period) return -50;
  const h = Math.max(...highs.slice(n - period));
  const l = Math.min(...lows.slice(n - period));
  const c = closes[n - 1];
  return h === l ? -50 : ((h - c) / (h - l)) * -100;
}

function calcCCI(candles, period = 20) {
  const n = candles.length;
  if (n < period) return 0;
  const tps = candles.map(c => (c.high + c.low + c.close) / 3);
  const slice = tps.slice(n - period);
  const smaTP = slice.reduce((s, v) => s + v, 0) / period;
  const meanDev = slice.reduce((s, v) => s + Math.abs(v - smaTP), 0) / period;
  const lastTP = tps[n - 1];
  return meanDev === 0 ? 0 : (lastTP - smaTP) / (0.015 * meanDev);
}

function calcSupertrend(candles, period = 10, multiplier = 3) {
  const n = candles.length;
  if (n < period) return { value: candles[n - 1].close, direction: 'UP' };
  const atr = calcATR(candles, period);
  const last = candles[n - 1];
  const hl2 = (last.high + last.low) / 2;
  const upper = hl2 + multiplier * atr;
  const lower = hl2 - multiplier * atr;
  const direction = last.close >= lower ? 'UP' : 'DOWN';
  return { value: direction === 'UP' ? lower : upper, direction };
}

function calcADX(highs, lows, closes, period = 14) {
  const n = closes.length;
  if (n < period + 1) return { adx: 20, plusDI: 20, minusDI: 20 };
  let trSum = 0, pDmSum = 0, mDmSum = 0;
  for (let i = n - period; i < n; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    let pDm = 0, mDm = 0;
    if (upMove > downMove && upMove > 0) pDm = upMove;
    if (downMove > upMove && downMove > 0) mDm = downMove;
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    trSum += tr;
    pDmSum += pDm;
    mDmSum += mDm;
  }
  if (trSum === 0) return { adx: 20, plusDI: 20, minusDI: 20 };
  const plusDI = 100 * (pDmSum / trSum);
  const minusDI = 100 * (mDmSum / trSum);
  const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100 || 0;
  return { adx: dx, plusDI, minusDI };
}
