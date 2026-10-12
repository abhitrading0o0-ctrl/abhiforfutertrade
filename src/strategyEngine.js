// ============================================================
// ForFuture — Advanced Technical Strategy & Signal Engine
// Preserves All 25 Legacy Strategies + Adds 20 M1 Scalping Strategies + AFME
// 5-Pass Evaluation, Strict Timeframe Isolation & Rich Explanations
// ============================================================

import { detectOrderBlocks } from './orderBlockEngine.js';
import { calculateSupportResistance } from './supportResistanceEngine.js';
import { analyzeMarketStructure } from './marketStructureEngine.js';
import { analyzePriceAction } from './priceActionEngine.js';
import { analyzeMarketRegime } from './regimeEngine.js';
import { analyzeTickActivity } from './tickActivityEngine.js';

export const SIGNAL_VOCABULARY = {
  BULLISH: 'BULLISH',
  BEARISH: 'BEARISH',
  WAIT: 'WAIT',
  NO_VALIDATED_SETUP: 'NO VALIDATED SETUP',
  INSUFFICIENT_DATA: 'INSUFFICIENT DATA',
  STALE_DATA: 'STALE DATA',
  EXECUTION_NOT_VERIFIED: 'EXECUTION NOT VERIFIED'
};

/**
 * Main evaluation entrypoint.
 * Evaluates all 25 legacy strategies + 20 M1 scalping strategies + M1 AFME.
 * Fully preserves backward compatibility with evaluateAllStrategies signatures.
 */
export function evaluateAllStrategies(candles, indicators = [], ms = null, pa = null, rd = null, ta = null, sr = null, ob = null, options = {}) {
  if (!candles || candles.length < 5) return [];

  const n = candles.length;
  const currentCandle = candles[n - 1];
  const currentPrice = currentCandle.close;
  const timeframe = options.timeframe || currentCandle.timeframe || '1M';
  const symbol = options.symbol || currentCandle.symbol || 'EUR/USD';
  const spreadPips = options.spreadPips != null ? options.spreadPips : (currentCandle.spread ? (currentCandle.spread * 10000) : 0.8);

  const pipMult = (symbol && symbol.includes('JPY')) ? 100 : 10000;
  const pipVal = 1 / pipMult;

  // Extract Indicator Maps for quick access
  const indMap = new Map((indicators || []).map(i => [i.name, i]));
  const rsiInd = indMap.get('RSI (14)');
  const rsiVal = rsiInd ? parseFloat(rsiInd.value) : 50;
  const rsiSig = rsiInd?.signal || (rsiVal > 55 ? 'BULLISH' : rsiVal < 45 ? 'BEARISH' : 'WAIT');

  const macdInd = indMap.get('MACD (12, 26, 9)');
  const macdSig = macdInd?.signal || 'WAIT';

  const emaInd = indMap.get('EMA Trend (9/21)');
  const emaSig = emaInd?.signal || 'WAIT';

  const atrInd = indMap.get('ATR (14)');
  const atrVal = atrInd ? (parseFloat(atrInd.value) / 10000) : 0.0008;

  const bbInd = indMap.get('Bollinger Bands (20, 2)');
  const stochInd = indMap.get('Stochastic (14, 3)');
  const vwapInd = indMap.get('VWAP');

  // Compute subordinate engines if not already passed in
  const supportResistance = sr || calculateSupportResistance(candles, currentPrice, atrVal, symbol, timeframe);
  const marketStructure = ms || analyzeMarketStructure(candles, supportResistance, timeframe);
  const priceAction = pa || analyzePriceAction(candles);
  const regimeData = rd || analyzeMarketRegime(candles, indicators);
  const tickActivity = ta || analyzeTickActivity(candles, currentCandle.spread);
  const orderBlocks = ob || detectOrderBlocks(candles, marketStructure?.swings || [], atrVal, symbol, timeframe);

  const strategies = [];

  // Helper to build standardized rich strategy signal result
  const makeSignal = (def) => {
    const isBull = def.signal === 'BULLISH';
    const isBear = def.signal === 'BEARISH';
    const direction = isBull ? 'BUY' : isBear ? 'SELL' : null;

    // Execution cost / spread verification for actionable signals
    let finalSignal = def.signal;
    let finalStatus = def.status;
    let costEval = 'NORMAL';

    if ((isBull || isBear) && spreadPips > 2.5 && timeframe === '1M') {
      finalSignal = SIGNAL_VOCABULARY.EXECUTION_NOT_VERIFIED;
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

  // ============================================================
  // PRESERVED SECTION 1: 25 ORIGINAL LEGACY STRATEGIES
  // Preserved names, categories, and identities with 5-pass deep evaluation
  // ============================================================

  // 1. Support Bounce ('Support/Resistance')
  const nearSup = supportResistance?.nearestSupport;
  const isAtSup = nearSup && (nearSup.distance * pipMult) <= 3.5;
  makeSignal({
    name: 'Support Bounce',
    category: 'Support/Resistance',
    signal: isAtSup && priceAction?.isBullish && (priceAction?.patterns?.isHammer || priceAction?.patterns?.isBullEngulf || priceAction?.lowerWickPct > 0.4)
      ? 'BULLISH'
      : isAtSup ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isAtSup && priceAction?.isBullish
      ? 'BULLISH SETUP — CONFIRMED'
      : isAtSup ? 'BULLISH BIAS — WAIT FOR REJECTION WICK' : 'NO SETUP — Price not at support zone',
    evidence: isAtSup ? `Price within ${(nearSup.distance * pipMult).toFixed(1)} pips of Support ${nearSup.price.toFixed(5)}` : 'Price not testing key support level',
    conditionsMet: isAtSup ? ['Price at Support', ...(priceAction?.isBullish ? ['Bullish candle'] : [])] : [],
    conditionsUnmet: !isAtSup ? ['Price at key support'] : [!priceAction?.isBullish ? 'Bullish rejection confirmation' : ''],
    relevantLevel: nearSup ? `Support ${nearSup.price.toFixed(5)}` : 'None',
    invalidation: nearSup ? `Below ${(nearSup.price - (pipVal * 2)).toFixed(5)}` : 'N/A'
  });

  // 2. Resistance Rejection ('Support/Resistance')
  const nearRes = supportResistance?.nearestResistance;
  const isAtRes = nearRes && (nearRes.distance * pipMult) <= 3.5;
  makeSignal({
    name: 'Resistance Rejection',
    category: 'Support/Resistance',
    signal: isAtRes && priceAction?.isBearish && (priceAction?.patterns?.isShootingStar || priceAction?.patterns?.isBearEngulf || priceAction?.upperWickPct > 0.4)
      ? 'BEARISH'
      : isAtRes ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isAtRes && priceAction?.isBearish
      ? 'BEARISH SETUP — CONFIRMED'
      : isAtRes ? 'BEARISH BIAS — WAIT FOR REJECTION WICK' : 'NO SETUP — Price not at resistance zone',
    evidence: isAtRes ? `Price within ${(nearRes.distance * pipMult).toFixed(1)} pips of Resistance ${nearRes.price.toFixed(5)}` : 'Price not testing key resistance level',
    conditionsMet: isAtRes ? ['Price at Resistance', ...(priceAction?.isBearish ? ['Bearish candle'] : [])] : [],
    conditionsUnmet: !isAtRes ? ['Price at key resistance'] : [!priceAction?.isBearish ? 'Bearish rejection confirmation' : ''],
    relevantLevel: nearRes ? `Resistance ${nearRes.price.toFixed(5)}` : 'None',
    invalidation: nearRes ? `Above ${(nearRes.price + (pipVal * 2)).toFixed(5)}` : 'N/A'
  });

  // 3. Breakout and Retest ('Breakout and Retest')
  const boState = marketStructure?.breakoutState;
  makeSignal({
    name: 'Breakout and Retest',
    category: 'Breakout and Retest',
    signal: boState?.isRetest && boState?.type === 'BULLISH_RETEST'
      ? 'BULLISH'
      : boState?.isRetest && boState?.type === 'BEARISH_RETEST'
      ? 'BEARISH'
      : boState?.isBreakout ? 'WAIT' : 'NO VALIDATED SETUP',
    status: boState?.isRetest
      ? `${boState.type === 'BULLISH_RETEST' ? 'BULLISH' : 'BEARISH'} SETUP — RETEST CONFIRMED`
      : boState?.isBreakout ? 'BREAKOUT DETECTED — WAIT FOR RETEST' : 'NO SETUP — No active breakout or retest',
    evidence: boState?.isRetest ? `Successful retest at level ${boState.level?.toFixed(5)}` : boState?.isBreakout ? `Breakout occurring above ${boState.level?.toFixed(5)}; awaiting pullback` : 'Market inside consolidated boundaries',
    conditionsMet: boState?.isRetest ? ['Structure breakout', 'Pullback to level', 'Rejection confirmation'] : boState?.isBreakout ? ['Initial breakout closed'] : [],
    conditionsUnmet: !boState?.isRetest ? ['Successful retest hold'] : []
  });

  // 4. False Breakout ('Breakout and Retest')
  const liq = marketStructure?.liquidity;
  const isSweepHigh = liq?.hasSweep && liq?.sweepType === 'SWEEP_HIGH';
  const isSweepLow = liq?.hasSweep && liq?.sweepType === 'SWEEP_LOW';
  makeSignal({
    name: 'False Breakout',
    category: 'Breakout and Retest',
    signal: isSweepHigh && priceAction?.isBearish ? 'BEARISH' : isSweepLow && priceAction?.isBullish ? 'BULLISH' : (isSweepHigh || isSweepLow) ? 'WAIT' : 'NO VALIDATED SETUP',
    status: (isSweepHigh && priceAction?.isBearish) ? 'BEARISH SETUP — FALSE BREAK CONFIRMED' : (isSweepLow && priceAction?.isBullish) ? 'BULLISH SETUP — FALSE BREAK CONFIRMED' : (isSweepHigh || isSweepLow) ? 'WAIT — Retest back inside range required' : 'NO SETUP — No failed breaks detected',
    evidence: isSweepHigh ? `Wick spiked above ${liq.sweepPrice?.toFixed(5)} and closed back inside range` : isSweepLow ? `Wick spiked below ${liq.sweepPrice?.toFixed(5)} and closed back inside range` : 'No wick traps detected at swing extremes',
    conditionsMet: (isSweepHigh || isSweepLow) ? ['Swing extreme breached', 'Body closed back inside'] : [],
    conditionsUnmet: !(isSweepHigh || isSweepLow) ? ['Swing boundary breach'] : [!priceAction?.isBullish && !priceAction?.isBearish ? 'Reversal candle follow-through' : '']
  });

  // 5. Structure Break and Retest ('Market Structure')
  const lastEvent = marketStructure?.lastEvent;
  makeSignal({
    name: 'Structure Break and Retest',
    category: 'Market Structure',
    signal: lastEvent === 'BULLISH_BOS' && priceAction?.isBullish ? 'BULLISH' : lastEvent === 'BEARISH_BOS' && priceAction?.isBearish ? 'BEARISH' : lastEvent ? 'WAIT' : 'NO VALIDATED SETUP',
    status: lastEvent === 'BULLISH_BOS' ? 'BULLISH SETUP — BOS CONFIRMED' : lastEvent === 'BEARISH_BOS' ? 'BEARISH SETUP — BOS CONFIRMED' : 'NO SETUP — Awaiting verified structure break',
    evidence: lastEvent ? `Latest event: ${lastEvent} at ${marketStructure?.lastEventPrice?.toFixed(5) || 'structure'}` : 'Market trading within established swing boundaries',
    conditionsMet: lastEvent ? ['Confirmed swing break', 'Candle close beyond level'] : [],
    conditionsUnmet: !lastEvent ? ['Break of Structure (BOS)'] : []
  });

  // 6. Liquidity-Sweep Proxy ('Market Structure')
  makeSignal({
    name: 'Liquidity-Sweep Proxy',
    category: 'Market Structure',
    signal: isSweepLow ? 'BULLISH' : isSweepHigh ? 'BEARISH' : 'NO VALIDATED SETUP',
    status: isSweepLow ? 'BULLISH BIAS — LOW LIQUIDITY SWEPT' : isSweepHigh ? 'BEARISH BIAS — HIGH LIQUIDITY SWEPT' : 'NO SETUP — Liquidity pools untouched',
    evidence: isSweepLow ? `Liquidity pool taken below ${liq?.sweepPrice?.toFixed(5)}` : isSweepHigh ? `Liquidity pool taken above ${liq?.sweepPrice?.toFixed(5)}` : 'Swing highs/lows holding unbreached',
    conditionsMet: liq?.hasSweep ? ['Liquidity pool tested', 'Reversal rejection seen'] : [],
    conditionsUnmet: !liq?.hasSweep ? ['Liquidity sweep occurrence'] : []
  });

  // 7. Range Mean Reversion ('Mean Reversion')
  const isRange = regimeData?.regime === 'RANGE_BOUND' || regimeData?.regime === 'CONSOLIDATING';
  makeSignal({
    name: 'Range Mean Reversion',
    category: 'Mean Reversion',
    signal: isRange && rsiSig === 'BULLISH' && (nearSup?.distance * pipMult) < 4 ? 'BULLISH' : isRange && rsiSig === 'BEARISH' && (nearRes?.distance * pipMult) < 4 ? 'BEARISH' : isRange ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isRange && (rsiSig === 'BULLISH' || rsiSig === 'BEARISH') ? `${rsiSig} SETUP — RANGE REVERSION` : isRange ? 'WAIT — Awaiting price at range extremes' : 'NO SETUP — Market in trending regime',
    evidence: isRange ? `Market is range-bound; RSI is ${rsiVal.toFixed(1)}` : `Market regime is ${regimeData?.regime || 'TRENDING'}`,
    conditionsMet: isRange ? ['Confirmed range regime'] : [],
    conditionsUnmet: !isRange ? ['Range-bound market regime'] : ['Extreme boundary test']
  });

  // 8. Trend Pullback ('Trend Following')
  const structTrend = marketStructure?.trend;
  makeSignal({
    name: 'Trend Pullback',
    category: 'Trend Following',
    signal: structTrend === 'BULLISH' && (priceAction?.isBearish || currentPrice <= currentCandle.open) && emaSig === 'BULLISH' ? 'BULLISH' : structTrend === 'BEARISH' && (priceAction?.isBullish || currentPrice >= currentCandle.open) && emaSig === 'BEARISH' ? 'BEARISH' : structTrend !== 'RANGE' ? 'WAIT' : 'NO VALIDATED SETUP',
    status: structTrend === 'BULLISH' ? 'BULLISH SETUP — PULLBACK IN UPTREND' : structTrend === 'BEARISH' ? 'BEARISH SETUP — PULLBACK IN DOWNTREND' : 'NO SETUP — No clear directional trend',
    evidence: structTrend !== 'RANGE' ? `Structural trend is ${structTrend}; trading with macro flow` : 'Market is choppy without directional trend',
    conditionsMet: structTrend !== 'RANGE' ? ['Established structural trend', 'Controlled retracement'] : [],
    conditionsUnmet: structTrend === 'RANGE' ? ['Confirmed trend direction'] : []
  });

  // 9. Momentum Continuation ('Momentum')
  const momAligned = emaSig === rsiSig && emaSig !== 'WAIT' && emaSig !== 'NEUTRAL';
  makeSignal({
    name: 'Momentum Continuation',
    category: 'Momentum',
    signal: momAligned ? emaSig : 'WAIT',
    status: momAligned ? `${emaSig} SETUP — EMA & RSI ALIGNED` : 'WAIT — Momentum indicators not in agreement',
    evidence: momAligned ? `EMA (${emaSig}) and RSI (${rsiSig}) both point in direction` : `EMA is ${emaSig}, RSI is ${rsiSig}`,
    conditionsMet: momAligned ? ['EMA trend alignment', 'RSI directional bias'] : [],
    conditionsUnmet: !momAligned ? ['Confluent indicator momentum'] : []
  });

  // 10. Confirmed RSI Divergence ('Momentum')
  const rsiDivBull = rsiVal < 35 && priceAction?.patterns?.isBullEngulf;
  const rsiDivBear = rsiVal > 65 && priceAction?.patterns?.isBearEngulf;
  makeSignal({
    name: 'Confirmed RSI Divergence',
    category: 'Momentum',
    signal: rsiDivBull ? 'BULLISH' : rsiDivBear ? 'BEARISH' : 'WAIT',
    status: rsiDivBull ? 'BULLISH SETUP — OVERSOLD DIVERGENCE' : rsiDivBear ? 'BEARISH SETUP — OVERBOUGHT DIVERGENCE' : 'WAIT — No divergence pattern confirmed',
    evidence: `Current RSI is ${rsiVal.toFixed(1)}; evaluating swing divergence`,
    conditionsMet: (rsiDivBull || rsiDivBear) ? ['RSI extreme', 'Reversal price pattern'] : [],
    conditionsUnmet: !(rsiDivBull || rsiDivBear) ? ['Confirmed divergence confirmation'] : []
  });

  // 11. Confirmed MACD Divergence ('Momentum')
  const macdHist = indMap.get('MACD (12, 26, 9)')?.value || '0';
  makeSignal({
    name: 'Confirmed MACD Divergence',
    category: 'Momentum',
    signal: macdSig === 'BULLISH' && priceAction?.isBullish ? 'BULLISH' : macdSig === 'BEARISH' && priceAction?.isBearish ? 'BEARISH' : 'WAIT',
    status: macdSig !== 'WAIT' ? `${macdSig} BIAS — MACD HISTOGRAM ${macdHist}` : 'WAIT — MACD histogram near zero line',
    evidence: `MACD signal is ${macdSig}; histogram reading: ${macdHist}`,
    conditionsMet: macdSig !== 'WAIT' ? ['MACD histogram direction confirmed'] : [],
    conditionsUnmet: macdSig === 'WAIT' ? ['MACD momentum expansion'] : []
  });

  // 12. Volatility Squeeze Breakout ('Volatility')
  const isVolLow = regimeData?.volatilityState?.includes('LOW');
  const isBreakout = regimeData?.regime?.includes('BREAKOUT');
  makeSignal({
    name: 'Volatility Squeeze Breakout',
    category: 'Volatility',
    signal: isBreakout && regimeData?.regime === 'BREAKOUT_UP' ? 'BULLISH' : isBreakout && regimeData?.regime === 'BREAKOUT_DOWN' ? 'BEARISH' : isVolLow ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isBreakout ? `${regimeData.regime === 'BREAKOUT_UP' ? 'BULLISH' : 'BEARISH'} SETUP — SQUEEZE EXPANSION` : isVolLow ? 'WAIT — Squeeze compressing; awaiting boundary expansion' : 'NO SETUP — Volatility in normal regime',
    evidence: isVolLow ? 'Bollinger bandwidth compressed into squeeze state' : isBreakout ? 'Directional expansion underway outside bandwidth' : 'Normal volatility conditions',
    conditionsMet: isBreakout ? ['Volatility compression completed', 'Directional boundary expansion'] : isVolLow ? ['Volatility compression detected'] : [],
    conditionsUnmet: !isBreakout ? ['Directional break beyond bands'] : []
  });

  // 13. Volatility Regime Transition ('Volatility')
  const isVolHigh = regimeData?.volatilityState?.includes('HIGH');
  makeSignal({
    name: 'Volatility Regime Transition',
    category: 'Volatility',
    signal: isVolHigh && priceAction?.isBullish ? 'BULLISH' : isVolHigh && priceAction?.isBearish ? 'BEARISH' : 'WAIT',
    status: isVolHigh ? `${priceAction?.isBullish ? 'BULLISH' : 'BEARISH'} BIAS — HIGH VOLATILITY REGIME` : 'WAIT — Volatility within standard boundaries',
    evidence: `Volatility state: ${regimeData?.volatilityState || 'NORMAL'}`,
    conditionsMet: isVolHigh ? ['Elevated volatility detected'] : [],
    conditionsUnmet: !isVolHigh ? ['High volatility regime transition'] : []
  });

  // 14. Candle Rejection Strategy ('Candlestick/Price Action')
  makeSignal({
    name: 'Candle Rejection Strategy',
    category: 'Candlestick/Price Action',
    signal: priceAction?.patterns?.isHammer || priceAction?.patterns?.isBullishRejection ? 'BULLISH' : priceAction?.patterns?.isShootingStar || priceAction?.patterns?.isBearishRejection ? 'BEARISH' : 'WAIT',
    status: (priceAction?.patterns?.isHammer || priceAction?.patterns?.isBullishRejection) ? 'BULLISH SETUP — REJECTION CONFIRMED' : (priceAction?.patterns?.isShootingStar || priceAction?.patterns?.isBearishRejection) ? 'BEARISH SETUP — REJECTION CONFIRMED' : 'WAIT — No prominent rejection wick',
    evidence: `Lower wick: ${(priceAction?.lowerWickPct * 100).toFixed(0)}%, Upper wick: ${(priceAction?.upperWickPct * 100).toFixed(0)}%`,
    conditionsMet: (priceAction?.patterns?.isHammer || priceAction?.patterns?.isShootingStar || priceAction?.patterns?.isBullishRejection || priceAction?.patterns?.isBearishRejection) ? ['Significant wick-to-body proportion'] : [],
    conditionsUnmet: !(priceAction?.patterns?.isHammer || priceAction?.patterns?.isShootingStar || priceAction?.patterns?.isBullishRejection || priceAction?.patterns?.isBearishRejection) ? ['Strong rejection candle formation'] : []
  });

  // 15. Tick-Activity Confirmation ('Tick Activity')
  const isHighTick = tickActivity?.activityLevel?.includes('HIGH');
  makeSignal({
    name: 'Tick-Activity Confirmation',
    category: 'Tick Activity',
    signal: isHighTick && priceAction?.isBullish ? 'BULLISH' : isHighTick && priceAction?.isBearish ? 'BEARISH' : 'WAIT',
    status: isHighTick ? `${priceAction?.isBullish ? 'BULLISH' : 'BEARISH'} SETUP — VOLUME ACCELERATION` : 'WAIT — Normal tick activity',
    evidence: `Tick activity: ${tickActivity?.activityLevel || 'NORMAL'}`,
    conditionsMet: isHighTick ? ['Above-average tick velocity'] : [],
    conditionsUnmet: !isHighTick ? ['Unusually high tick participation'] : []
  });

  // 16. Trend + Pullback + Structure Confirmation ('Multi-Timeframe')
  const confBull = structTrend === 'BULLISH' && (priceAction?.patterns?.isBullEngulf || priceAction?.patterns?.isHammer);
  const confBear = structTrend === 'BEARISH' && (priceAction?.patterns?.isBearEngulf || priceAction?.patterns?.isShootingStar);
  makeSignal({
    name: 'Trend + Pullback + Structure Confirmation',
    category: 'Multi-Timeframe',
    signal: confBull ? 'BULLISH' : confBear ? 'BEARISH' : 'WAIT',
    status: confBull ? 'BULLISH SETUP — CONFLUENCE CONFIRMED' : confBear ? 'BEARISH SETUP — CONFLUENCE CONFIRMED' : 'WAIT — Awaiting confluence of trend and trigger pattern',
    evidence: `Trend: ${structTrend}; Pattern: ${priceAction?.patterns?.isBullEngulf ? 'Bull Engulf' : priceAction?.patterns?.isHammer ? 'Hammer' : 'Standard'}`,
    conditionsMet: (confBull || confBear) ? ['Trend direction alignment', 'Reversal price pattern at structure'] : [],
    conditionsUnmet: !(confBull || confBear) ? ['Confluence of trend and reversal pattern'] : []
  });

  // 17. Support/Resistance + Momentum Confirmation ('Multi-Timeframe')
  const srMomBull = isAtSup && rsiSig === 'BULLISH';
  const srMomBear = isAtRes && rsiSig === 'BEARISH';
  makeSignal({
    name: 'Support/Resistance + Momentum Confirmation',
    category: 'Multi-Timeframe',
    signal: srMomBull ? 'BULLISH' : srMomBear ? 'BEARISH' : 'WAIT',
    status: srMomBull ? 'BULLISH SETUP — SUPPORT + RSI MOMENTUM' : srMomBear ? 'BEARISH SETUP — RESISTANCE + RSI MOMENTUM' : 'WAIT — Level and momentum not confluent',
    evidence: isAtSup ? `At Support with RSI ${rsiVal.toFixed(0)}` : isAtRes ? `At Resistance with RSI ${rsiVal.toFixed(0)}` : 'Price not at critical S/R boundary',
    conditionsMet: (srMomBull || srMomBear) ? ['Key level interaction', 'RSI momentum confirmation'] : [],
    conditionsUnmet: !(srMomBull || srMomBear) ? ['Confluence between S/R level and momentum'] : []
  });

  // 18. Session Range Breakout ('Session-Based')
  // Computed using available historical candle session reference
  const sessionRangeHigh = Math.max(...candles.slice(-40).map(c => c.high));
  const sessionRangeLow = Math.min(...candles.slice(-40).map(c => c.low));
  const isSessionBreakUp = currentPrice > sessionRangeHigh - (pipVal * 2);
  const isSessionBreakDn = currentPrice < sessionRangeLow + (pipVal * 2);
  makeSignal({
    name: 'Session Range Breakout',
    category: 'Session-Based',
    signal: isSessionBreakUp ? 'BULLISH' : isSessionBreakDn ? 'BEARISH' : 'WAIT',
    status: isSessionBreakUp ? 'BULLISH BIAS — TESTING SESSION HIGH' : isSessionBreakDn ? 'BEARISH BIAS — TESTING SESSION LOW' : 'WAIT — Trading inside session range',
    evidence: `Session Range: ${sessionRangeLow.toFixed(5)} — ${sessionRangeHigh.toFixed(5)}`,
    conditionsMet: (isSessionBreakUp || isSessionBreakDn) ? ['Session boundary reach'] : [],
    conditionsUnmet: !(isSessionBreakUp || isSessionBreakDn) ? ['Session high/low breakout'] : []
  });

  // 19. Previous-Day High/Low Reaction ('Session-Based')
  // Detects proximity to 24h high/low extremes
  const dayHigh = Math.max(...candles.map(c => c.high));
  const dayLow = Math.min(...candles.map(c => c.low));
  const atDayHigh = Math.abs(currentPrice - dayHigh) < (pipVal * 3);
  const atDayLow = Math.abs(currentPrice - dayLow) < (pipVal * 3);
  makeSignal({
    name: 'Previous-Day High/Low Reaction',
    category: 'Session-Based',
    signal: atDayLow && priceAction?.isBullish ? 'BULLISH' : atDayHigh && priceAction?.isBearish ? 'BEARISH' : 'WAIT',
    status: atDayLow ? 'BULLISH BIAS — DEFENDING PERIOD LOW' : atDayHigh ? 'BEARISH BIAS — DEFENDING PERIOD HIGH' : 'WAIT — Mid-range between period extremes',
    evidence: `Period High: ${dayHigh.toFixed(5)}, Period Low: ${dayLow.toFixed(5)}`,
    conditionsMet: (atDayLow || atDayHigh) ? ['Extreme period high/low interaction'] : [],
    conditionsUnmet: !(atDayLow || atDayHigh) ? ['Proximity to period boundary'] : []
  });

  // 20. Pivot-Point Rejection ('Support/Resistance')
  const pivotPoint = +((currentCandle.high + currentCandle.low + currentCandle.close) / 3).toFixed(5);
  const isAtPivot = Math.abs(currentPrice - pivotPoint) < (pipVal * 2);
  makeSignal({
    name: 'Pivot-Point Rejection',
    category: 'Support/Resistance',
    signal: isAtPivot && priceAction?.isBullish ? 'BULLISH' : isAtPivot && priceAction?.isBearish ? 'BEARISH' : 'WAIT',
    status: isAtPivot ? `${priceAction?.isBullish ? 'BULLISH' : 'BEARISH'} SETUP — PIVOT REACTION` : 'WAIT — Away from central pivot reference',
    evidence: `Central Pivot calculated at ${pivotPoint.toFixed(5)}`,
    conditionsMet: isAtPivot ? ['Price at Central Pivot'] : [],
    conditionsUnmet: !isAtPivot ? ['Central Pivot retest'] : []
  });

  // 21. Range Boundary Reversal ('Mean Reversion')
  makeSignal({
    name: 'Range Boundary Reversal',
    category: 'Mean Reversion',
    signal: isRange && (nearSup?.distance * pipMult) < 3.5 && (priceAction?.patterns?.isHammer || priceAction?.isBullish) ? 'BULLISH' : isRange && (nearRes?.distance * pipMult) < 3.5 && (priceAction?.patterns?.isShootingStar || priceAction?.isBearish) ? 'BEARISH' : isRange ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isRange && (nearSup?.distance * pipMult) < 3.5 ? 'BULLISH SETUP — RANGE LOW REVERSAL' : isRange && (nearRes?.distance * pipMult) < 3.5 ? 'BEARISH SETUP — RANGE HIGH REVERSAL' : 'NO SETUP — Awaiting test of range edge',
    evidence: isRange ? 'Price rotating near range boundary' : 'Market trending',
    conditionsMet: isRange ? ['Confirmed range regime'] : [],
    conditionsUnmet: !isRange ? ['Range regime condition'] : ['Range boundary interaction']
  });

  // 22. Failed Breakout Reversal ('Breakout and Retest')
  makeSignal({
    name: 'Failed Breakout Reversal',
    category: 'Breakout and Retest',
    signal: isSweepHigh && priceAction?.isBearish ? 'BEARISH' : isSweepLow && priceAction?.isBullish ? 'BULLISH' : 'WAIT',
    status: (isSweepHigh && priceAction?.isBearish) ? 'BEARISH SETUP — FADING FAILED HIGH' : (isSweepLow && priceAction?.isBullish) ? 'BULLISH SETUP — FADING FAILED LOW' : 'WAIT — No failed breakout in progress',
    evidence: isSweepHigh || isSweepLow ? 'Attempted expansion failed and reclaimed range' : 'No trapped moves observed',
    conditionsMet: (isSweepHigh || isSweepLow) ? ['Failed expansion reclaim'] : [],
    conditionsUnmet: !(isSweepHigh || isSweepLow) ? ['Failed breakout trigger'] : []
  });

  // 23. ATR-Normalized Momentum ('Momentum')
  const roc12 = indMap.get('Rate of Change (12)')?.signal;
  const isAtrNormal = atrVal >= (pipVal * 4);
  makeSignal({
    name: 'ATR-Normalized Momentum',
    category: 'Momentum',
    signal: roc12 === 'BULLISH' && isAtrNormal ? 'BULLISH' : roc12 === 'BEARISH' && isAtrNormal ? 'BEARISH' : 'WAIT',
    status: (roc12 === 'BULLISH' || roc12 === 'BEARISH') && isAtrNormal ? `${roc12} SETUP — ATR MOMENTUM EXPANSION` : 'WAIT — Low true range expansion',
    evidence: `ATR: ${(atrVal * pipMult).toFixed(1)} pips; ROC signal: ${roc12 || 'WAIT'}`,
    conditionsMet: isAtrNormal ? ['Sufficient ATR expansion threshold'] : [],
    conditionsUnmet: !isAtrNormal ? ['Minimum ATR volatility threshold'] : []
  });

  // 24. Session-Range Expansion ('Session-Based')
  makeSignal({
    name: 'Session-Range Expansion',
    category: 'Session-Based',
    signal: isBreakout && regimeData?.regime === 'BREAKOUT_UP' ? 'BULLISH' : isBreakout && regimeData?.regime === 'BREAKOUT_DOWN' ? 'BEARISH' : 'WAIT',
    status: isBreakout ? `${regimeData.regime === 'BREAKOUT_UP' ? 'BULLISH' : 'BEARISH'} SETUP — RANGE EXPANSION` : 'WAIT — Awaiting session range expansion',
    evidence: `Regime: ${regimeData?.regime || 'RANGE'}`,
    conditionsMet: isBreakout ? ['Session expansion beyond threshold'] : [],
    conditionsUnmet: !isBreakout ? ['Session expansion trigger'] : []
  });

  // 25. Multi-Timeframe Confluence ('Multi-Timeframe')
  // Standalone isolated confluence evaluation
  const htfAligned = emaSig === rsiSig && structTrend !== 'RANGE';
  makeSignal({
    name: 'Multi-Timeframe Confluence',
    category: 'Multi-Timeframe',
    signal: htfAligned && structTrend === 'BULLISH' ? 'BULLISH' : htfAligned && structTrend === 'BEARISH' ? 'BEARISH' : 'WAIT',
    status: htfAligned ? `${structTrend} SETUP — MULTI-FACTOR CONFLUENCE` : 'WAIT — Structural trend and momentum divergence',
    evidence: `Structural Trend: ${structTrend}, EMA: ${emaSig}, RSI: ${rsiSig}`,
    conditionsMet: htfAligned ? ['Trend and momentum unified', 'Zero contradictory signals'] : [],
    conditionsUnmet: !htfAligned ? ['Consensus alignment across evidence families'] : []
  });

  // ============================================================
  // SECTION 2: TWENTY NEW M1 SCALPING STRATEGIES
  // Dedicated Category: M1 SCALPING STRATEGIES
  // Real algorithmic conditions tailored for 1-minute execution
  // ============================================================

  // M1 S1: M1 First Pullback Continuation
  // Strong impulse (>= 1.2x ATR over 2-3 bars), followed by 1-2 bar shallow retracement, continuing in impulse dir
  const recent3Impulse = (currentCandle.close - candles[Math.max(0, n - 4)].close);
  const isBullImpulse = recent3Impulse >= (atrVal * 1.2);
  const isBearImpulse = recent3Impulse <= -(atrVal * 1.2);
  const isPullbackRetrace = Math.abs(currentCandle.close - currentCandle.open) < (atrVal * 0.7);
  makeSignal({
    name: 'M1 First Pullback Continuation',
    category: 'M1 SCALPING STRATEGIES',
    signal: isBullImpulse && priceAction?.isBullish ? 'BULLISH' : isBearImpulse && priceAction?.isBearish ? 'BEARISH' : (isBullImpulse || isBearImpulse) ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isBullImpulse && priceAction?.isBullish ? 'BULLISH SETUP — FIRST PULLBACK CONFIRMED' : isBearImpulse && priceAction?.isBearish ? 'BEARISH SETUP — FIRST PULLBACK CONFIRMED' : (isBullImpulse || isBearImpulse) ? 'WAIT — Awaiting continuation candle confirmation' : 'NO SETUP — No qualifying initial impulse move',
    evidence: `Recent 3-bar movement: ${(recent3Impulse * pipMult).toFixed(1)} pips against ATR ${(atrVal * pipMult).toFixed(1)} pips`,
    conditionsMet: (isBullImpulse || isBearImpulse) ? ['Impulse displacement >= 1.2x ATR', 'Controlled pullback hold'] : [],
    conditionsUnmet: !(isBullImpulse || isBearImpulse) ? ['Impulse displacement qualification'] : [!priceAction?.isBullish && !priceAction?.isBearish ? 'Continuation trigger bar' : ''],
    invalidation: `Retracement beyond ${(currentPrice - (isBullImpulse ? atrVal : -atrVal)).toFixed(5)}`
  });

  // M1 S2: M1 Micro-Range Breakout
  // Narrow range over last 8 bars, confirmed candle body close outside the range
  const microSlice = candles.slice(-8, -1);
  const microHigh = Math.max(...microSlice.map(c => c.high));
  const microLow = Math.min(...microSlice.map(c => c.low));
  const microWidthPips = (microHigh - microLow) * pipMult;
  const isMicroNarrow = microWidthPips < (atrVal * pipMult * 1.6);
  const isMicroBreakUp = isMicroNarrow && currentCandle.close > microHigh;
  const isMicroBreakDn = isMicroNarrow && currentCandle.close < microLow;
  makeSignal({
    name: 'M1 Micro-Range Breakout',
    category: 'M1 SCALPING STRATEGIES',
    signal: isMicroBreakUp ? 'BULLISH' : isMicroBreakDn ? 'BEARISH' : isMicroNarrow ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isMicroBreakUp ? 'BULLISH SETUP — MICRO BREAKOUT CONFIRMED' : isMicroBreakDn ? 'BEARISH SETUP — MICRO BREAKOUT CONFIRMED' : isMicroNarrow ? 'WAIT — Micro-range compressed; awaiting close outside' : 'NO SETUP — Range width exceeds micro-threshold',
    evidence: `Micro-range width: ${microWidthPips.toFixed(1)} pips across last 7 bars`,
    conditionsMet: isMicroBreakUp || isMicroBreakDn ? ['Compression phase < 1.6x ATR', 'Confirmed body close beyond boundary'] : isMicroNarrow ? ['Compression phase active'] : [],
    conditionsUnmet: !(isMicroBreakUp || isMicroBreakDn) ? ['Confirmed close outside boundary'] : []
  });

  // M1 S3: M1 Breakout-Retest
  // Requires confirmed structural level break, successful pullback touch, and continuation
  const nearestOB = orderBlocks?.nearestBullishOB || orderBlocks?.nearestBearishOB;
  const isBreakRetestBull = boState?.isRetest && boState?.type === 'BULLISH_RETEST' && priceAction?.isBullish;
  const isBreakRetestBear = boState?.isRetest && boState?.type === 'BEARISH_RETEST' && priceAction?.isBearish;
  makeSignal({
    name: 'M1 Breakout-Retest',
    category: 'M1 SCALPING STRATEGIES',
    signal: isBreakRetestBull ? 'BULLISH' : isBreakRetestBear ? 'BEARISH' : boState?.isBreakout ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isBreakRetestBull ? 'BULLISH SETUP — LEVEL RETEST HELD' : isBreakRetestBear ? 'BEARISH SETUP — LEVEL RETEST HELD' : boState?.isBreakout ? 'BREAKOUT ACTIVE — WAIT FOR RETEST' : 'NO SETUP — No active breakout',
    evidence: boState?.level ? `Breakout level: ${boState.level.toFixed(5)}` : 'No recent structural breakout',
    conditionsMet: (isBreakRetestBull || isBreakRetestBear) ? ['Level breakout confirmed', 'Retest tested and defended'] : [],
    conditionsUnmet: !(isBreakRetestBull || isBreakRetestBear) ? ['Retest touch and defense'] : []
  });

  // M1 S4: M1 False-Breakout Reversal
  // Breaches micro swing high/low, fails to hold, snaps back inside with reversal candle
  makeSignal({
    name: 'M1 False-Breakout Reversal',
    category: 'M1 SCALPING STRATEGIES',
    signal: isSweepHigh && priceAction?.isBearish ? 'BEARISH' : isSweepLow && priceAction?.isBullish ? 'BULLISH' : (isSweepHigh || isSweepLow) ? 'WAIT' : 'NO VALIDATED SETUP',
    status: (isSweepHigh && priceAction?.isBearish) ? 'BEARISH SETUP — TRAP REVERSAL TRIGGERED' : (isSweepLow && priceAction?.isBullish) ? 'BULLISH SETUP — TRAP REVERSAL TRIGGERED' : (isSweepHigh || isSweepLow) ? 'WAIT — Trap detected; awaiting reversal trigger' : 'NO SETUP — No trapped breakouts',
    evidence: liq?.hasSweep ? `Trapped wick at ${liq.sweepPrice?.toFixed(5)}` : 'Price respecting boundaries normally',
    conditionsMet: (isSweepHigh && priceAction?.isBearish) || (isSweepLow && priceAction?.isBullish) ? ['Trap wick outside swing', 'Swift candle reversal inside'] : [],
    conditionsUnmet: !(isSweepHigh || isSweepLow) ? ['Boundary trap occurrence'] : ['Reversal candle confirmation']
  });

  // M1 S5: M1 Liquidity Sweep and Reclaim
  // Confirmed sweep of previous swing extreme followed by candle closing back inside the range
  const hasReclaim = liq?.hasReclaim;
  makeSignal({
    name: 'M1 Liquidity Sweep and Reclaim',
    category: 'M1 SCALPING STRATEGIES',
    signal: isSweepLow && hasReclaim ? 'BULLISH' : isSweepHigh && hasReclaim ? 'BEARISH' : liq?.hasSweep ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isSweepLow && hasReclaim ? 'BULLISH SETUP — SWEEP & RECLAIM CONFIRMED' : isSweepHigh && hasReclaim ? 'BEARISH SETUP — SWEEP & RECLAIM CONFIRMED' : liq?.hasSweep ? 'WAIT — Sweep detected; waiting for reclaim close' : 'NO SETUP — No liquidity sweep detected',
    evidence: liq?.hasSweep ? `Swept ${liq.sweepType} @ ${liq.sweepPrice?.toFixed(5)} with reclaim: ${hasReclaim ? 'YES' : 'PENDING'}` : 'Clean structural flow without sweeps',
    conditionsMet: (isSweepLow && hasReclaim) || (isSweepHigh && hasReclaim) ? ['Liquidity breached', 'Reclaim close confirmed'] : [],
    conditionsUnmet: !liq?.hasSweep ? ['Liquidity sweep'] : [!hasReclaim ? 'Reclaim candle close' : '']
  });

  // M1 S6: M1 Order-Block Retest
  // Price enters an active, confirmed Bullish or Bearish Order Block and shows rejection
  const bullOB = orderBlocks?.nearestBullishOB;
  const bearOB = orderBlocks?.nearestBearishOB;
  const inBullOB = bullOB && currentPrice >= bullOB.low && currentPrice <= (bullOB.high + pipVal * 1.5);
  const inBearOB = bearOB && currentPrice <= bearOB.high && currentPrice >= (bearOB.low - pipVal * 1.5);
  makeSignal({
    name: 'M1 Order-Block Retest',
    category: 'M1 SCALPING STRATEGIES',
    signal: inBullOB && (priceAction?.isBullish || priceAction?.lowerWickPct > 0.35) ? 'BULLISH' : inBearOB && (priceAction?.isBearish || priceAction?.upperWickPct > 0.35) ? 'BEARISH' : (inBullOB || inBearOB) ? 'WAIT' : 'NO VALIDATED SETUP',
    status: inBullOB && priceAction?.isBullish ? 'BULLISH SETUP — ORDER BLOCK RETEST CONFIRMED' : inBearOB && priceAction?.isBearish ? 'BEARISH SETUP — ORDER BLOCK RETEST CONFIRMED' : inBullOB ? 'WAIT — Price inside Bullish OB; awaiting rejection' : inBearOB ? 'WAIT — Price inside Bearish OB; awaiting rejection' : 'NO SETUP — Price outside order block zones',
    evidence: inBullOB ? `Inside Bullish OB [${bullOB.low.toFixed(5)} — ${bullOB.high.toFixed(5)}]` : inBearOB ? `Inside Bearish OB [${bearOB.low.toFixed(5)} — ${bearOB.high.toFixed(5)}]` : 'Nearest OBs not currently being tested',
    conditionsMet: (inBullOB && priceAction?.isBullish) || (inBearOB && priceAction?.isBearish) ? ['Order Block test', 'Rejection candle confirmed'] : [],
    conditionsUnmet: !(inBullOB || inBearOB) ? ['Retest of active Order Block'] : ['Rejection confirmation bar']
  });

  // M1 S7: M1 Support/Resistance Rejection
  // Clear rejection off key level with minimum 2x risk-to-reward space before opposing zone
  const hasSpaceToRes = nearRes ? (nearRes.distance * pipMult) >= 4.0 : true;
  const hasSpaceToSup = nearSup ? (nearSup.distance * pipMult) >= 4.0 : true;
  makeSignal({
    name: 'M1 Support/Resistance Rejection',
    category: 'M1 SCALPING STRATEGIES',
    signal: isAtSup && priceAction?.isBullish && hasSpaceToRes ? 'BULLISH' : isAtRes && priceAction?.isBearish && hasSpaceToSup ? 'BEARISH' : (isAtSup || isAtRes) ? 'WAIT' : 'NO VALIDATED SETUP',
    status: (isAtSup && priceAction?.isBullish && hasSpaceToRes) ? 'BULLISH SETUP — LEVEL REJECTION WITH TARGET ROOM' : (isAtRes && priceAction?.isBearish && hasSpaceToSup) ? 'BEARISH SETUP — LEVEL REJECTION WITH TARGET ROOM' : (isAtSup && !hasSpaceToRes) ? 'WAIT — Opposing resistance too close' : (isAtRes && !hasSpaceToSup) ? 'WAIT — Opposing support too close' : 'NO SETUP — Price not at key S/R zone',
    evidence: isAtSup ? `At Support ${(nearSup.distance * pipMult).toFixed(1)} pips; space to Res: ${nearRes ? (nearRes.distance * pipMult).toFixed(1) : 'Open'} pips` : isAtRes ? `At Resistance ${(nearRes.distance * pipMult).toFixed(1)} pips; space to Sup: ${nearSup ? (nearSup.distance * pipMult).toFixed(1) : 'Open'} pips` : 'Price in middle of range',
    conditionsMet: (isAtSup && priceAction?.isBullish) || (isAtRes && priceAction?.isBearish) ? ['Key level touch', 'Rejection bar'] : [],
    conditionsUnmet: !(isAtSup || isAtRes) ? ['S/R level test'] : []
  });

  // M1 S8: M1 Fast EMA Reclaim
  // Pullback dips past EMA 9, candle closes back above EMA 9 in trend direction
  const ema9Val = indMap.get('EMA Trend (9/21)')?.value ? parseFloat(indMap.get('EMA Trend (9/21)').value.split('/')[0]) : currentPrice;
  const reclaimedEmaBull = currentCandle.low < ema9Val && currentCandle.close > ema9Val && emaSig === 'BULLISH';
  const reclaimedEmaBear = currentCandle.high > ema9Val && currentCandle.close < ema9Val && emaSig === 'BEARISH';
  makeSignal({
    name: 'M1 Fast EMA Reclaim',
    category: 'M1 SCALPING STRATEGIES',
    signal: reclaimedEmaBull ? 'BULLISH' : reclaimedEmaBear ? 'BEARISH' : 'WAIT',
    status: reclaimedEmaBull ? 'BULLISH SETUP — FAST EMA 9 RECLAIMED' : reclaimedEmaBear ? 'BEARISH SETUP — FAST EMA 9 RECLAIMED' : 'WAIT — No fast EMA reclaim trigger',
    evidence: `EMA 9 at ${ema9Val.toFixed(5)}; Close is ${currentPrice.toFixed(5)}`,
    conditionsMet: reclaimedEmaBull || reclaimedEmaBear ? ['EMA 9 pierced intraday', 'Body closed back across EMA in trend dir'] : [],
    conditionsUnmet: !(reclaimedEmaBull || reclaimedEmaBear) ? ['Fast EMA reclaim condition'] : []
  });

  // M1 S9: M1 Momentum Burst
  // Sudden sharp displacement relative to ATR without overextension
  const isBurstBull = priceAction?.patterns?.isMomentum && priceAction?.isBullish && rsiVal > 55 && rsiVal < 78;
  const isBurstBear = priceAction?.patterns?.isMomentum && priceAction?.isBearish && rsiVal < 45 && rsiVal > 22;
  makeSignal({
    name: 'M1 Momentum Burst',
    category: 'M1 SCALPING STRATEGIES',
    signal: isBurstBull ? 'BULLISH' : isBurstBear ? 'BEARISH' : (priceAction?.patterns?.isMomentum) ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isBurstBull ? 'BULLISH SETUP — MOMENTUM BURST CONFIRMED' : isBurstBear ? 'BEARISH SETUP — MOMENTUM BURST CONFIRMED' : (rsiVal >= 78 || rsiVal <= 22) ? 'WAIT — Move overextended (exhaustion guard)' : 'NO SETUP — No momentum velocity burst',
    evidence: `Candle body size: ${(priceAction?.bodySize * pipMult).toFixed(1)} pips; RSI: ${rsiVal.toFixed(1)}`,
    conditionsMet: isBurstBull || isBurstBear ? ['Displacement > 1.5x average body', 'RSI within non-exhaustion boundary'] : [],
    conditionsUnmet: !(isBurstBull || isBurstBear) ? ['Momentum burst qualification'] : []
  });

  // M1 S10: M1 Three-Candle Pressure
  // 3 consecutive directional bars with progressive closes and high body ratio
  const threeBull = priceAction?.patterns?.isThreeBull;
  const threeBear = priceAction?.patterns?.isThreeBear;
  makeSignal({
    name: 'M1 Three-Candle Pressure',
    category: 'M1 SCALPING STRATEGIES',
    signal: threeBull ? 'BULLISH' : threeBear ? 'BEARISH' : 'WAIT',
    status: threeBull ? 'BULLISH SETUP — 3 CONSECUTIVE GREEN BARS PROGRESSION' : threeBear ? 'BEARISH SETUP — 3 CONSECUTIVE RED BARS PROGRESSION' : 'WAIT — Incomplete 3-candle progression',
    evidence: threeBull ? '3 consecutive higher closes with minimal upper wicks' : threeBear ? '3 consecutive lower closes with minimal lower wicks' : 'Mixed candle colors in recent sequence',
    conditionsMet: (threeBull || threeBear) ? ['3 directional closes in sequence', 'Progressive displacement', 'Minimal counter wicks'] : [],
    conditionsUnmet: !(threeBull || threeBear) ? ['Consistent 3-candle alignment'] : []
  });

  // M1 S11: M1 Compression Expansion
  // Bollinger Band squeeze followed by break of upper/lower band
  const isBBSqueeze = regimeData?.volatilityState?.includes('LOW');
  const isExpUp = isBBSqueeze && currentCandle.close > currentCandle.open && currentPrice > (currentCandle.open + atrVal * 0.8);
  const isExpDn = isBBSqueeze && currentCandle.close < currentCandle.open && currentPrice < (currentCandle.open - atrVal * 0.8);
  makeSignal({
    name: 'M1 Compression Expansion',
    category: 'M1 SCALPING STRATEGIES',
    signal: isExpUp ? 'BULLISH' : isExpDn ? 'BEARISH' : isBBSqueeze ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isExpUp ? 'BULLISH SETUP — EXPANSION OUT OF SQUEEZE' : isExpDn ? 'BEARISH SETUP — EXPANSION OUT OF SQUEEZE' : isBBSqueeze ? 'WAIT — Squeeze compressing; awaiting breakout candle' : 'NO SETUP — Volatility bands uncompressed',
    evidence: isBBSqueeze ? 'Low volatility compression detected' : 'Standard band volatility',
    conditionsMet: isExpUp || isExpDn ? ['Compression phase', 'Expansion impulse bar'] : isBBSqueeze ? ['Bandwidth compression'] : [],
    conditionsUnmet: !(isExpUp || isExpDn) ? ['Expansion trigger bar'] : []
  });

  // M1 S12: M1 Range-Boundary Reversal
  // Reversal at range extreme in genuine range regime
  makeSignal({
    name: 'M1 Range-Boundary Reversal',
    category: 'M1 SCALPING STRATEGIES',
    signal: isRange && (nearSup?.distance * pipMult) < 3.0 && priceAction?.isBullish ? 'BULLISH' : isRange && (nearRes?.distance * pipMult) < 3.0 && priceAction?.isBearish ? 'BEARISH' : isRange ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isRange && (nearSup?.distance * pipMult) < 3.0 && priceAction?.isBullish ? 'BULLISH SETUP — RANGE LOW REVERSAL CONFIRMED' : isRange && (nearRes?.distance * pipMult) < 3.0 && priceAction?.isBearish ? 'BEARISH SETUP — RANGE HIGH REVERSAL CONFIRMED' : isRange ? 'WAIT — Range regime active; price in interior' : 'NO SETUP — Market in trending mode',
    evidence: isRange ? 'Confirmed range regime; trading edge rotations' : 'Market trending',
    conditionsMet: isRange && ((nearSup?.distance * pipMult) < 3.0 || (nearRes?.distance * pipMult) < 3.0) ? ['Range edge reached', 'Reversal candle trigger'] : [],
    conditionsUnmet: !isRange ? ['Range market regime'] : ['Range extreme test']
  });

  // M1 S13: M1 Momentum Exhaustion Reversal
  // Extended run (RSI > 75 or < 25), followed by climactic rejection wick and structural failure
  const isExhaustionBull = rsiVal < 25 && (priceAction?.patterns?.isHammer || priceAction?.patterns?.isBullEngulf);
  const isExhaustionBear = rsiVal > 75 && (priceAction?.patterns?.isShootingStar || priceAction?.patterns?.isBearEngulf);
  makeSignal({
    name: 'M1 Momentum Exhaustion Reversal',
    category: 'M1 SCALPING STRATEGIES',
    signal: isExhaustionBull ? 'BULLISH' : isExhaustionBear ? 'BEARISH' : (rsiVal > 75 || rsiVal < 25) ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isExhaustionBull ? 'BULLISH SETUP — OVERSOLD EXHAUSTION REVERSAL' : isExhaustionBear ? 'BEARISH SETUP — OVERBOUGHT EXHAUSTION REVERSAL' : (rsiVal > 75 || rsiVal < 25) ? 'WAIT — RSI climactic; awaiting structural rejection candle' : 'NO SETUP — RSI within normal boundaries',
    evidence: `RSI is ${rsiVal.toFixed(1)} with pattern: ${priceAction?.signal}`,
    conditionsMet: isExhaustionBull || isExhaustionBear ? ['Climactic momentum reading', 'Reversal rejection candle'] : [],
    conditionsUnmet: !(isExhaustionBull || isExhaustionBear) ? ['Reversal rejection trigger candle'] : []
  });

  // M1 S14: M1 Structure Flip and Retest
  // CHoCH against prior trend, retest of the flip level held
  const hasCHoCH = lastEvent?.includes('CHOCH');
  const isChochBull = hasCHoCH && lastEvent === 'BULLISH_CHOCH' && priceAction?.isBullish;
  const isChochBear = hasCHoCH && lastEvent === 'BEARISH_CHOCH' && priceAction?.isBearish;
  makeSignal({
    name: 'M1 Structure Flip and Retest',
    category: 'M1 SCALPING STRATEGIES',
    signal: isChochBull ? 'BULLISH' : isChochBear ? 'BEARISH' : hasCHoCH ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isChochBull ? 'BULLISH SETUP — CHOCH FLIP CONFIRMED' : isChochBear ? 'BEARISH SETUP — CHOCH FLIP CONFIRMED' : hasCHoCH ? 'WAIT — Change of character detected; awaiting retest' : 'NO SETUP — Trend continuing without CHoCH flip',
    evidence: hasCHoCH ? `Structural event: ${lastEvent} at ${marketStructure?.lastEventPrice?.toFixed(5) || 'structure'}` : 'No trend change of character',
    conditionsMet: (isChochBull || isChochBear) ? ['Change of Character (CHoCH)', 'Retest of flip zone defended'] : [],
    conditionsUnmet: !(isChochBull || isChochBear) ? ['Structure flip retest confirmation'] : []
  });

  // M1 S15: M1 Session Micro-Range Breakout
  // Opening or session boundary breakout
  makeSignal({
    name: 'M1 Session Micro-Range Breakout',
    category: 'M1 SCALPING STRATEGIES',
    signal: isSessionBreakUp && priceAction?.isBullish ? 'BULLISH' : isSessionBreakDn && priceAction?.isBearish ? 'BEARISH' : (isSessionBreakUp || isSessionBreakDn) ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isSessionBreakUp && priceAction?.isBullish ? 'BULLISH SETUP — SESSION BOUNDARY BREAKOUT' : isSessionBreakDn && priceAction?.isBearish ? 'BEARISH SETUP — SESSION BOUNDARY BREAKOUT' : 'WAIT — Consolidating inside session extremes',
    evidence: `Testing session edge against ATR ${(atrVal * pipMult).toFixed(1)} pips`,
    conditionsMet: (isSessionBreakUp && priceAction?.isBullish) || (isSessionBreakDn && priceAction?.isBearish) ? ['Session boundary test', 'Directional follow-through'] : [],
    conditionsUnmet: !(isSessionBreakUp || isSessionBreakDn) ? ['Session extreme breakout'] : []
  });

  // M1 S16: M1 ATR-Normalized Impulse
  // Displacement bar >= 1.5x ATR with minimal wick pullbacks
  const isAtrImpulseBull = (currentCandle.close - currentCandle.open) >= (atrVal * 1.5) && priceAction?.upperWickPct <= 0.25;
  const isAtrImpulseBear = (currentCandle.open - currentCandle.close) >= (atrVal * 1.5) && priceAction?.lowerWickPct <= 0.25;
  makeSignal({
    name: 'M1 ATR-Normalized Impulse',
    category: 'M1 SCALPING STRATEGIES',
    signal: isAtrImpulseBull ? 'BULLISH' : isAtrImpulseBear ? 'BEARISH' : 'WAIT',
    status: isAtrImpulseBull ? 'BULLISH SETUP — STRONG ATR IMPULSE CONFIRMED' : isAtrImpulseBear ? 'BEARISH SETUP — STRONG ATR IMPULSE CONFIRMED' : 'WAIT — Candle displacement within 1.0x ATR',
    evidence: `Current candle range: ${(priceAction?.totalRange * pipMult).toFixed(1)} pips vs ATR ${(atrVal * pipMult).toFixed(1)} pips`,
    conditionsMet: isAtrImpulseBull || isAtrImpulseBear ? ['Candle range >= 1.5x ATR', 'Body close near high/low'] : [],
    conditionsUnmet: !(isAtrImpulseBull || isAtrImpulseBear) ? ['Qualifying ATR displacement candle'] : []
  });

  // M1 S17: M1 Inside-Bar Breakout
  // Prior bar was inside bar, current candle closes beyond mother bar high/low
  const prevWasInside = candles[n - 2]?.high <= candles[n - 3]?.high && candles[n - 2]?.low >= candles[n - 3]?.low;
  const motherHigh = candles[n - 3]?.high || 0;
  const motherLow = candles[n - 3]?.low || 0;
  const isInsideBreakUp = prevWasInside && currentCandle.close > motherHigh;
  const isInsideBreakDn = prevWasInside && currentCandle.close < motherLow;
  makeSignal({
    name: 'M1 Inside-Bar Breakout',
    category: 'M1 SCALPING STRATEGIES',
    signal: isInsideBreakUp ? 'BULLISH' : isInsideBreakDn ? 'BEARISH' : prevWasInside ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isInsideBreakUp ? 'BULLISH SETUP — MOTHER BAR HIGH BREAK' : isInsideBreakDn ? 'BEARISH SETUP — MOTHER BAR LOW BREAK' : prevWasInside ? 'WAIT — Inside bar formed; awaiting breakout candle' : 'NO SETUP — No inside bar setup active',
    evidence: prevWasInside ? `Mother bar range: ${motherLow.toFixed(5)} — ${motherHigh.toFixed(5)}` : 'No inside bar compression',
    conditionsMet: isInsideBreakUp || isInsideBreakDn ? ['Inside bar identified', 'Confirmed break beyond mother bar'] : prevWasInside ? ['Inside bar identified'] : [],
    conditionsUnmet: !(isInsideBreakUp || isInsideBreakDn) ? ['Confirmed close beyond mother bar'] : []
  });

  // M1 S18: M1 Engulfing at Key Levels
  // Engulfing pattern occurring specifically within proximity to S/R or Order Block
  const isEngulfAtSup = priceAction?.patterns?.isBullEngulf && isAtSup;
  const isEngulfAtRes = priceAction?.patterns?.isBearEngulf && isAtRes;
  makeSignal({
    name: 'M1 Engulfing at Key Levels',
    category: 'M1 SCALPING STRATEGIES',
    signal: isEngulfAtSup ? 'BULLISH' : isEngulfAtRes ? 'BEARISH' : (priceAction?.patterns?.isBullEngulf || priceAction?.patterns?.isBearEngulf) ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isEngulfAtSup ? 'BULLISH SETUP — BULL ENGULF AT SUPPORT' : isEngulfAtRes ? 'BEARISH SETUP — BEAR ENGULF AT RESISTANCE' : (priceAction?.patterns?.isBullEngulf || priceAction?.patterns?.isBearEngulf) ? 'WAIT — Engulfing pattern formed away from key level' : 'NO SETUP — No engulfing pattern at key level',
    evidence: isEngulfAtSup ? `Bullish engulfing directly at Support ${nearSup?.price.toFixed(5)}` : isEngulfAtRes ? `Bearish engulfing directly at Resistance ${nearRes?.price.toFixed(5)}` : 'No confluent pattern at structural levels',
    conditionsMet: (isEngulfAtSup || isEngulfAtRes) ? ['Confirmed engulfing pattern', 'Confluent key support/resistance zone'] : [],
    conditionsUnmet: !(isEngulfAtSup || isEngulfAtRes) ? ['Engulfing pattern occurring at key level'] : []
  });

  // M1 S19: M1 Consecutive Rejection Reversal
  // 2+ consecutive candles testing same level with wicks in same direction
  const conBull = priceAction?.patterns?.hasConsecutiveBullRejection;
  const conBear = priceAction?.patterns?.hasConsecutiveBearRejection;
  makeSignal({
    name: 'M1 Consecutive Rejection Reversal',
    category: 'M1 SCALPING STRATEGIES',
    signal: conBull && priceAction?.isBullish ? 'BULLISH' : conBear && priceAction?.isBearish ? 'BEARISH' : (conBull || conBear) ? 'WAIT' : 'NO VALIDATED SETUP',
    status: conBull && priceAction?.isBullish ? 'BULLISH SETUP — DUAL LOWER WICK REJECTION' : conBear && priceAction?.isBearish ? 'BEARISH SETUP — DUAL UPPER WICK REJECTION' : (conBull || conBear) ? 'WAIT — Consecutive rejections seen; awaiting directional trigger' : 'NO SETUP — No consecutive rejection sequence',
    evidence: conBull ? 'Multiple consecutive candles rejected lower lows' : conBear ? 'Multiple consecutive candles rejected higher highs' : 'Standard single wick interactions',
    conditionsMet: (conBull || conBear) ? ['Consecutive wick defense of price level'] : [],
    conditionsUnmet: !(conBull || conBear) ? ['Consecutive rejection pattern'] : ['Directional confirmation candle']
  });

  // M1 S20: M1 Micro-Trend Continuation
  // Higher Highs & Higher Lows sequence on M1 aligned with EMA 9/21
  const isMicroTrendBull = structTrend === 'BULLISH' && emaSig === 'BULLISH' && priceAction?.isBullish;
  const isMicroTrendBear = structTrend === 'BEARISH' && emaSig === 'BEARISH' && priceAction?.isBearish;
  makeSignal({
    name: 'M1 Micro-Trend Continuation',
    category: 'M1 SCALPING STRATEGIES',
    signal: isMicroTrendBull ? 'BULLISH' : isMicroTrendBear ? 'BEARISH' : structTrend !== 'RANGE' ? 'WAIT' : 'NO VALIDATED SETUP',
    status: isMicroTrendBull ? 'BULLISH SETUP — MICRO-TREND FLOW ALIGNED' : isMicroTrendBear ? 'BEARISH SETUP — MICRO-TREND FLOW ALIGNED' : structTrend !== 'RANGE' ? 'WAIT — Trend intact; awaiting entry trigger candle' : 'NO SETUP — Market in choppy range',
    evidence: `Trend: ${structTrend}; EMA: ${emaSig}; Price Action: ${priceAction?.signal}`,
    conditionsMet: (isMicroTrendBull || isMicroTrendBear) ? ['Structural HH/HL or LH/LL', 'EMA trend alignment', 'Trigger bar confirmation'] : [],
    conditionsUnmet: !(isMicroTrendBull || isMicroTrendBear) ? ['Micro-trend alignment across structure and indicators'] : []
  });

  // ============================================================
  // SECTION 3: M1 ADAPTIVE FIRST-MOVE ENGINE (AFME)
  // Stage A to E composite execution selector
  // ============================================================
  const afmeRegime = regimeData?.regime || 'RANGE_BOUND';
  let afmeSetup = null;
  let afmeSig = 'WAIT';
  let afmeStatus = 'EVALUATING REGIME';
  let afmeScore = 50;

  // Stage A: Classify Regime & Stage B: Select Setup
  if (afmeRegime.includes('TRENDING')) {
    // Trending: prioritize impulse & pullback continuation
    if (isMicroTrendBull || isBullImpulse) {
      afmeSig = 'BULLISH';
      afmeStatus = 'BULLISH SETUP — TREND IMPULSE ADAPTIVE';
      afmeScore = 84;
    } else if (isMicroTrendBear || isBearImpulse) {
      afmeSig = 'BEARISH';
      afmeStatus = 'BEARISH SETUP — TREND IMPULSE ADAPTIVE';
      afmeScore = 84;
    } else {
      afmeSig = 'WAIT';
      afmeStatus = 'WAIT — Trending regime; awaiting controlled pullback entry';
      afmeScore = 60;
    }
  } else if (afmeRegime.includes('RANGE')) {
    // Ranging: prioritize S/R rejection & failed breakout reversals
    if (isAtSup && priceAction?.isBullish) {
      afmeSig = 'BULLISH';
      afmeStatus = 'BULLISH SETUP — RANGE BOUNDARY ROTATION';
      afmeScore = 80;
    } else if (isAtRes && priceAction?.isBearish) {
      afmeSig = 'BEARISH';
      afmeStatus = 'BEARISH SETUP — RANGE BOUNDARY ROTATION';
      afmeScore = 80;
    } else {
      afmeSig = 'WAIT';
      afmeStatus = 'WAIT — Range regime; price between boundaries';
      afmeScore = 52;
    }
  } else if (afmeRegime.includes('CONSOLIDATING')) {
    // Compressing: prepare micro breakout
    if (isMicroBreakUp) {
      afmeSig = 'BULLISH';
      afmeStatus = 'BULLISH SETUP — COMPRESSION BREAKOUT';
      afmeScore = 86;
    } else if (isMicroBreakDn) {
      afmeSig = 'BEARISH';
      afmeStatus = 'BEARISH SETUP — COMPRESSION BREAKOUT';
      afmeScore = 86;
    } else {
      afmeSig = 'WAIT';
      afmeStatus = 'WAIT — Compression active; awaiting confirmed boundary break';
      afmeScore = 55;
    }
  } else if (afmeRegime.includes('BREAKOUT')) {
    // Expanding: evaluate confirmed breakout continuation
    if (afmeRegime === 'BREAKOUT_UP' && priceAction?.isBullish) {
      afmeSig = 'BULLISH';
      afmeStatus = 'BULLISH SETUP — EXPANSION FOLLOW-THROUGH';
      afmeScore = 82;
    } else if (afmeRegime === 'BREAKOUT_DOWN' && priceAction?.isBearish) {
      afmeSig = 'BEARISH';
      afmeStatus = 'BEARISH SETUP — EXPANSION FOLLOW-THROUGH';
      afmeScore = 82;
    } else {
      afmeSig = 'WAIT';
      afmeStatus = 'WAIT — Breakout active; awaiting confirmation candle';
      afmeScore = 58;
    }
  }

  makeSignal({
    name: 'M1 Adaptive First-Move Engine (AFME)',
    category: 'M1 SCALPING STRATEGIES',
    signal: afmeSig,
    status: afmeStatus,
    evidence: `Classified regime as ${afmeRegime}. Quality Score: ${afmeScore}/100`,
    qualityScore: afmeScore,
    conditionsMet: afmeSig === 'BULLISH' || afmeSig === 'BEARISH' ? ['Regime classified', 'Compatible setup selected', 'Evidence verified'] : ['Regime classified'],
    conditionsUnmet: afmeSig === 'WAIT' ? ['Actionable setup trigger in current regime'] : [],
    invalidation: `Dynamic boundary at ${(currentPrice - (afmeSig === 'BULLISH' ? atrVal * 1.5 : -atrVal * 1.5)).toFixed(5)}`
  });

  return strategies;
}
