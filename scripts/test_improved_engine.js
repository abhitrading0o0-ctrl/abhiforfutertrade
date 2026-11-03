// scripts/test_improved_engine.js
import fs from 'fs';
import path from 'path';

import { calculateTechnicalIndicators, generateNextCandlePrediction as originalPredict } from '../src/predictionEngine.js';
import { evaluateAllStrategies as originalEvaluateStrats } from '../src/strategyEngine.js';
import { calculateSupportResistance } from '../src/supportResistanceEngine.js';
import { analyzeMarketStructure } from '../src/marketStructureEngine.js';
import { analyzePriceAction } from '../src/priceActionEngine.js';
import { analyzeMarketRegime } from '../src/regimeEngine.js';
import { analyzeTickActivity } from '../src/tickActivityEngine.js';
import { detectOrderBlocks } from '../src/orderBlockEngine.js';

const dataPath = path.resolve('historical_test_data.json');
const datasets = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Prototype of Improved Strategy Evaluation
function improvedEvaluateAllStrategies(candles, indicators = [], ms = null, pa = null, rd = null, ta = null, sr = null, ob = null, options = {}) {
  if (!candles || candles.length < 5) return [];

  const n = candles.length;
  const currentCandle = candles[n - 1];
  const prevCandle = candles[n - 2];
  const currentPrice = currentCandle.close;
  const timeframe = options.timeframe || currentCandle.timeframe || '1M';
  const symbol = options.symbol || currentCandle.symbol || 'EUR/USD';
  const spreadPips = options.spreadPips != null ? options.spreadPips : (currentCandle.spread ? (currentCandle.spread * 10000) : 0.8);

  const pipMult = (symbol && symbol.includes('JPY')) ? 100 : 10000;
  const pipVal = 1 / pipMult;

  const indMap = new Map((indicators || []).map(i => [i.name, i]));
  const rsiInd = indMap.get('RSI (14)');
  const rsiVal = rsiInd ? parseFloat(rsiInd.value) : 50;
  const rsiSig = rsiInd?.signal || (rsiVal > 55 ? 'BULLISH' : rsiVal < 45 ? 'BEARISH' : 'WAIT');

  const macdInd = indMap.get('MACD (12, 26, 9)');
  const macdSig = macdInd?.signal || 'WAIT';
  const macdHist = parseFloat(macdInd?.value || '0');

  const emaInd = indMap.get('EMA Trend (9/21)');
  const emaSig = emaInd?.signal || 'WAIT';

  const atrInd = indMap.get('ATR (14)');
  const atrVal = atrInd ? (parseFloat(atrInd.value) / pipMult) : (0.0008 * 10000 / pipMult);

  const supportResistance = sr || calculateSupportResistance(candles, currentPrice, atrVal, symbol, timeframe);
  const marketStructure = ms || analyzeMarketStructure(candles, supportResistance, timeframe);
  const priceAction = pa || analyzePriceAction(candles);
  const regimeData = rd || analyzeMarketRegime(candles, indicators);
  const tickActivity = ta || analyzeTickActivity(candles, currentCandle.spread);
  const orderBlocks = ob || detectOrderBlocks(candles, marketStructure?.swings || [], atrVal, symbol, timeframe);

  const strategies = [];

  const makeSignal = (def) => {
    const isBull = def.signal === 'BULLISH';
    const isBear = def.signal === 'BEARISH';
    const direction = isBull ? 'BUY' : isBear ? 'SELL' : null;

    let finalSignal = def.signal;
    let finalStatus = def.status;
    let costEval = 'NORMAL';

    if ((isBull || isBear) && spreadPips > 2.5 && timeframe === '1M') {
      finalSignal = 'EXECUTION NOT VERIFIED';
      finalStatus = `EXECUTION NOT VERIFIED — Spread (${spreadPips.toFixed(1)} pips) too high for scalp`;
      costEval = 'HIGH_SPREAD_PENALTY';
    }

    strategies.push({
      id: `${symbol}_${timeframe}_${def.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: def.name,
      category: def.category,
      signal: finalSignal,
      status: finalStatus,
      direction,
      actionable: finalSignal === 'BULLISH' || finalSignal === 'BEARISH',
      evidence: def.evidence || '',
      conditionsMet: def.conditionsMet || [],
      conditionsUnmet: def.conditionsUnmet || [],
      supportingEvidence: def.supportingEvidence || [],
      opposingEvidence: def.opposingEvidence || [],
      trigger: def.trigger || 'Price action confirmation',
      invalidation: def.invalidation || 'Opposing swing boundary',
      relevantLevel: def.relevantLevel || 'Nearby S/R or OB',
      qualityScore: def.qualityScore || (finalSignal === 'BULLISH' || finalSignal === 'BEARISH' ? 75 : 45),
      timeframe,
      symbol,
      costEvaluation: costEval,
      timestamp: currentCandle.time || Date.now()
    });
  };

  // 1. Support Bounce ('Support/Resistance')
  const nearSup = supportResistance?.nearestSupport;
  const isAtSup = nearSup && (nearSup.distance * pipMult) <= 2.5;
  const approachedSupFromAbove = prevCandle.open >= (nearSup?.price || 0);
  const heldAboveSup = currentCandle.close >= (nearSup?.price || 0) && currentCandle.low <= (nearSup?.price || 0) + (pipVal * 1.5);
  const supRejectionConfirmed = heldAboveSup && (priceAction?.patterns?.isHammer || priceAction?.patterns?.isBullEngulf || priceAction?.lowerWickPct >= 0.40);

  makeSignal({
    name: 'Support Bounce',
    category: 'Support/Resistance',
    signal: isAtSup && approachedSupFromAbove && supRejectionConfirmed ? 'BULLISH' : isAtSup ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isAtSup && approachedSupFromAbove && supRejectionConfirmed
      ? 'BULLISH SETUP — SUPPORT DEFENSE CONFIRMED'
      : isAtSup ? 'WAIT — Testing Support; awaiting confirmed rejection wick' : 'NO SETUP — Price not at key support',
    evidence: isAtSup ? `Price tested Support ${nearSup.price.toFixed(5)} with lower wick ${(priceAction?.lowerWickPct * 100).toFixed(0)}%` : 'Price not testing key support level',
    qualityScore: supRejectionConfirmed ? 82 : 45,
    conditionsMet: isAtSup && supRejectionConfirmed ? ['Support level tested', 'Rejection wick confirmed', 'Body closed above support'] : isAtSup ? ['Price at Support'] : [],
    conditionsUnmet: !isAtSup ? ['Price at key support'] : [!supRejectionConfirmed ? 'Rejection wick holding above support' : '']
  });

  // 2. Resistance Rejection ('Support/Resistance')
  const nearRes = supportResistance?.nearestResistance;
  const isAtRes = nearRes && (nearRes.distance * pipMult) <= 2.5;
  const approachedResFromBelow = prevCandle.open <= (nearRes?.price || 0);
  const heldBelowRes = currentCandle.close <= (nearRes?.price || 0) && currentCandle.high >= (nearRes?.price || 0) - (pipVal * 1.5);
  const resRejectionConfirmed = heldBelowRes && (priceAction?.patterns?.isShootingStar || priceAction?.patterns?.isBearEngulf || priceAction?.upperWickPct >= 0.40);

  makeSignal({
    name: 'Resistance Rejection',
    category: 'Support/Resistance',
    signal: isAtRes && approachedResFromBelow && resRejectionConfirmed ? 'BEARISH' : isAtRes ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isAtRes && approachedResFromBelow && resRejectionConfirmed
      ? 'BEARISH SETUP — RESISTANCE DEFENSE CONFIRMED'
      : isAtRes ? 'WAIT — Testing Resistance; awaiting confirmed rejection wick' : 'NO SETUP — Price not at key resistance',
    evidence: isAtRes ? `Price tested Resistance ${nearRes.price.toFixed(5)} with upper wick ${(priceAction?.upperWickPct * 100).toFixed(0)}%` : 'Price not testing key resistance level',
    qualityScore: resRejectionConfirmed ? 82 : 45,
    conditionsMet: isAtRes && resRejectionConfirmed ? ['Resistance level tested', 'Rejection wick confirmed', 'Body closed below resistance'] : isAtRes ? ['Price at Resistance'] : [],
    conditionsUnmet: !isAtRes ? ['Price at key resistance'] : [!resRejectionConfirmed ? 'Rejection wick holding below resistance' : '']
  });

  // 3. Breakout and Retest ('Breakout and Retest')
  const boState = marketStructure?.breakoutState;
  makeSignal({
    name: 'Breakout and Retest',
    category: 'Breakout and Retest',
    signal: boState?.isRetest && boState?.type === 'BULLISH_RETEST' && priceAction?.isBullish
      ? 'BULLISH'
      : boState?.isRetest && boState?.type === 'BEARISH_RETEST' && priceAction?.isBearish
      ? 'BEARISH'
      : boState?.isBreakout ? 'WAIT' : 'NO VALIDATED SETUP',
    status: boState?.isRetest
      ? `${boState.type === 'BULLISH_RETEST' ? 'BULLISH' : 'BEARISH'} SETUP — RETEST CONFIRMED`
      : boState?.isBreakout ? 'BREAKOUT DETECTED — WAIT FOR RETEST' : 'NO SETUP — No active breakout or retest',
    evidence: boState?.isRetest ? `Successful retest hold at ${boState.level?.toFixed(5)}` : 'Market inside consolidated boundaries',
    qualityScore: boState?.isRetest ? 80 : 45
  });

  // 4. False Breakout ('Breakout and Retest')
  const liq = marketStructure?.liquidity;
  const isSweepHigh = liq?.hasSweep && liq?.sweepType === 'SWEEP_HIGH';
  const isSweepLow = liq?.hasSweep && liq?.sweepType === 'SWEEP_LOW';
  makeSignal({
    name: 'False Breakout',
    category: 'Breakout and Retest',
    signal: isSweepHigh && priceAction?.isBearish ? 'BEARISH' : isSweepLow && priceAction?.isBullish ? 'BULLISH' : (isSweepHigh || isSweepLow) ? 'WAIT' : 'NO VALIDATED SETUP',
    status: (isSweepHigh && priceAction?.isBearish) ? 'BEARISH SETUP — FALSE BREAK CONFIRMED' : (isSweepLow && priceAction?.isBullish) ? 'BULLISH SETUP — FALSE BREAK CONFIRMED' : (isSweepHigh || isSweepLow) ? 'WAIT — Awaiting close back inside' : 'NO SETUP',
    qualityScore: 82
  });

  // 5. Structure Break and Retest ('Market Structure')
  const lastEvent = marketStructure?.lastEvent;
  makeSignal({
    name: 'Structure Break and Retest',
    category: 'Market Structure',
    signal: lastEvent === 'BULLISH_BOS' && priceAction?.isBullish ? 'BULLISH' : lastEvent === 'BEARISH_BOS' && priceAction?.isBearish ? 'BEARISH' : lastEvent ? 'WAIT' : 'NO VALIDATED SETUP',
    status: lastEvent ? `${lastEvent} CONFIRMED` : 'NO SETUP',
    qualityScore: 78
  });

  // 6. Liquidity-Sweep Proxy ('Market Structure')
  makeSignal({
    name: 'Liquidity-Sweep Proxy',
    category: 'Market Structure',
    signal: isSweepLow && priceAction?.isBullish ? 'BULLISH' : isSweepHigh && priceAction?.isBearish ? 'BEARISH' : 'NO VALIDATED SETUP',
    status: isSweepLow ? 'BULLISH SWEEP RECLAIM' : isSweepHigh ? 'BEARISH SWEEP RECLAIM' : 'NO SETUP',
    qualityScore: 80
  });

  // 7. Range Mean Reversion ('Mean Reversion')
  const isRange = regimeData?.regime === 'RANGE_BOUND' || regimeData?.regime === 'CONSOLIDATING';
  makeSignal({
    name: 'Range Mean Reversion',
    category: 'Mean Reversion',
    signal: isRange && rsiVal < 40 && isAtSup && priceAction?.isBullish ? 'BULLISH' : isRange && rsiVal > 60 && isAtRes && priceAction?.isBearish ? 'BEARISH' : isRange ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isRange ? 'RANGE ROTATION' : 'NO SETUP',
    qualityScore: 75
  });

  // 8. Trend Pullback ('Trend Following')
  const structTrend = marketStructure?.trend;
  const isPullbackEndBull = structTrend === 'BULLISH' && emaSig === 'BULLISH' && priceAction?.isBullish && (prevCandle.close <= prevCandle.open || priceAction?.lowerWickPct >= 0.35);
  const isPullbackEndBear = structTrend === 'BEARISH' && emaSig === 'BEARISH' && priceAction?.isBearish && (prevCandle.close >= prevCandle.open || priceAction?.upperWickPct >= 0.35);
  makeSignal({
    name: 'Trend Pullback',
    category: 'Trend Following',
    signal: isPullbackEndBull ? 'BULLISH' : isPullbackEndBear ? 'BEARISH' : structTrend !== 'RANGE' ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isPullbackEndBull ? 'BULLISH PULLBACK RESOLVED' : isPullbackEndBear ? 'BEARISH PULLBACK RESOLVED' : 'WAIT',
    qualityScore: 84
  });

  // 9. Momentum Continuation ('Momentum')
  const momAligned = emaSig === rsiSig && emaSig !== 'WAIT' && emaSig !== 'NEUTRAL' && priceAction?.signal === emaSig;
  makeSignal({
    name: 'Momentum Continuation',
    category: 'Momentum',
    signal: momAligned ? emaSig : 'WAIT',
    status: momAligned ? `${emaSig} MOMENTUM ALIGNED` : 'WAIT',
    qualityScore: 78
  });

  // 10. Confirmed RSI Divergence ('Momentum')
  const slice15 = candles.slice(-15);
  const minLowIdx = slice15.reduce((minI, c, i, arr) => c.low < arr[minI].low ? i : minI, 0);
  const maxHighIdx = slice15.reduce((maxI, c, i, arr) => c.high > arr[maxI].high ? i : maxI, 0);
  const rsiDivBull = rsiVal < 38 && minLowIdx >= 10 && priceAction?.isBullish;
  const rsiDivBear = rsiVal > 62 && maxHighIdx >= 10 && priceAction?.isBearish;
  makeSignal({
    name: 'Confirmed RSI Divergence',
    category: 'Momentum',
    signal: rsiDivBull ? 'BULLISH' : rsiDivBear ? 'BEARISH' : 'WAIT',
    status: rsiDivBull ? 'BULLISH RSI DIVERGENCE' : rsiDivBear ? 'BEARISH RSI DIVERGENCE' : 'WAIT',
    qualityScore: 80
  });

  // 11. Confirmed MACD Divergence ('Momentum')
  makeSignal({
    name: 'Confirmed MACD Divergence',
    category: 'Momentum',
    signal: macdSig === 'BULLISH' && priceAction?.isBullish && macdHist > 0 ? 'BULLISH' : macdSig === 'BEARISH' && priceAction?.isBearish && macdHist < 0 ? 'BEARISH' : 'WAIT',
    status: macdSig !== 'WAIT' ? `${macdSig} MACD CONFLUENCE` : 'WAIT',
    qualityScore: 76
  });

  // 12. Volatility Squeeze Breakout ('Volatility')
  const isVolLow = regimeData?.volatilityState?.includes('LOW');
  const isBreakout = regimeData?.regime?.includes('BREAKOUT');
  makeSignal({
    name: 'Volatility Squeeze Breakout',
    category: 'Volatility',
    signal: isBreakout && regimeData?.regime === 'BREAKOUT_UP' && priceAction?.isBullish ? 'BULLISH' : isBreakout && regimeData?.regime === 'BREAKOUT_DOWN' && priceAction?.isBearish ? 'BEARISH' : isVolLow ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isBreakout ? 'SQUEEZE EXPANSION' : 'WAIT',
    qualityScore: 85
  });

  // 13. Volatility Regime Transition ('Volatility')
  const isVolHigh = regimeData?.volatilityState?.includes('HIGH') || (currentCandle.high - currentCandle.low) > (atrVal * 1.5);
  makeSignal({
    name: 'Volatility Regime Transition',
    category: 'Volatility',
    signal: isVolHigh && priceAction?.isBullish ? 'BULLISH' : isVolHigh && priceAction?.isBearish ? 'BEARISH' : 'WAIT',
    status: isVolHigh ? 'HIGH VOLATILITY EXPANSION' : 'WAIT',
    qualityScore: 78
  });

  // 14. Candle Rejection Strategy ('Candlestick/Price Action')
  const candleRange = currentCandle.high - currentCandle.low;
  const isSignificantRange = candleRange >= (atrVal * 0.7);
  const bullWickAtLevel = isSignificantRange && priceAction?.lowerWickPct >= 0.45 && (isAtSup || isSweepLow || nearSup);
  const bearWickAtLevel = isSignificantRange && priceAction?.upperWickPct >= 0.45 && (isAtRes || isSweepHigh || nearRes);
  makeSignal({
    name: 'Candle Rejection Strategy',
    category: 'Candlestick/Price Action',
    signal: bullWickAtLevel ? 'BULLISH' : bearWickAtLevel ? 'BEARISH' : 'WAIT',
    status: bullWickAtLevel ? 'BULLISH WICK REJECTION AT LEVEL' : bearWickAtLevel ? 'BEARISH WICK REJECTION AT LEVEL' : 'WAIT',
    qualityScore: 80
  });

  // 15. Tick-Activity Confirmation ('Tick Activity')
  const isHighTick = (currentCandle.volume || 100) > ((candles.slice(-10).reduce((s, c) => s + (c.volume || 100), 0) / 10) * 1.25);
  makeSignal({
    name: 'Tick-Activity Confirmation',
    category: 'Tick Activity',
    signal: isHighTick && priceAction?.isBullish ? 'BULLISH' : isHighTick && priceAction?.isBearish ? 'BEARISH' : 'WAIT',
    status: isHighTick ? 'VOLUME ACCELERATION CONFIRMED' : 'WAIT',
    qualityScore: 78
  });

  // 16. Trend + Pullback + Structure Confirmation ('Multi-Timeframe')
  const confBull = structTrend === 'BULLISH' && emaSig === 'BULLISH' && (priceAction?.patterns?.isBullEngulf || priceAction?.patterns?.isHammer || priceAction?.isBullish);
  const confBear = structTrend === 'BEARISH' && emaSig === 'BEARISH' && (priceAction?.patterns?.isBearEngulf || priceAction?.patterns?.isShootingStar || priceAction?.isBearish);
  makeSignal({
    name: 'Trend + Pullback + Structure Confirmation',
    category: 'Multi-Timeframe',
    signal: confBull ? 'BULLISH' : confBear ? 'BEARISH' : 'WAIT',
    status: confBull ? 'TREND STRUCTURE CONFLUENCE' : 'WAIT',
    qualityScore: 84
  });

  // 17. Support/Resistance + Momentum Confirmation ('Multi-Timeframe')
  const srMomBull = isAtSup && rsiSig === 'BULLISH' && priceAction?.isBullish;
  const srMomBear = isAtRes && rsiSig === 'BEARISH' && priceAction?.isBearish;
  makeSignal({
    name: 'Support/Resistance + Momentum Confirmation',
    category: 'Multi-Timeframe',
    signal: srMomBull ? 'BULLISH' : srMomBear ? 'BEARISH' : 'WAIT',
    status: srMomBull ? 'S/R MOMENTUM CONFLUENCE' : 'WAIT',
    qualityScore: 82
  });

  // 18. Session Range Breakout ('Session-Based')
  const sessionRangeHigh = Math.max(...candles.slice(-40, -1).map(c => c.high));
  const sessionRangeLow = Math.min(...candles.slice(-40, -1).map(c => c.low));
  const isSessionBreakUp = currentPrice > sessionRangeHigh && priceAction?.isBullish;
  const isSessionBreakDn = currentPrice < sessionRangeLow && priceAction?.isBearish;
  makeSignal({
    name: 'Session Range Breakout',
    category: 'Session-Based',
    signal: isSessionBreakUp ? 'BULLISH' : isSessionBreakDn ? 'BEARISH' : 'WAIT',
    status: isSessionBreakUp ? 'SESSION RANGE HIGH BREAK' : 'WAIT',
    qualityScore: 80
  });

  // 19. Previous-Day High/Low Reaction ('Session-Based')
  const dayHigh = Math.max(...candles.slice(0, -1).map(c => c.high));
  const dayLow = Math.min(...candles.slice(0, -1).map(c => c.low));
  const atDayHigh = Math.abs(currentPrice - dayHigh) < (pipVal * 2.5);
  const atDayLow = Math.abs(currentPrice - dayLow) < (pipVal * 2.5);
  makeSignal({
    name: 'Previous-Day High/Low Reaction',
    category: 'Session-Based',
    signal: atDayLow && priceAction?.isBullish && priceAction?.lowerWickPct >= 0.3 ? 'BULLISH' : atDayHigh && priceAction?.isBearish && priceAction?.upperWickPct >= 0.3 ? 'BEARISH' : 'WAIT',
    status: atDayLow ? 'DAY LOW DEFENSE' : atDayHigh ? 'DAY HIGH DEFENSE' : 'WAIT',
    qualityScore: 84
  });

  // 20. Pivot-Point Rejection ('Support/Resistance')
  const pivotSlice = candles.slice(-25, -1);
  const pHigh = Math.max(...pivotSlice.map(c => c.high));
  const pLow = Math.min(...pivotSlice.map(c => c.low));
  const pClose = pivotSlice[pivotSlice.length - 1].close;
  const pivotPoint = +((pHigh + pLow + pClose) / 3).toFixed(5);
  const distToPivot = Math.abs(currentPrice - pivotPoint) * pipMult;
  const isAtPivot = distToPivot <= 1.5;
  const pivotBounceBull = isAtPivot && prevCandle.close >= pivotPoint && priceAction?.isBullish && priceAction?.lowerWickPct >= 0.35;
  const pivotRejectBear = isAtPivot && prevCandle.close <= pivotPoint && priceAction?.isBearish && priceAction?.upperWickPct >= 0.35;
  makeSignal({
    name: 'Pivot-Point Rejection',
    category: 'Support/Resistance',
    signal: pivotBounceBull ? 'BULLISH' : pivotRejectBear ? 'BEARISH' : 'WAIT',
    status: pivotBounceBull ? 'PIVOT BOUNCE CONFIRMED' : pivotRejectBear ? 'PIVOT REJECTION CONFIRMED' : 'WAIT — Not testing confirmed pivot boundary',
    qualityScore: pivotBounceBull || pivotRejectBear ? 82 : 40
  });

  // 21. Range Boundary Reversal ('Mean Reversion')
  makeSignal({
    name: 'Range Boundary Reversal',
    category: 'Mean Reversion',
    signal: isRange && isAtSup && heldAboveSup && priceAction?.isBullish ? 'BULLISH' : isRange && isAtRes && heldBelowRes && priceAction?.isBearish ? 'BEARISH' : isRange ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isRange && isAtSup ? 'RANGE LOW REVERSAL' : 'NO SETUP',
    qualityScore: 80
  });

  // 22. Failed Breakout Reversal ('Breakout and Retest')
  makeSignal({
    name: 'Failed Breakout Reversal',
    category: 'Breakout and Retest',
    signal: isSweepHigh && priceAction?.isBearish ? 'BEARISH' : isSweepLow && priceAction?.isBullish ? 'BULLISH' : 'WAIT',
    status: isSweepHigh ? 'FAILED BREAKOUT REVERSAL' : 'WAIT',
    qualityScore: 82
  });

  // 23. ATR-Normalized Momentum ('Momentum')
  const roc12 = indMap.get('Rate of Change (12)')?.signal;
  const isAtrNormal = (atrVal * pipMult) >= 3.0;
  makeSignal({
    name: 'ATR-Normalized Momentum',
    category: 'Momentum',
    signal: roc12 === 'BULLISH' && isAtrNormal && priceAction?.isBullish ? 'BULLISH' : roc12 === 'BEARISH' && isAtrNormal && priceAction?.isBearish ? 'BEARISH' : 'WAIT',
    status: isAtrNormal ? 'ATR MOMENTUM' : 'WAIT',
    qualityScore: 78
  });

  // 24. Session-Range Expansion ('Session-Based')
  makeSignal({
    name: 'Session-Range Expansion',
    category: 'Session-Based',
    signal: isBreakout && regimeData?.regime === 'BREAKOUT_UP' && priceAction?.isBullish ? 'BULLISH' : isBreakout && regimeData?.regime === 'BREAKOUT_DOWN' && priceAction?.isBearish ? 'BEARISH' : 'WAIT',
    status: isBreakout ? 'EXPANSION' : 'WAIT',
    qualityScore: 80
  });

  // 25. Multi-Timeframe Confluence ('Multi-Timeframe')
  const htfAligned = emaSig === rsiSig && structTrend !== 'RANGE' && priceAction?.signal === emaSig;
  makeSignal({
    name: 'Multi-Timeframe Confluence',
    category: 'Multi-Timeframe',
    signal: htfAligned && structTrend === 'BULLISH' ? 'BULLISH' : htfAligned && structTrend === 'BEARISH' ? 'BEARISH' : 'WAIT',
    status: htfAligned ? 'CONFLUENCE' : 'WAIT',
    qualityScore: 84
  });

  // Evaluate the 20 M1 Scalping Strategies (preserves all, keeping original logic + AFME)
  const legacyAndM1 = originalEvaluateStrats(candles, indicators, ms, pa, rd, ta, sr, ob, options);
  for (const s of legacyAndM1) {
    if (s.category === 'M1 SCALPING STRATEGIES') {
      strategies.push(s);
    }
  }

  return strategies;
}

// Prototype of Improved Next-Candle Predictor
function improvedPredict(candles, indicators = [], strategies = [], timeframe = '1M', options = {}) {
  if (!candles || candles.length < 15) {
    return originalPredict(candles, indicators, strategies, timeframe, options);
  }

  const n = candles.length;
  const last = candles[n - 1];
  const symbol = options.symbol || last.symbol || 'EUR/USD';
  const pipMult = symbol.includes('JPY') ? 100 : 10000;

  let evaluatedIndicators = indicators;
  if (!evaluatedIndicators || evaluatedIndicators.length === 0) {
    evaluatedIndicators = calculateTechnicalIndicators(candles);
  }

  const atrVal = parseFloat(evaluatedIndicators.find(i => i.name.startsWith('ATR'))?.value || '8.0') / pipMult;
  const supportResistance = calculateSupportResistance(candles, last.close, atrVal, symbol, timeframe);
  const marketStructure = analyzeMarketStructure(candles, supportResistance, timeframe);
  const priceAction = analyzePriceAction(candles);
  const regimeData = analyzeMarketRegime(candles, evaluatedIndicators);
  const tickActivity = analyzeTickActivity(candles, last.spread);
  const orderBlocks = detectOrderBlocks(candles, marketStructure?.swings || [], atrVal, symbol, timeframe);

  let evaluatedStrats = strategies;
  if (!strategies || strategies.length === 0 || strategies.length < 25) {
    evaluatedStrats = improvedEvaluateAllStrategies(candles, evaluatedIndicators, marketStructure, priceAction, regimeData, tickActivity, supportResistance, orderBlocks, { symbol, timeframe });
  }

  // Quality-weighted strategy evidence aggregation
  let weightedBullScore = 0;
  let weightedBearScore = 0;
  for (const s of evaluatedStrats) {
    if (s.signal === 'BULLISH') {
      const w = (s.qualityScore || 70) / 100;
      weightedBullScore += w;
    } else if (s.signal === 'BEARISH') {
      const w = (s.qualityScore || 70) / 100;
      weightedBearScore += w;
    }
  }

  // Feature Extraction
  const rsiVal = parseFloat(evaluatedIndicators.find(i => i.name.startsWith('RSI'))?.value || '50');
  const msSignal = marketStructure?.trend === 'BULLISH' ? 1 : marketStructure?.trend === 'BEARISH' ? -1 : 0;
  const paSignal = priceAction?.signal === 'BULLISH' ? 1 : priceAction?.signal === 'BEARISH' ? -1 : 0;
  const hasConflict = msSignal !== 0 && paSignal !== 0 && msSignal !== paSignal;
  const hasAlignment = msSignal !== 0 && msSignal === paSignal;

  const nearSup = supportResistance?.nearestSupport;
  const nearRes = supportResistance?.nearestResistance;
  const atSupport = nearSup && (nearSup.distance * pipMult) < 2.0;
  const atResistance = nearRes && (nearRes.distance * pipMult) < 2.0;

  // Streak exhaustion detection
  const bullStreak = candles.slice(-5).filter(c => c.close > c.open).length;
  const bearStreak = candles.slice(-5).filter(c => c.close < c.open).length;
  const isOverextendedBull = bullStreak >= 4;
  const isOverextendedBear = bearStreak >= 4;

  let logit = 0;

  // 1. Strategy consensus (weighted)
  const netStratScore = weightedBullScore - weightedBearScore;
  logit += Math.max(-0.6, Math.min(0.6, netStratScore * 0.12));

  // 2. Trend & Momentum
  if (msSignal !== 0) logit += msSignal * 0.15;
  const rsiNorm = (rsiVal - 50) / 50;
  logit += rsiNorm * 0.14;

  // 3. Price Action confirmation
  if (priceAction?.patterns?.isBullEngulf || priceAction?.patterns?.isHammer) logit += 0.22;
  if (priceAction?.patterns?.isBearEngulf || priceAction?.patterns?.isShootingStar) logit -= 0.22;

  // 4. S/R Defense vs Penetration (fixes the #1 failure mode!)
  if (atSupport) {
    if (priceAction?.isBullish || priceAction?.lowerWickPct >= 0.4) {
      logit += 0.28; // Defense/bounce
    } else if (priceAction?.isBearish && last.close < nearSup.price) {
      logit -= 0.25; // Breakdown penetration!
    }
  }
  if (atResistance) {
    if (priceAction?.isBearish || priceAction?.upperWickPct >= 0.4) {
      logit -= 0.28; // Defense/rejection
    } else if (priceAction?.isBullish && last.close > nearRes.price) {
      logit += 0.25; // Breakout penetration!
    }
  }

  // 5. Exhaustion penalty (fixes the #2 failure mode!)
  if (isOverextendedBull) logit -= 0.25;
  if (isOverextendedBear) logit += 0.25;

  // 6. Conflict dampening
  if (hasConflict) {
    logit *= 0.4;
  } else if (hasAlignment) {
    logit += msSignal * 0.15;
  }

  // Sigmoid probability calibration
  let probUp = 1 / (1 + Math.exp(-logit * 1.35));
  probUp = Math.max(0.15, Math.min(0.85, probUp));
  const probDown = +(1 - probUp).toFixed(4);
  probUp = +probUp.toFixed(4);

  const direction = probUp >= 0.5 ? 'UP' : 'DOWN';
  const edge = +Math.abs(probUp - 0.5).toFixed(4);

  return {
    direction,
    probability: { up: probUp, down: probDown },
    edge,
    signalStrength: edge > 0.12 ? 'HIGH' : edge > 0.05 ? 'MEDIUM' : 'LOW',
    regime: regimeData?.regime || 'RANGE',
    timestamp: Date.now(),
    indicators: evaluatedIndicators,
    strategies: evaluatedStrats,
    timeframe,
    symbol
  };
}

// -------------------------------------------------------------
// CHRONOLOGICAL VALIDATION: IN-SAMPLE VS OUT-OF-SAMPLE
// -------------------------------------------------------------
function evaluateEngine(predictFn, evalStratsFn, splitType = 'ALL') {
  let total = 0;
  let correct = 0;
  let brierSum = 0;
  let bullPred = 0, bullCorrect = 0;
  let bearPred = 0, bearCorrect = 0;
  let highEdgeTotal = 0, highEdgeCorrect = 0;

  for (const [symbol, candles] of Object.entries(datasets)) {
    // Split: 0 to 300 In-Sample, 301 to 499 Out-of-Sample
    let startIdx = 35;
    let endIdx = candles.length - 1;
    if (splitType === 'IN_SAMPLE') {
      startIdx = 35;
      endIdx = 300;
    } else if (splitType === 'OUT_OF_SAMPLE') {
      startIdx = 301;
      endIdx = candles.length - 1;
    }

    for (let i = startIdx; i < endIdx; i++) {
      const historicalSlice = candles.slice(0, i + 1);
      const targetCandle = candles[i + 1];
      const actualBinary = targetCandle.close >= targetCandle.open ? 1 : 0;
      const actualDir = targetCandle.close > targetCandle.open ? 'UP' : targetCandle.close < targetCandle.open ? 'DOWN' : 'FLAT';

      const pred = predictFn(historicalSlice, [], [], '1M', { symbol });
      total++;

      const brier = Math.pow(pred.probability.up - actualBinary, 2);
      brierSum += brier;

      const isCorrect = (pred.direction === 'UP' && actualBinary === 1) || (pred.direction === 'DOWN' && actualBinary === 0);
      if (isCorrect) correct++;

      if (pred.direction === 'UP') {
        bullPred++;
        if (actualBinary === 1) bullCorrect++;
      } else {
        bearPred++;
        if (actualBinary === 0) bearCorrect++;
      }

      if (pred.edge >= 0.08) {
        highEdgeTotal++;
        if (isCorrect) highEdgeCorrect++;
      }
    }
  }

  return {
    total,
    correct,
    winRate: +(correct / total * 100).toFixed(2),
    bullWinRate: +(bullCorrect / bullPred * 100).toFixed(2),
    bearWinRate: +(bearCorrect / bearPred * 100).toFixed(2),
    brier: +(brierSum / total).toFixed(4),
    highEdgeTotal,
    highEdgeWinRate: highEdgeTotal > 0 ? +(highEdgeCorrect / highEdgeTotal * 100).toFixed(2) : 0
  };
}

console.log('-------------------------------------------------------------');
console.log('1. IN-SAMPLE VALIDATION (Bars 35-300 | 795 Candles)');
console.log('-------------------------------------------------------------');
const origInSample = evaluateEngine(originalPredict, originalEvaluateStrats, 'IN_SAMPLE');
const imprInSample = evaluateEngine(improvedPredict, improvedEvaluateAllStrategies, 'IN_SAMPLE');

console.log(`Original Engine:  Win Rate: ${origInSample.winRate}% | Bull WR: ${origInSample.bullWinRate}% | Bear WR: ${origInSample.bearWinRate}% | Brier: ${origInSample.brier}`);
console.log(`Improved Engine:  Win Rate: ${imprInSample.winRate}% | Bull WR: ${imprInSample.bullWinRate}% | Bear WR: ${imprInSample.bearWinRate}% | Brier: ${imprInSample.brier}`);
console.log(`High-Edge Filter: Win Rate: ${imprInSample.highEdgeWinRate}% (N=${imprInSample.highEdgeTotal})`);

console.log('\n-------------------------------------------------------------');
console.log('2. UNTOUCHED OUT-OF-SAMPLE VALIDATION (Bars 301-499 | 594 Candles)');
console.log('-------------------------------------------------------------');
const origOOS = evaluateEngine(originalPredict, originalEvaluateStrats, 'OUT_OF_SAMPLE');
const imprOOS = evaluateEngine(improvedPredict, improvedEvaluateAllStrategies, 'OUT_OF_SAMPLE');

console.log(`Original Engine (OOS): Win Rate: ${origOOS.winRate}% | Bull WR: ${origOOS.bullWinRate}% | Bear WR: ${origOOS.bearWinRate}% | Brier: ${origOOS.brier}`);
console.log(`Improved Engine (OOS): Win Rate: ${imprOOS.winRate}% | Bull WR: ${imprOOS.bullWinRate}% | Bear WR: ${imprOOS.bearWinRate}% | Brier: ${imprOOS.brier}`);
console.log(`High-Edge Filter (OOS): Win Rate: ${imprOOS.highEdgeWinRate}% (N=${imprOOS.highEdgeTotal})`);

fs.writeFileSync('oos_comparison.json', JSON.stringify({ origInSample, imprInSample, origOOS, imprOOS }, null, 2));
console.log('\nOOS Comparison saved to oos_comparison.json');
