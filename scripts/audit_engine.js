// scripts/audit_engine.js
import fs from 'fs';
import path from 'path';

import { calculateTechnicalIndicators, generateNextCandlePrediction } from '../src/predictionEngine.js';
import { evaluateAllStrategies } from '../src/strategyEngine.js';
import { analyzeMarketRegime } from '../src/regimeEngine.js';
import { calculateSupportResistance } from '../src/supportResistanceEngine.js';
import { analyzeMarketStructure } from '../src/marketStructureEngine.js';
import { analyzePriceAction } from '../src/priceActionEngine.js';
import { detectOrderBlocks } from '../src/orderBlockEngine.js';
import { analyzeTickActivity } from '../src/tickActivityEngine.js';

// Load dataset
const dataPath = path.resolve('historical_test_data.json');
if (!fs.existsSync(dataPath)) {
  console.error('Data file not found!');
  process.exit(1);
}
const datasets = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('================================================================');
console.log('FORFUTURE COMPREHENSIVE M1 WIN RATE & STRATEGY PERFORMANCE AUDIT');
console.log('================================================================\n');

function runAudit() {
  const auditResults = {
    nextCandlePredictions: {
      total: 0,
      correct: 0,
      bullishPredicted: 0,
      bullishCorrect: 0,
      bearishPredicted: 0,
      bearishCorrect: 0,
      flatCandles: 0,
      confusion: { TP: 0, FP: 0, TN: 0, FN: 0 },
      brierSum: 0,
      calibrationBins: {}, // e.g. '0.50-0.55': { count: 0, wins: 0 }
      bySymbol: {},
      byRegime: {},
      byVolatility: {},
      bySession: {},
      baselines: {
        alwaysUp: { correct: 0, total: 0 },
        alwaysDown: { correct: 0, total: 0 },
        prevCandleFollow: { correct: 0, total: 0 }
      },
      failureAnalysis: {
        overextendedFails: 0,
        againstRegimeFails: 0,
        falseBreakoutFails: 0,
        srBreakthroughFails: 0,
        conflictDampenedFails: 0,
        totalFails: 0
      }
    },
    strategies: {} // stratName -> stats
  };

  for (const [symbol, candles] of Object.entries(datasets)) {
    console.log(`Auditing ${symbol} (${candles.length} candles)...`);
    const pipMult = symbol.includes('JPY') ? 100 : 10000;
    const spreadPips = symbol.includes('JPY') ? 0.9 : 0.8;

    auditResults.nextCandlePredictions.bySymbol[symbol] = { total: 0, correct: 0, brierSum: 0 };

    // We need at least 30 historical candles for warmup, up to n - 1 (predicting i + 1)
    const warmup = 35;
    for (let i = warmup; i < candles.length - 1; i++) {
      const historicalSlice = candles.slice(0, i + 1); // Strictly closed candles up to t
      const currentCandle = candles[i];
      const targetCandle = candles[i + 1]; // Strictly next fully closed candle t+1

      const actualDelta = targetCandle.close - targetCandle.open;
      const actualDir = actualDelta > 0 ? 'UP' : actualDelta < 0 ? 'DOWN' : 'FLAT';
      const actualBinary = targetCandle.close >= targetCandle.open ? 1 : 0; // 1 for UP, 0 for DOWN

      // Calculate indicators & subordinate engines
      const inds = calculateTechnicalIndicators(historicalSlice);
      const atrVal = parseFloat(inds.find(ind => ind.name.startsWith('ATR'))?.value || '8.0') / 10000;
      const sr = calculateSupportResistance(historicalSlice, currentCandle.close, atrVal, symbol, '1M');
      const ms = analyzeMarketStructure(historicalSlice, sr, '1M');
      const pa = analyzePriceAction(historicalSlice);
      const rd = analyzeMarketRegime(historicalSlice, inds);
      const ta = analyzeTickActivity(historicalSlice, currentCandle.spread);
      const ob = detectOrderBlocks(historicalSlice, ms?.swings || [], atrVal, symbol, '1M');

      const regime = rd?.regime || 'RANGE_BOUND';
      const volState = rd?.volatilityState || 'NORMAL';

      // Determine session by UTC hour of currentCandle
      const d = new Date(currentCandle.time * 1000);
      const hour = d.getUTCHours();
      let session = 'ASIAN';
      if (hour >= 7 && hour < 12) session = 'LONDON';
      else if (hour >= 12 && hour < 17) session = 'NY_LONDON_OVERLAP';
      else if (hour >= 17 && hour < 21) session = 'NEW_YORK';

      // 1. Next Candle Prediction Audit
      const pred = generateNextCandlePrediction(historicalSlice, inds, [], '1M', { symbol });
      const predDir = pred.direction;
      const probUp = pred.probability.up;

      const ncp = auditResults.nextCandlePredictions;
      ncp.total++;
      ncp.bySymbol[symbol].total++;

      // Session tracking
      if (!ncp.bySession[session]) ncp.bySession[session] = { total: 0, correct: 0 };
      ncp.bySession[session].total++;

      // Regime tracking
      if (!ncp.byRegime[regime]) ncp.byRegime[regime] = { total: 0, correct: 0 };
      ncp.byRegime[regime].total++;

      // Volatility tracking
      if (!ncp.byVolatility[volState]) ncp.byVolatility[volState] = { total: 0, correct: 0 };
      ncp.byVolatility[volState].total++;

      // Brier score: (probUp - actualBinary)^2
      const brier = Math.pow(probUp - actualBinary, 2);
      ncp.brierSum += brier;
      ncp.bySymbol[symbol].brierSum += brier;

      // Calibration binning
      const binKey = probUp < 0.45 ? '<0.45' : probUp < 0.50 ? '0.45-0.50' : probUp < 0.55 ? '0.50-0.55' : probUp < 0.60 ? '0.55-0.60' : probUp < 0.65 ? '0.60-0.65' : '>=0.65';
      if (!ncp.calibrationBins[binKey]) ncp.calibrationBins[binKey] = { total: 0, actualUp: 0, avgProb: 0, probSum: 0 };
      ncp.calibrationBins[binKey].total++;
      ncp.calibrationBins[binKey].probSum += probUp;
      if (actualBinary === 1) ncp.calibrationBins[binKey].actualUp++;

      // Baseline tracking
      if (actualBinary === 1) ncp.baselines.alwaysUp.correct++;
      ncp.baselines.alwaysUp.total++;
      if (actualBinary === 0) ncp.baselines.alwaysDown.correct++;
      ncp.baselines.alwaysDown.total++;
      const prevDir = currentCandle.close >= currentCandle.open ? 1 : 0;
      if (prevDir === actualBinary) ncp.baselines.prevCandleFollow.correct++;
      ncp.baselines.prevCandleFollow.total++;

      if (actualDir === 'FLAT') {
        ncp.flatCandles++;
      }

      const isCorrect = (predDir === 'UP' && actualDir === 'UP') || (predDir === 'DOWN' && actualDir === 'DOWN');
      if (isCorrect) {
        ncp.correct++;
        ncp.bySymbol[symbol].correct++;
        ncp.bySession[session].correct++;
        ncp.byRegime[regime].correct++;
        ncp.byVolatility[volState].correct++;
      } else {
        // Detailed failure diagnostics
        ncp.failureAnalysis.totalFails++;
        if (Math.abs(pred.features.zScore) > 0.1 || (predDir === 'UP' && currentCandle.close > candles[i - 3].close && candles[i - 1].close > candles[i - 2].close)) {
          ncp.failureAnalysis.overextendedFails++;
        }
        if ((predDir === 'UP' && regime.includes('DOWN')) || (predDir === 'DOWN' && regime.includes('UP'))) {
          ncp.failureAnalysis.againstRegimeFails++;
        }
        if (pred.features.isBreakout) {
          ncp.failureAnalysis.falseBreakoutFails++;
        }
        if ((pred.features.atSupport && actualDir === 'DOWN') || (pred.features.atResistance && actualDir === 'UP')) {
          ncp.failureAnalysis.srBreakthroughFails++;
        }
        if (pred.features.hasConflict) {
          ncp.failureAnalysis.conflictDampenedFails++;
        }
      }

      if (predDir === 'UP') {
        ncp.bullishPredicted++;
        if (actualBinary === 1) {
          ncp.bullishCorrect++;
          ncp.confusion.TP++;
        } else {
          ncp.confusion.FP++;
        }
      } else {
        ncp.bearishPredicted++;
        if (actualBinary === 0) {
          ncp.bearishCorrect++;
          ncp.confusion.TN++;
        } else {
          ncp.confusion.FN++;
        }
      }

      // 2. Individual Strategy Audit (all 46 strategies)
      const evaluatedStrats = evaluateAllStrategies(historicalSlice, inds, ms, pa, rd, ta, sr, ob, { symbol, timeframe: '1M', spreadPips });
      for (const s of evaluatedStrats) {
        if (!auditResults.strategies[s.name]) {
          auditResults.strategies[s.name] = {
            name: s.name,
            category: s.category,
            totalEvaluated: 0,
            actionableCount: 0,
            waitCount: 0,
            noSetupCount: 0,
            wins: 0,
            losses: 0,
            flats: 0,
            bullWins: 0,
            bullLosses: 0,
            bearWins: 0,
            bearLosses: 0,
            pipsGross: 0,
            pipsNet: 0,
            grossWinPips: 0,
            grossLossPips: 0,
            byRegime: {},
            bySymbol: {},
            trades: []
          };
        }

        const stratStats = auditResults.strategies[s.name];
        stratStats.totalEvaluated++;

        if (!stratStats.bySymbol[symbol]) stratStats.bySymbol[symbol] = { actionable: 0, wins: 0, losses: 0, netPips: 0 };
        if (!stratStats.byRegime[regime]) stratStats.byRegime[regime] = { actionable: 0, wins: 0, losses: 0, netPips: 0 };

        if (s.signal === 'WAIT') {
          stratStats.waitCount++;
          continue;
        }
        if (s.signal !== 'BULLISH' && s.signal !== 'BEARISH') {
          stratStats.noSetupCount++;
          continue;
        }

        stratStats.actionableCount++;
        stratStats.bySymbol[symbol].actionable++;
        stratStats.byRegime[regime].actionable++;

        // Outcome on target candle
        const entryPrice = currentCandle.close;
        const exitPrice = targetCandle.close;
        let pipsGross = 0;
        let isWin = false;

        if (s.signal === 'BULLISH') {
          pipsGross = (exitPrice - entryPrice) * pipMult;
          if (pipsGross > 0) {
            isWin = true;
            stratStats.bullWins++;
          } else if (pipsGross < 0) {
            stratStats.bullLosses++;
          } else {
            stratStats.flats++;
          }
        } else if (s.signal === 'BEARISH') {
          pipsGross = (entryPrice - exitPrice) * pipMult;
          if (pipsGross > 0) {
            isWin = true;
            stratStats.bearWins++;
          } else if (pipsGross < 0) {
            stratStats.bearLosses++;
          } else {
            stratStats.flats++;
          }
        }

        const pipsNet = pipsGross - spreadPips; // realistic spread deduction

        if (isWin) {
          stratStats.wins++;
          stratStats.bySymbol[symbol].wins++;
          stratStats.byRegime[regime].wins++;
          stratStats.grossWinPips += pipsGross;
        } else {
          stratStats.losses++;
          stratStats.bySymbol[symbol].losses++;
          stratStats.byRegime[regime].losses++;
          stratStats.grossLossPips += Math.abs(pipsGross);
        }

        stratStats.pipsGross += pipsGross;
        stratStats.pipsNet += pipsNet;
        stratStats.bySymbol[symbol].netPips += pipsNet;
        stratStats.byRegime[regime].netPips += pipsNet;

        stratStats.trades.push({
          time: currentCandle.time,
          symbol,
          signal: s.signal,
          pipsGross,
          pipsNet,
          isWin,
          regime
        });
      }
    }
  }

  return auditResults;
}

const results = runAudit();

// Format and Output Results
console.log('================================================================');
console.log('PART 1: NEXT-CANDLE DIRECTIONAL PREDICTION ENGINE AUDIT');
console.log('================================================================');
const ncp = results.nextCandlePredictions;
const overallWinRate = (ncp.correct / ncp.total) * 100;
const bullWinRate = (ncp.bullishCorrect / ncp.bullishPredicted) * 100;
const bearWinRate = (ncp.bearishCorrect / ncp.bearishPredicted) * 100;
const meanBrier = ncp.brierSum / ncp.total;

console.log(`Total Evaluated Predictions: ${ncp.total}`);
console.log(`Total Correct Predictions:   ${ncp.correct}`);
console.log(`Reported Directional Win Rate: ${overallWinRate.toFixed(2)}%`);
console.log(`Bullish Predictions:         ${ncp.bullishPredicted} (Win Rate: ${bullWinRate.toFixed(2)}%)`);
console.log(`Bearish Predictions:         ${ncp.bearishPredicted} (Win Rate: ${bearWinRate.toFixed(2)}%)`);
console.log(`Flat (Doji) Candles:         ${ncp.flatCandles} (${((ncp.flatCandles / ncp.total) * 100).toFixed(2)}% of all bars)`);
console.log(`Brier Score (Mean Sq Error): ${meanBrier.toFixed(4)} (Reference: 0.2500 is uninformative 50/50)`);

console.log('\n--- CONFUSION MATRIX ---');
console.log(`TP (Pred UP, Act UP):     ${ncp.confusion.TP}`);
console.log(`FP (Pred UP, Act DOWN):   ${ncp.confusion.FP}`);
console.log(`TN (Pred DOWN, Act DOWN): ${ncp.confusion.TN}`);
console.log(`FN (Pred DOWN, Act UP):   ${ncp.confusion.FN}`);
console.log(`Precision (UP):           ${(ncp.confusion.TP / (ncp.confusion.TP + ncp.confusion.FP) * 100).toFixed(2)}%`);
console.log(`Recall (UP):              ${(ncp.confusion.TP / (ncp.confusion.TP + ncp.confusion.FN) * 100).toFixed(2)}%`);

console.log('\n--- BASELINE BENCHMARKS ---');
console.log(`Baseline 1 (Always UP):       ${((ncp.baselines.alwaysUp.correct / ncp.baselines.alwaysUp.total) * 100).toFixed(2)}%`);
console.log(`Baseline 2 (Always DOWN):     ${((ncp.baselines.alwaysDown.correct / ncp.baselines.alwaysDown.total) * 100).toFixed(2)}%`);
console.log(`Baseline 3 (Prev-Candle Flow):${((ncp.baselines.prevCandleFollow.correct / ncp.baselines.prevCandleFollow.total) * 100).toFixed(2)}%`);
console.log(`Random Coin Flip:             50.00%`);

console.log('\n--- CALIBRATION ANALYSIS ---');
for (const [bin, data] of Object.entries(ncp.calibrationBins)) {
  const avgP = data.probSum / data.total;
  const actualP = data.actualUp / data.total;
  console.log(`Bin ${bin.padEnd(10)}: N=${String(data.total).padEnd(4)} | Avg Model Prob: ${(avgP * 100).toFixed(1)}% | Actual Win Rate: ${(actualP * 100).toFixed(1)}% | Bias: ${((actualP - avgP) * 100).toFixed(1)}%`);
}

console.log('\n--- PERFORMANCE BY SYMBOL ---');
for (const [sym, data] of Object.entries(ncp.bySymbol)) {
  console.log(`${sym.padEnd(10)}: Win Rate: ${((data.correct / data.total) * 100).toFixed(2)}% (N=${data.total}) | Brier: ${(data.brierSum / data.total).toFixed(4)}`);
}

console.log('\n--- PERFORMANCE BY REGIME ---');
for (const [reg, data] of Object.entries(ncp.byRegime)) {
  console.log(`${reg.padEnd(18)}: Win Rate: ${((data.correct / data.total) * 100).toFixed(2)}% (N=${data.total})`);
}

console.log('\n--- PERFORMANCE BY VOLATILITY ---');
for (const [vol, data] of Object.entries(ncp.byVolatility)) {
  console.log(`${vol.padEnd(18)}: Win Rate: ${((data.correct / data.total) * 100).toFixed(2)}% (N=${data.total})`);
}

console.log('\n--- PERFORMANCE BY TRADING SESSION ---');
for (const [sess, data] of Object.entries(ncp.bySession)) {
  console.log(`${sess.padEnd(18)}: Win Rate: ${((data.correct / data.total) * 100).toFixed(2)}% (N=${data.total})`);
}

console.log('\n--- FAILURE ATTRIBUTION ANALYSIS ---');
const totalFails = ncp.failureAnalysis.totalFails;
console.log(`Total Failing Predictions: ${totalFails}`);
console.log(`1. Fails after Overextended Move:      ${ncp.failureAnalysis.overextendedFails} (${((ncp.failureAnalysis.overextendedFails / totalFails) * 100).toFixed(1)}%)`);
console.log(`2. Fails against Macro Regime:         ${ncp.failureAnalysis.againstRegimeFails} (${((ncp.failureAnalysis.againstRegimeFails / totalFails) * 100).toFixed(1)}%)`);
console.log(`3. Fails on Unconfirmed Breakout:      ${ncp.failureAnalysis.falseBreakoutFails} (${((ncp.failureAnalysis.falseBreakoutFails / totalFails) * 100).toFixed(1)}%)`);
console.log(`4. Fails from S/R Boundary Penetration:${ncp.failureAnalysis.srBreakthroughFails} (${((ncp.failureAnalysis.srBreakthroughFails / totalFails) * 100).toFixed(1)}%)`);
console.log(`5. Fails when Signals Conflicted:      ${ncp.failureAnalysis.conflictDampenedFails} (${((ncp.failureAnalysis.conflictDampenedFails / totalFails) * 100).toFixed(1)}%)`);

console.log('\n================================================================');
console.log('PART 2: COMPLETE 46-STRATEGY PERFORMANCE AUDIT');
console.log('================================================================');
console.log(
  'Strategy Name'.padEnd(38) +
  'Cat'.padEnd(18) +
  'N'.padStart(6) +
  'Cov%'.padStart(7) +
  'Win%'.padStart(8) +
  'Bull%'.padStart(8) +
  'Bear%'.padStart(8) +
  'PF'.padStart(7) +
  'GrossPips'.padStart(11) +
  'NetPips'.padStart(10)
);
console.log('-'.repeat(121));

const stratList = Object.values(results.strategies).sort((a, b) => b.actionableCount - a.actionableCount);

for (const s of stratList) {
  const n = s.actionableCount;
  const cov = ((n / s.totalEvaluated) * 100).toFixed(1) + '%';
  const winRate = n > 0 ? ((s.wins / n) * 100).toFixed(1) + '%' : 'N/A';
  const bullTotal = s.bullWins + s.bullLosses;
  const bullWR = bullTotal > 0 ? ((s.bullWins / bullTotal) * 100).toFixed(1) + '%' : 'N/A';
  const bearTotal = s.bearWins + s.bearLosses;
  const bearWR = bearTotal > 0 ? ((s.bearWins / bearTotal) * 100).toFixed(1) + '%' : 'N/A';
  const pf = s.grossLossPips > 0 ? (s.grossWinPips / s.grossLossPips).toFixed(2) : (s.grossWinPips > 0 ? 'INF' : '0.00');

  console.log(
    s.name.padEnd(38).substring(0, 37) + ' ' +
    s.category.padEnd(18).substring(0, 17) + ' ' +
    String(n).padStart(5) + ' ' +
    cov.padStart(6) + ' ' +
    winRate.padStart(7) + ' ' +
    bullWR.padStart(7) + ' ' +
    bearWR.padStart(7) + ' ' +
    pf.padStart(6) + ' ' +
    s.pipsGross.toFixed(1).padStart(10) + ' ' +
    s.pipsNet.toFixed(1).padStart(9)
  );
}

// Write out JSON artifact of full audit for rigorous reporting
fs.writeFileSync('audit_results.json', JSON.stringify(results, null, 2));
console.log('\nFull audit results written to audit_results.json');
