// ============================================================
// ForFuture — Next Candle / Binary Direction Analysis (v3.0)
// Complete Real-Time Synchronization & Clean Architecture:
// 1. Single Source of Truth (Authoritative Market State)
// 2. Data Source Consistency (Real Interbank Spot via Yahoo, MID price basis)
// 3. Explicit Canonical Symbol Mapping
// 4. Exact Historical + Realtime Continuity (Gapless connection)
// 5. Data-driven continuous live candle updates
// 6. Viewport State isolated from Market Data pipeline
// 7. Auto-follow + Go To Live without stopping or restarting stream
// 8. Authoritative UTC candle boundaries & recoverable countdown
// 9. TV Comparison Diagnostic Mode & Real-time Debug Panel
// 10. Clean pair and timeframe switching lifecycles
// ============================================================

import { marketDataClient } from '../nextCandleClient.js';
import { calculateTechnicalIndicators, evaluateTradingStrategies, generateNextCandlePrediction } from '../predictionEngine.js';
import { createChart, CandlestickSeries, LineSeries, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts';

// ============================================================
// 1. SINGLE SOURCE OF TRUTH — AUTHORITATIVE REAL-TIME MARKET STATE
// ============================================================
const NC = {
  // Authoritative real-time market state (consumed by chart, countdown, indicators, prediction)
  marketState: {
    symbol: 'EUR/USD',
    canonicalSymbol: 'EURUSD',
    providerSymbol: 'EURUSD=X',
    provider: 'Interbank Forex Spot',
    marketType: 'FOREX',
    priceBasis: 'MID',
    bid: null,
    ask: null,
    mid: null,
    spread: null,
    spreadPips: null,
    lastUpdateTime: null,
    serverTime: null,
    clockOffset: 0,
    currentCandle: null,        // { timestamp, time, open, high, low, close, volume, tickCount, spread, status }
    currentCandleStart: null,
    currentCandleEnd: null,
    selectedTimeframe: '1M',
    subscriptionId: null,
    connectionStatus: 'CONNECTING', // CONNECTING | CONNECTED | RECONNECTING | RESYNCING | DISCONNECTED
  },

  // Closed historical candles cache: timeframe -> candle[]
  historicalCandles: {},

  // 14. Separate Chart Viewport State (Only controls presentation, NEVER market data)
  chartViewport: {
    visibleRange: null,
    isAtLiveEdge: true,
    userHasScrolled: false,
    userHasZoomed: false,
    scrollPosition: 0,
  },

  // Chart instances and overlay series
  chart: null,
  mainSeries: null,
  ema9Series: null,
  ema21Series: null,
  vwapSeries: null,
  showEMA: true,
  showVWAP: true,
  resizeObserver: null,

  // Diagnostics and Debug panel state
  showDiagnostics: false,
  diagnosticsData: null,
  lastChartUpdateMs: 0,

  // Prediction and performance history
  prediction: null,
  predictionTime: null,
  predictionHistory: [],

  // Lifecycle & timers
  clockTimer: null,
  wsCleanup: [],
  diagPollTimer: null,
};

const PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY'];
const TFS = ['1M', '2M', '3M', '4M', '5M'];
const TF_SEC = { '1M': 60, '2M': 120, '3M': 180, '4M': 240, '5M': 300 };

// ============================================================
// AUTHORITATIVE TIME & CANDLE BOUNDARIES (SYNCHRONIZED CLOCK ENGINE)
// ============================================================
function getSynchronizedNowMs() {
  return typeof marketDataClient?.getSynchronizedTime === 'function'
    ? marketDataClient.getSynchronizedTime()
    : (Date.now() + (marketDataClient?.currentOffset || 0));
}

function getSynchronizedNowSec() {
  return typeof marketDataClient?.getSynchronizedTimeSec === 'function'
    ? marketDataClient.getSynchronizedTimeSec()
    : (Date.now() + (marketDataClient?.currentOffset || 0)) / 1000;
}

function calculateCandleBoundaries(timeframe) {
  const step = TF_SEC[timeframe] || 60;
  const syncNowMs = getSynchronizedNowMs();
  const syncNowSec = syncNowMs / 1000;
  // Strict mathematical candle boundary calculated dynamically off the synchronized clock
  const start = Math.floor(syncNowSec / step) * step;
  const end = start + step;
  return { start, end, step, syncNowSec, syncNowMs };
}

function getCountdownSeconds(timeframe) {
  const { end, syncNowSec } = calculateCandleBoundaries(timeframe);
  // Strictly: candleEndTimestamp - synchronizedCurrentTime
  // Never previousCountdown - 1, never page-load-time + 60, never fixed offset
  return Math.max(0, end - syncNowSec);
}

// ============================================================
// RENDER HTML SHELL
// ============================================================
export function renderNextCandle(appState) {
  const pairOpts = PAIRS.map(p => `<option value="${p}" ${p === NC.marketState.symbol ? 'selected' : ''}>${p}</option>`).join('');
  const tfBtns = TFS.map(tf => `<button class="nc-tf-btn ${tf === NC.marketState.selectedTimeframe ? 'active' : ''}" data-tf="${tf}">${tf}</button>`).join('');

  return `
<div class="nc-page" id="ncPage">

  <!-- TOP BAR -->
  <div class="nc-topbar">
    <div class="nc-topbar-left">
      <div class="nc-logo">
        <span class="nc-logo-icon">⬡</span>
        <span class="nc-logo-text">Next Candle</span>
        <span class="nc-logo-sub">Binary Direction Analysis</span>
      </div>
      <div class="nc-select-wrap">
        <select class="nc-select" id="ncPairSelect">${pairOpts}</select>
        <span class="nc-select-chevron">▾</span>
      </div>
      <div class="nc-tf-buttons" id="ncTfButtons">${tfBtns}</div>
    </div>
    <div class="nc-topbar-right">
      <div class="nc-clock-panel">
        <div class="nc-clock-item"><span class="nc-clock-label">QUOTEX TIME</span><span class="nc-clock-value mono" id="ncQuotexTime">--:--:--</span></div>
        <div class="nc-clock-item"><span class="nc-clock-label">LOCAL</span><span class="nc-clock-value mono" id="ncLocalTime">--:--:--</span></div>
        <div class="nc-clock-item"><span class="nc-clock-label">UTC</span><span class="nc-clock-value mono" id="ncUtcTime">--:--:--</span></div>
      </div>
      <div class="nc-market-badge" id="ncProviderBadge" style="cursor:pointer;" title="Market Data Provider (Biquote)">
        <span class="nc-status-dot" id="ncProviderDot" style="background:#3b82f6;"></span>
        <span id="ncProviderText">Biquote</span>
        <span class="provider-backup-tag" id="ncProviderBackupTag" style="display:none;">BACKUP</span>
      </div>
      <div class="nc-market-badge" id="ncMarketBadge">
        <span class="nc-status-dot" id="ncStatusDot"></span>
        <span id="ncStatusText">CONNECTING</span>
      </div>
      <div class="nc-session-badge" id="ncSessionBadge"><span id="ncSessionText">—</span></div>
    </div>
  </div>

  <!-- MAIN GRID -->
  <div class="nc-main-grid">

    <!-- LEFT: Chart, Price Strip, TV Compare Diagnostics, History -->
    <div class="nc-left-col">

      <!-- Price Strip (Live Bid, Ask, Mid, Spread, Data Age, O/H/L/C) -->
      <div class="nc-price-strip">
        <div class="nc-price-main">
          <span class="nc-price-label">PRICE (MID)</span>
          <span class="nc-price-value mono" id="ncPrice">—</span>
        </div>
        <div class="nc-price-detail">
          <div class="nc-price-item"><span class="nc-price-item-label">BID</span><span class="nc-price-item-val mono" id="ncBid">—</span></div>
          <div class="nc-price-item"><span class="nc-price-item-label">ASK</span><span class="nc-price-item-val mono" id="ncAsk">—</span></div>
          <div class="nc-price-item"><span class="nc-price-item-label">SPREAD</span><span class="nc-price-item-val mono" id="ncSpread">—</span></div>
          <div class="nc-price-item"><span class="nc-price-item-label">PIPS</span><span class="nc-price-item-val mono" id="ncSpreadPips">—</span></div>
          <div class="nc-price-item"><span class="nc-price-item-label">DATA AGE</span><span class="nc-price-item-val mono" id="ncDataAge">0ms</span></div>
        </div>
        <div class="nc-candle-strip">
          <div class="nc-candle-item"><span class="nc-candle-label">O</span><span class="mono" id="ncCandleO">—</span></div>
          <div class="nc-candle-item"><span class="nc-candle-label">H</span><span class="mono nc-high" id="ncCandleH">—</span></div>
          <div class="nc-candle-item"><span class="nc-candle-label">L</span><span class="mono nc-low" id="ncCandleL">—</span></div>
          <div class="nc-candle-item"><span class="nc-candle-label">C</span><span class="mono" id="ncCandleC">—</span></div>
          <div class="nc-candle-item"><span class="nc-candle-label">TICKS</span><span class="mono" id="ncCandleTicks">0</span></div>
        </div>
      </div>

      <!-- Chart Metadata & Provider Bar (Requirements 2, 3, 24) -->
      <div class="nc-chart-meta-bar">
        <div class="nc-meta-group">
          <div class="nc-meta-item"><span class="nc-meta-label">DATA SOURCE:</span> <span class="nc-meta-val" id="ncMetaProvider">Biquote</span> <span class="provider-backup-tag" id="ncMetaBackupTag" style="display:none;">BACKUP</span></div>
          <div class="nc-meta-item"><span class="nc-meta-label">SYMBOL:</span> <span class="nc-meta-val" id="ncMetaSymbol">EURUSD</span></div>
          <div class="nc-meta-item"><span class="nc-meta-label">TYPE:</span> <span class="nc-meta-val">FOREX</span></div>
          <div class="nc-meta-item"><span class="nc-meta-label">PRICE BASIS:</span> <span class="nc-meta-val highlight">MID</span></div>
        </div>
        <div class="nc-meta-group">
          <div class="nc-meta-item"><span class="nc-meta-label">VIEWPORT:</span> <span class="nc-meta-val" id="ncMetaViewport">LIVE EDGE</span></div>
        </div>
      </div>

      <!-- Chart Container -->
      <div class="nc-chart-wrap">
        <div class="nc-chart-header">
          <span class="nc-chart-title" id="ncChartTitle">EUR/USD — 1M Live Chart</span>
          <div class="nc-chart-controls">
            <!-- Go To Live Button (Requirements 8, 9, 15) -->
            <button class="nc-chart-btn" id="ncBtnLive" title="Scroll to newest live candle">● LIVE</button>
            <label class="nc-chart-toggle"><input type="checkbox" id="ncShowEMA" checked> EMA 9/21</label>
            <label class="nc-chart-toggle"><input type="checkbox" id="ncShowVWAP" checked> VWAP</label>
            <!-- Developer TV Compare & Diagnostics Toggle (Requirements 23, 30) -->
            <button class="nc-chart-btn" id="ncBtnDiag" style="border-color:rgba(96,165,250,0.4);color:#60a5fa;background:rgba(59,130,246,0.08);">🛠 TV DIAGNOSTICS</button>
          </div>
        </div>

        <!-- TV Diagnostics & Developer Debug Panel (Sections 23 & 30) -->
        <div class="nc-diag-panel" id="ncDiagPanel">
          <div class="nc-diag-grid">
            <!-- TV Reference Comparison Box -->
            <div class="nc-diag-box">
              <div class="nc-diag-title">
                <span>TradingView / Interbank Reference</span>
                <span id="ncDiagDiff" class="mono" style="font-size:9px;color:var(--text-muted);">Diff: 0.00000</span>
              </div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">OUR PRICE (MID):</span><span class="nc-diag-row-val mono match" id="ncDiagOurPrice">—</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">REFERENCE PRICE:</span><span class="nc-diag-row-val mono match" id="ncDiagRefPrice">—</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">OUR CANDLE OPEN:</span><span class="nc-diag-row-val mono" id="ncDiagOurOpen">—</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">REF CANDLE OPEN:</span><span class="nc-diag-row-val mono" id="ncDiagRefOpen">—</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">OUR HIGH / LOW:</span><span class="nc-diag-row-val mono" id="ncDiagOurHL">—</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">REF HIGH / LOW:</span><span class="nc-diag-row-val mono" id="ncDiagRefHL">—</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">TIME DIFFERENCE:</span><span class="nc-diag-row-val mono" id="ncDiagTimeDiff">0 ms</span></div>
            </div>

            <!-- Engine & Viewport Debug Box -->
            <div class="nc-diag-box">
              <div class="nc-diag-title">
                <span>Real-Time Engine Sync State</span>
                <span class="mono" style="font-size:9px;color:var(--green-text);">ACTIVE</span>
              </div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">CONNECTION:</span><span class="nc-diag-row-val mono live" id="ncDiagConn">CONNECTED</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">CANDLE BOUNDARY:</span><span class="nc-diag-row-val mono" id="ncDiagBoundary">--:-- → --:--</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">LAST CHART UPDATE:</span><span class="nc-diag-row-val mono" id="ncDiagLastChart">0 ms ago</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">LAST TICK:</span><span class="nc-diag-row-val mono" id="ncDiagLastTick">0 ms ago</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">WS LATENCY:</span><span class="nc-diag-row-val mono" id="ncDiagLatency">0 ms</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">VIEWPORT STATE:</span><span class="nc-diag-row-val mono live" id="ncDiagVpState">LIVE EDGE</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">SUBSCRIPTION:</span><span class="nc-diag-row-val mono match">ACTIVE (BACKGROUND)</span></div>
            </div>

            <!-- Authoritative Clock Synchronization (NTP / Dynamic Drift Adaptation) -->
            <div class="nc-diag-box">
              <div class="nc-diag-title">
                <span>Dynamic Clock Synchronization</span>
                <span id="ncDiagSyncBadge" class="mono" style="font-size:9px;color:var(--green-text);">CONTINUOUS</span>
              </div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">SERVER TIME:</span><span class="nc-diag-row-val mono match" id="ncDiagServerTime">--:--:--.---</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">CLIENT TIME:</span><span class="nc-diag-row-val mono" id="ncDiagClientTime">--:--:--.---</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">PROVIDER TIME:</span><span class="nc-diag-row-val mono" id="ncDiagProviderTime">--:--:--.---</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">CURRENT OFFSET:</span><span class="nc-diag-row-val mono live" id="ncDiagCurrentOffset">0 ms</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">LAST SYNC:</span><span class="nc-diag-row-val mono" id="ncDiagLastSync">0 ms ago</span></div>
              <div class="nc-diag-row"><span class="nc-diag-row-label">SYNC LATENCY:</span><span class="nc-diag-row-val mono" id="ncDiagSyncLatency">0 ms</span></div>
            </div>

            <!-- Multi-Provider Failover Architecture Box -->
            <div class="nc-diag-box" style="grid-column: span 3;">
              <div class="nc-diag-title">
                <span>Multi-Provider Failover Architecture</span>
                <span id="ncDiagActiveProvBadge" class="mono" style="font-size:9px;color:var(--blue-text);">ACTIVE: OANDA</span>
              </div>
              <div class="nc-provider-chain-row" id="ncProviderChainRow">
                <span class="nc-provider-pill is-active" id="pill_Biquote">Biquote (REST + SignalR)</span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(1,1fr);gap:8px;margin-bottom:8px;" id="ncProviderCards">
                <div class="nc-diag-subbox" id="card_Biquote" style="background:var(--bg-secondary);padding:6px 8px;border-radius:4px;border:1px solid var(--border-subtle);">
                  <div style="font-weight:700;font-size:10px;color:var(--text-primary);display:flex;justify-content:space-between;">
                    <span>Biquote</span><span id="st_Biquote" class="mono" style="color:var(--green-text);">HEALTHY</span>
                  </div>
                  <div style="font-size:9px;color:var(--text-muted);margin-top:2px;" id="meta_Biquote">Primary Feed</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border-subtle);padding-top:6px;">
                <div style="font-size:10px;color:var(--text-muted);">
                  SWITCH LOG: <span id="ncDiagLastSwitchText" class="mono" style="color:var(--text-secondary);">No failovers triggered</span>
                </div>
                <div style="display:flex;gap:6px;">
                  <button class="nc-chart-btn" id="btnRefreshData" style="padding:2px 8px;font-size:10px;border-color:rgba(34,197,94,0.4);color:#22c55e;" title="Refresh Data via REST">🔄 REFRESH DATA</button>
                  <button class="nc-chart-btn" id="btnReconnectFeed" style="padding:2px 8px;font-size:10px;border-color:rgba(59,130,246,0.4);color:#3b82f6;" title="Reconnect Live SignalR Feed">⚡ RECONNECT FEED</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Lightweight Charts canvas area -->
        <div class="nc-chart-area" id="ncChartArea"></div>
      </div>

      <!-- Prediction History Table -->
      <div class="nc-history-panel">
        <div class="nc-panel-header">
          <span class="nc-panel-title">Prediction History</span>
          <span class="nc-panel-subtitle" id="ncHistStats">—</span>
        </div>
        <div class="nc-table-wrap">
          <table class="nc-table">
            <thead>
              <tr>
                <th>Time</th><th>Pair</th><th>TF</th><th>Prediction</th><th>Prob</th><th>Actual</th><th>Result</th><th>Spread</th><th>Regime</th><th>Context</th>
              </tr>
            </thead>
            <tbody id="ncHistoryBody">
              <tr><td colspan="10" class="nc-table-empty">Awaiting first prediction cycle...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- RIGHT: Prediction Engine & Analysis -->
    <div class="nc-right-col">

      <!-- Prediction Card -->
      <div class="nc-prediction-card" id="ncPredictionCard">
        <div class="nc-pred-header">
          <div>
            <div class="nc-pred-target">NEXT <span id="ncPredTF">1M</span> CANDLE</div>
            <div class="nc-pred-time mono" id="ncPredTime">—</div>
          </div>
          <div class="nc-countdown-wrap">
            <span class="nc-countdown-label" id="ncCountdownLabel">CLOSES IN</span>
            <span class="nc-countdown mono" id="ncCountdown">00:00</span>
          </div>
        </div>

        <!-- Direction Display (ALWAYS UP OR DOWN) -->
        <div class="nc-pred-direction" id="ncPredDirection">
          <div class="nc-pred-dir-value" id="ncPredDirValue">—</div>
          <div class="nc-pred-prob" id="ncPredProb"></div>
        </div>

        <!-- Probability Bars -->
        <div class="nc-pred-bars">
          <div class="nc-pred-bar-row">
            <span class="nc-pred-bar-label up">UP</span>
            <div class="nc-pred-bar-track"><div class="nc-pred-bar-fill up" id="ncBarUp" style="width:50%"></div></div>
            <span class="nc-pred-bar-pct mono" id="ncProbUp">50.0%</span>
          </div>
          <div class="nc-pred-bar-row">
            <span class="nc-pred-bar-label down">DN</span>
            <div class="nc-pred-bar-track"><div class="nc-pred-bar-fill down" id="ncBarDown" style="width:50%"></div></div>
            <span class="nc-pred-bar-pct mono" id="ncProbDown">50.0%</span>
          </div>
        </div>

        <!-- Metadata row -->
        <div class="nc-pred-meta-row">
          <div class="nc-pred-meta-item"><span class="nc-pred-meta-label">SIGNAL</span><span class="nc-pred-meta-val" id="ncQuality">—</span></div>
          <div class="nc-pred-meta-item"><span class="nc-pred-meta-label">DATA FEED</span><span class="nc-pred-meta-val" id="ncDataQual">LIVE</span></div>
          <div class="nc-pred-meta-item"><span class="nc-pred-meta-label">MODEL</span><span class="nc-pred-meta-val mono" id="ncModelVer">NCF-ENS-v3</span></div>
        </div>

        <div class="nc-pred-disclaimer">DATA-DRIVEN FOREX DIRECTION ENSEMBLE — NOT FINANCIAL ADVICE</div>
      </div>

      <!-- Institutional Market Summary (High-Density Multi-Timeframe Context) -->
      <div class="nc-summary-card">
        <div class="nc-panel-header" style="padding:4px 0 6px 0;">
          <span class="nc-panel-title">Market Summary</span>
          <span class="nc-panel-subtitle mono" id="ncSummaryAssetTF">EUR/USD · 1M</span>
        </div>
        <div class="nc-summary-grid">
          <div class="nc-summary-item">
            <span class="nc-summary-label">REGIME</span>
            <span class="nc-summary-val" id="ncSummaryRegime">CALCULATING...</span>
          </div>
          <div class="nc-summary-item">
            <span class="nc-summary-label">BIAS</span>
            <span class="nc-summary-val" id="ncSummaryBias">NEUTRAL</span>
          </div>
          <div class="nc-summary-item">
            <span class="nc-summary-label">SETUPS</span>
            <span class="nc-summary-val">
              <span class="bull" id="ncSummaryBull">0▲</span>
              <span class="bear" id="ncSummaryBear">0▼</span>
              <span class="neut" id="ncSummaryWait">0⧗</span>
            </span>
          </div>
          <div class="nc-summary-item">
            <span class="nc-summary-label">NEAREST S/R</span>
            <span class="nc-summary-val mono" id="ncSummarySR" style="font-size:10px;">— / —</span>
          </div>
          <div class="nc-summary-item">
            <span class="nc-summary-label">ORDER BLOCKS</span>
            <span class="nc-summary-val mono" id="ncSummaryOB" style="font-size:10px;">— / —</span>
          </div>
          <div class="nc-summary-item">
            <span class="nc-summary-label">STATUS</span>
            <span class="nc-summary-val live" id="ncSummaryFreshness">LIVE SYNC</span>
          </div>
        </div>
      </div>

      <!-- Model Evidence -->
      <div class="nc-evidence-card">
        <div class="nc-panel-header">
          <span class="nc-panel-title">Model Evidence</span>
          <span class="nc-panel-subtitle" id="ncRegimeLabel">Regime: —</span>
        </div>
        <div class="nc-evidence-grid" id="ncEvidenceGrid">
          ${_evidenceRow('TREND', '—', 'neut')}
          ${_evidenceRow('MOMENTUM', '—', 'neut')}
          ${_evidenceRow('PRICE ACTION', '—', 'neut')}
          ${_evidenceRow('VOLATILITY', '—', 'neut')}
          ${_evidenceRow('TICK ACTIVITY', '—', 'neut')}
          ${_evidenceRow('STATISTICS', '—', 'neut')}
          ${_evidenceRow('MARKET REGIME', '—', 'neut')}
          ${_evidenceRow('SESSION', '—', 'neut')}
          ${_evidenceRow('SPREAD', '—', 'neut')}
        </div>
      </div>

      <!-- Support & Resistance (Compact) -->
      <div class="nc-sr-card" style="background:var(--bg-card);border-bottom:1px solid var(--border-subtle);padding:6px 12px;">
        <div class="nc-panel-header" style="padding:0 0 4px 0;border-bottom:none;">
          <span class="nc-panel-title">SUPPORT & RESISTANCE</span>
          <span class="nc-panel-subtitle" id="ncSRCount">Key Levels</span>
        </div>
        <div id="ncSRGrid" style="display:grid;gap:2px;font-size:11px;">
           <div style="color:var(--text-muted);">Awaiting data...</div>
        </div>
      </div>

      <!-- Order Blocks & Supply/Demand Zones -->
      <div class="nc-sr-card" style="background:var(--bg-card);border-bottom:1px solid var(--border-subtle);padding:6px 12px;">
        <div class="nc-panel-header" style="padding:0 0 4px 0;border-bottom:none;">
          <span class="nc-panel-title">ORDER BLOCKS & ZONES</span>
          <span class="nc-panel-subtitle" id="ncOBCount">0 Active</span>
        </div>
        <div id="ncOBGrid" style="display:grid;gap:2px;font-size:11px;">
           <div style="color:var(--text-muted);">Awaiting order block calculations...</div>
        </div>
      </div>

      <!-- Market Structure & Price Action (Compact) -->
      <div class="nc-sr-card" style="background:var(--bg-card);border-bottom:1px solid var(--border-subtle);padding:6px 12px;">
        <div class="nc-panel-header" style="padding:0 0 4px 0;border-bottom:none;">
          <span class="nc-panel-title">STRUCTURE & PRICE ACTION</span>
        </div>
        <div id="ncStructGrid" style="display:grid;gap:3px;font-size:11px;">
           <div style="color:var(--text-muted);">Awaiting data...</div>
        </div>
      </div>

      <!-- Indicator Consensus (Compact) -->
      <div class="nc-consensus-card">
        <div class="nc-panel-header">
          <span class="nc-panel-title">Indicator Signals</span>
          <div class="nc-consensus-counts">
            <span class="nc-count bull" id="ncIndBull">— ▲</span>
            <span class="nc-count bear" id="ncIndBear">— ▼</span>
            <span class="nc-count neut" id="ncIndNeut">— →</span>
          </div>
        </div>
        <div class="nc-indicator-list" id="ncIndicatorList"><div class="nc-empty-msg">Awaiting data...</div></div>
      </div>

      <!-- Strategy Consensus (Compact Collapsible) -->
      <div class="nc-consensus-card">
        <div class="nc-panel-header">
          <span class="nc-panel-title">Strategy Signals</span>
          <div class="nc-consensus-counts">
            <span class="nc-count bull" id="ncStratBull">— ▲</span>
            <span class="nc-count bear" id="ncStratBear">— ▼</span>
            <span class="nc-count neut" id="ncStratNeut">— ⧗</span>
          </div>
        </div>
        <div class="nc-strategy-list" id="ncStrategyList"><div class="nc-empty-msg">Awaiting data...</div></div>
      </div>

      <!-- System Status -->
      <div class="nc-status-card">
        <div class="nc-panel-header"><span class="nc-panel-title">System Status</span></div>
        <div class="nc-status-grid">
          <div class="nc-status-row"><span class="nc-status-label">DATA STREAM</span>
            <span class="nc-status-val"><span class="nc-dot" id="ncDotStream"></span><span id="ncStreamText">CONNECTING</span></span></div>
          <div class="nc-status-row"><span class="nc-status-label">LAST TICK</span><span class="nc-status-val mono" id="ncLastTick">—</span></div>
          <div class="nc-status-row"><span class="nc-status-label">LATENCY</span><span class="nc-status-val mono" id="ncLatency">—</span></div>
          <div class="nc-status-row"><span class="nc-status-label">CLOCK OFFSET</span><span class="nc-status-val mono live" id="ncStatusOffset">0 ms (SYNC)</span></div>
          <div class="nc-status-row"><span class="nc-status-label">CANDLE ENGINE</span>
            <span class="nc-status-val"><span class="nc-dot" id="ncDotCandle"></span><span id="ncCandleText">ACTIVE</span></span></div>
          <div class="nc-status-row"><span class="nc-status-label">MODEL</span>
            <span class="nc-status-val"><span class="nc-dot" id="ncDotModel"></span><span id="ncModelText">ACTIVE</span></span></div>
        </div>
      </div>

      <!-- Live Performance Analytics -->
      <div class="nc-perf-card">
        <div class="nc-panel-header">
          <span class="nc-panel-title">Live Analytics</span>
          <span class="nc-panel-subtitle">Walk-forward evaluation</span>
        </div>
        <div class="nc-perf-grid">
          <div class="nc-perf-item"><span class="nc-perf-label">PRECISION</span><span class="nc-perf-val mono" id="ncPrecision">N/A</span></div>
          <div class="nc-perf-item"><span class="nc-perf-label">SAMPLE (N)</span><span class="nc-perf-val mono" id="ncSampleN">0</span></div>
          <div class="nc-perf-item"><span class="nc-perf-label">ACTIVE TF</span><span class="nc-perf-val mono" id="ncPerfTF">1M</span></div>
        </div>
        <div class="nc-perf-note">Evaluation updates after every candle close</div>
      </div>

    </div>
  </div>
</div>`;
}

function _evidenceRow(label, val, cls) {
  return `<div class="nc-evidence-row">
    <span class="nc-evidence-label">${label}</span>
    <div class="nc-evidence-bar"><div class="nc-evidence-fill ${cls}" id="ncEv${label.replace(/ /g, '')}" style="width:50%"></div></div>
    <span class="nc-evidence-val ${cls}" id="ncEvV${label.replace(/ /g, '')}">${val}</span>
  </div>`;
}

// ============================================================
// PAGE MOUNT & INITIALIZATION
// ============================================================
export function initNextCandlePage() {
  _destroyPage();
  _buildChart();
  _wireControls();
  _startClock();
  _connectAndSubscribe();
}

// ============================================================
// CLEAN TEARDOWN
// ============================================================
function _destroyPage() {
  // Clear event listeners
  NC.wsCleanup.forEach(fn => { try { fn(); } catch (e) { } });
  NC.wsCleanup = [];

  // Stop clock & diag timer
  if (NC.clockTimer) { clearInterval(NC.clockTimer); NC.clockTimer = null; }
  if (NC.diagPollTimer) { clearInterval(NC.diagPollTimer); NC.diagPollTimer = null; }

  // ResizeObserver
  if (NC.resizeObserver) { NC.resizeObserver.disconnect(); NC.resizeObserver = null; }

  // Destroy chart instance
  if (NC.chart) {
    try { NC.chart.remove(); } catch (e) { }
    NC.chart = null;
    NC.mainSeries = null;
    NC.ema9Series = null;
    NC.ema21Series = null;
    NC.vwapSeries = null;
  }

  // Reset viewport state
  NC.chartViewport.isAtLiveEdge = true;
  NC.chartViewport.userHasScrolled = false;
  NC.chartViewport.scrollPosition = 0;
}

// ============================================================
// 16. CHART CREATION — CREATED ONCE PER PAGE LIFECYCLE
// ============================================================
function _buildChart() {
  const container = document.getElementById('ncChartArea');
  if (!container) return;

  const chart = createChart(container, {
    autoSize: false,
    width: container.clientWidth || 800,
    height: container.clientHeight || 450,
    layout: {
      background: { type: ColorType.Solid, color: '#0a0c12' },
      textColor: '#8b949e',
      fontSize: 10,
      fontFamily: "'JetBrains Mono', monospace",
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.03)' },
      horzLines: { color: 'rgba(255,255,255,0.03)' },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: 'rgba(59,130,246,0.4)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1e2030' },
      horzLine: { color: 'rgba(59,130,246,0.4)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1e2030' },
    },
    timeScale: {
      borderColor: 'rgba(255,255,255,0.08)',
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 12,
      barSpacing: 10,
      minBarSpacing: 3,
    },
    rightPriceScale: {
      borderColor: 'rgba(255,255,255,0.08)',
      scaleMargins: { top: 0.08, bottom: 0.12 },
    },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, vertTouchDrag: false, horzTouchDrag: true },
  });

  const mainSeries = chart.addSeries(CandlestickSeries, {
    upColor: '#22c55e',
    downColor: '#ef4444',
    borderUpColor: '#22c55e',
    borderDownColor: '#ef4444',
    wickUpColor: '#22c55e',
    wickDownColor: '#ef4444',
  });

  const ema9Series = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1.5, title: 'EMA 9', priceLineVisible: false, crosshairMarkerVisible: false });
  const ema21Series = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1.5, title: 'EMA 21', priceLineVisible: false, crosshairMarkerVisible: false });
  const vwapSeries = chart.addSeries(LineSeries, { color: 'rgba(139,92,246,0.75)', lineWidth: 1, title: 'VWAP', priceLineVisible: false, crosshairMarkerVisible: false, lineStyle: LineStyle.Dashed });

  NC.chart = chart;
  NC.mainSeries = mainSeries;
  NC.ema9Series = ema9Series;
  NC.ema21Series = ema21Series;
  NC.vwapSeries = vwapSeries;

  // 14 & 15. Track Viewport State without interfering with Market Data Streaming
  chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
    _handleViewportChange();
  });

  // Responsive Resize
  const ro = new ResizeObserver(() => {
    try {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight, autoSize: false });
    } catch (e) { }
  });
  ro.observe(container);
  NC.resizeObserver = ro;
}

// ============================================================
// 14 & 15. VIEWPORT TRACKING & AUTO-FOLLOW
// ============================================================
function _handleViewportChange() {
  if (!NC.chart) return;
  const timeScale = NC.chart.timeScale();
  const scrollPos = timeScale.scrollPosition();
  NC.chartViewport.scrollPosition = scrollPos;

  // In Lightweight Charts, scrollPosition <= 0 or very small positive indicates user is at the live edge
  // The rightOffset is 12, so when fully scrolled right, scrollPos is 0.
  const isAtLive = scrollPos <= 2 && scrollPos >= -5;
  NC.chartViewport.isAtLiveEdge = isAtLive;
  NC.chartViewport.userHasScrolled = !isAtLive;
  NC.chartViewport.visibleRange = timeScale.getVisibleRange();

  _updateLiveButtonUI();
}

function _updateLiveButtonUI() {
  const btn = document.getElementById('ncBtnLive');
  const vpLabel = document.getElementById('ncMetaViewport');
  const diagVp = document.getElementById('ncDiagVpState');

  if (NC.chartViewport.isAtLiveEdge) {
    if (btn) {
      btn.textContent = '● LIVE';
      btn.className = 'nc-chart-btn';
    }
    if (vpLabel) vpLabel.textContent = 'LIVE EDGE';
    if (diagVp) { diagVp.textContent = 'LIVE EDGE'; diagVp.className = 'nc-diag-row-val mono live'; }
  } else {
    if (btn) {
      btn.textContent = '➔ GO TO LIVE';
      btn.className = 'nc-chart-btn go-live-highlight';
    }
    const offset = Math.round(NC.chartViewport.scrollPosition);
    if (vpLabel) vpLabel.textContent = `HISTORICAL (-${offset} BARS)`;
    if (diagVp) { diagVp.textContent = `HISTORICAL (-${offset} BARS)`; diagVp.className = 'nc-diag-row-val mono diff'; }
  }
}

// 8 & 9. User clicks "GO TO LIVE"
function _goToLiveEdge() {
  NC.chartViewport.isAtLiveEdge = true;
  NC.chartViewport.userHasScrolled = false;
  if (NC.chart) {
    NC.chart.timeScale().scrollToRealTime();
  }
  _updateLiveButtonUI();
}

// ============================================================
// 4 & 19. HISTORICAL DATA RENDERING & CONTINUITY
// ============================================================
function _renderHistorical(newCandles, activeCandle) {
  if (!NC.mainSeries) return;
  const valid = _validateCandles(newCandles);

  const existing = NC.historicalCandles[NC.marketState.selectedTimeframe] || [];
  const mergedMap = new Map();
  existing.forEach(c => mergedMap.set(c.time, c));
  valid.forEach(c => mergedMap.set(c.time, c));

  const merged = Array.from(mergedMap.values()).sort((a, b) => a.time - b.time);
  NC.historicalCandles[NC.marketState.selectedTimeframe] = merged;

  // Combine validated closed candles with the single active candle
  const combined = [...merged];
  if (activeCandle) {
    const vActive = _validateCandle(activeCandle);
    if (vActive && (!valid.length || valid[valid.length - 1].time < vActive.time)) {
      combined.push(vActive);
    }
  }

  // 4 & 19. Preserve user zoom/pan if user has scrolled
  let savedLogicalRange = null;
  if (NC.chart && NC.chartViewport.userHasScrolled) {
    try {
      savedLogicalRange = NC.chart.timeScale().getVisibleLogicalRange();
    } catch (e) { }
  }

  NC.mainSeries.setData(combined);
  _updateOverlays(combined);

  // Position chart: restore user zoom/pan if scrolled, else follow real time
  if (savedLogicalRange) {
    try {
      NC.chart.timeScale().setVisibleLogicalRange(savedLogicalRange);
    } catch (e) { }
  } else if (NC.chartViewport.isAtLiveEdge) {
    try {
      NC.chart.timeScale().scrollToRealTime();
    } catch (e) { }
  }

  $dot('ncDotCandle', 'active');
  $('ncCandleText', 'ACTIVE');
}

// ============================================================
// 5, 6, 10. REAL-TIME DATA-DRIVEN ACTIVE CANDLE UPDATE
// ============================================================
function _updateActiveCandle(candle) {
  if (!NC.mainSeries || !candle) return;
  const v = _validateCandle(candle);
  if (!v) return;

  NC.marketState.currentCandle = { ...candle };
  NC.lastChartUpdateMs = Date.now();

  // 10. Incremental update to existing latest bar — NEVER reload or recreate chart
  NC.mainSeries.update(v);

  // We DO NOT update overlays on every micro-tick for performance reasons.
  // Overlays are updated on candle close, or initially.

  // 15. If user is at live edge, auto-follow gently but ONLY if they are slightly off
  // Removing aggressive scrollToPosition(0) which causes feedback loops on every tick.
  if (NC.chartViewport.isAtLiveEdge && NC.chart) {
    const pos = NC.chart.timeScale().scrollPosition();
    if (pos > 0 || pos < -2) {
      NC.chart.timeScale().scrollToPosition(0, false);
    }
  }

  // Update candle strip UI
  _updateCandleStripUI(v);
}

// ============================================================
// TECHNICAL OVERLAYS (EMA 9/21, VWAP)
// ============================================================
function _updateOverlays(candles) {
  if (!NC.chart || candles.length < 9) return;
  const ema9 = _calcEMA(candles, Math.min(9, candles.length - 1));
  const ema21 = candles.length > 21 ? _calcEMA(candles, 21) : ema9;
  const vwap = _calcVWAP(candles);

  if (NC.ema9Series && NC.showEMA) NC.ema9Series.setData(ema9);
  if (NC.ema21Series && NC.showEMA) NC.ema21Series.setData(ema21);
  if (NC.vwapSeries && NC.showVWAP) NC.vwapSeries.setData(vwap);
}

function _calcEMA(data, period) {
  if (!data.length || period < 1 || data.length < period) return [];
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
  const result = [{ time: data[period - 1].time, value: +ema.toFixed(6) }];
  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    result.push({ time: data[i].time, value: +ema.toFixed(6) });
  }
  return result;
}

function _calcVWAP(data) {
  let cumTPV = 0, cumVol = 0;
  return data.map(c => {
    const tp = (c.high + c.low + c.close) / 3;
    cumTPV += tp * (c.volume || 1);
    cumVol += (c.volume || 1);
    return { time: c.time, value: +(cumTPV / cumVol).toFixed(6) };
  });
}

// ============================================================
// 19. CANDLE VALIDATION & DEDUPLICATION
// ============================================================
function _validateCandle(c) {
  if (!c || c.time == null || c.open == null || c.close == null) return null;
  const o = +c.open, cClose = +c.close;
  if (o <= 0 || cClose <= 0) return null;
  const h = +Math.max(o, cClose, c.high || o);
  const l = +Math.min(o, cClose, c.low || o);
  return { time: c.time, open: o, high: h, low: l, close: cClose, volume: c.volume || 0 };
}

function _validateCandles(arr) {
  const seen = new Set();
  return (arr || [])
    .map(_validateCandle)
    .filter(c => c !== null)
    .filter(c => {
      if (seen.has(c.time)) return false;
      seen.add(c.time);
      return true;
    })
    .sort((a, b) => a.time - b.time);
}

// ============================================================
// USER CONTROLS & EVENT WIREUP
// ============================================================
function _wireControls() {
  // Pair select
  document.getElementById('ncPairSelect')?.addEventListener('change', e => {
    const newPair = e.target.value;
    if (newPair === NC.marketState.symbol) return;
    _handlePairChange(newPair);
  });

  // Timeframe buttons
  document.getElementById('ncTfButtons')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-tf]');
    if (!btn) return;
    const newTf = btn.dataset.tf;
    if (newTf === NC.marketState.selectedTimeframe) return;

    document.querySelectorAll('.nc-tf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _handleTimeframeChange(newTf);
  });

  // Go To Live Button
  document.getElementById('ncBtnLive')?.addEventListener('click', () => {
    _goToLiveEdge();
  });

  // Diagnostics Toggle
  document.getElementById('ncBtnDiag')?.addEventListener('click', () => {
    NC.showDiagnostics = !NC.showDiagnostics;
    const panel = document.getElementById('ncDiagPanel');
    if (panel) panel.classList.toggle('open', NC.showDiagnostics);
    if (NC.showDiagnostics) {
      _pollDiagnostics();
      if (!NC.diagPollTimer) {
        NC.diagPollTimer = setInterval(_pollDiagnostics, 2500);
      }
    } else {
      if (NC.diagPollTimer) {
        clearInterval(NC.diagPollTimer);
        NC.diagPollTimer = null;
      }
    }
  });

  // Biquote Recovery Buttons
  document.getElementById('btnRefreshData')?.addEventListener('click', () => {
    if (marketDataClient.refreshData) {
      marketDataClient.refreshData();
    }
  });

  document.getElementById('btnReconnectFeed')?.addEventListener('click', () => {
    if (marketDataClient.reconnectLiveFeed) {
      marketDataClient.reconnectLiveFeed();
    }
  });

  // EMA toggle
  document.getElementById('ncShowEMA')?.addEventListener('change', e => {
    NC.showEMA = e.target.checked;
    NC.ema9Series?.applyOptions({ visible: NC.showEMA });
    NC.ema21Series?.applyOptions({ visible: NC.showEMA });
  });

  // VWAP toggle
  document.getElementById('ncShowVWAP')?.addEventListener('change', e => {
    NC.showVWAP = e.target.checked;
    NC.vwapSeries?.applyOptions({ visible: NC.showVWAP });
  });
}

// ============================================================
// 17. TIMEFRAME CHANGE LIFECYCLE
// ============================================================
function _handleTimeframeChange(newTf) {
  NC.marketState.selectedTimeframe = newTf;
  NC.marketState.currentCandle = null;
  NC.prediction = null;

  _updateHeaderTitles();
  _resetPredictionUI();

  // Clear series data for clean reload
  try {
    NC.mainSeries?.setData([]);
    NC.ema9Series?.setData([]);
    NC.ema21Series?.setData([]);
    NC.vwapSeries?.setData([]);
  } catch (e) { }

  // Request subscription / history for new timeframe
  if (marketDataClient.isConnected) {
    // Unsubscribe from old timeframe to prevent ghost updates
    marketDataClient.unsubscribe(NC.marketState.symbol);
    marketDataClient.subscribe(NC.marketState.symbol, [newTf]);
  }

  // Reset viewport to live edge for new timeframe
  _goToLiveEdge();
}

// ============================================================
// 18. PAIR CHANGE LIFECYCLE
// ============================================================
function _handlePairChange(newPair) {
  const oldPair = NC.marketState.symbol;

  // Unsubscribe old pair
  if (marketDataClient.isConnected) {
    marketDataClient.unsubscribe(oldPair);
  }

  // Clear active state
  NC.marketState.symbol = newPair;
  NC.marketState.canonicalSymbol = newPair.replace('/', '');
  NC.marketState.currentCandle = null;
  NC.marketState.bid = null;
  NC.marketState.ask = null;
  NC.marketState.mid = null;
  NC.prediction = null;
  NC.historicalCandles = {};

  _updateHeaderTitles();
  _resetPredictionUI();

  // Clear chart
  try {
    NC.mainSeries?.setData([]);
    NC.ema9Series?.setData([]);
    NC.ema21Series?.setData([]);
    NC.vwapSeries?.setData([]);
  } catch (e) { }

  // Subscribe to new pair
  if (marketDataClient.isConnected) {
    marketDataClient.subscribe(newPair, ['1M', '2M', '3M', '4M', '5M']);
  }

  // Reset viewport to live edge
  _goToLiveEdge();
}

function _updateHeaderTitles() {
  $('ncChartTitle', `${NC.marketState.symbol} — ${NC.marketState.selectedTimeframe} Live Chart`);
  $('ncPredTF', NC.marketState.selectedTimeframe);
  $('ncPerfTF', NC.marketState.selectedTimeframe);
  $('ncMetaSymbol', NC.marketState.providerSymbol || NC.marketState.symbol);
}

// ============================================================
// WEBSOCKET SUBSCRIPTION & REAL-TIME EVENT STREAM
// ============================================================
function _connectAndSubscribe() {
  NC.wsCleanup.forEach(fn => fn());
  NC.wsCleanup = [];

  const handlers = [
    marketDataClient.on('connection', _onConnectionStatus),
    marketDataClient.on('statusChange', _onStatusChange),
    marketDataClient.on('heartbeat', _onHeartbeat),
    marketDataClient.on('tick', _onRealtimeTick),
    marketDataClient.on('historicalCandles', _onHistoricalCandles),
    marketDataClient.on('candleUpdate', _onCandleUpdate),
    marketDataClient.on('candleClose', _onCandleClose),
    marketDataClient.on('prediction', _onPrediction),
    marketDataClient.on('marketStatus', _onMarketStatus),
    marketDataClient.on('diagnosticsResponse', _onDiagnosticsResponse),
    marketDataClient.on('timeSync', _onTimeSync),
    marketDataClient.on('providerSwitch', _onProviderSwitch),
    marketDataClient.on('providerStatus', _onProviderStatus),
  ];

  NC.wsCleanup = handlers;

  // Initialize UI with provider manager status
  const currentProv = marketDataClient.getActiveProvider();
  const isBackup = marketDataClient.isBackupActive();
  _updateProviderUI(currentProv, isBackup);
  _updateDiagFailoverPanel(marketDataClient.getProviderHealth(), currentProv, isBackup);

  if (!marketDataClient.isConnected && marketDataClient.status !== 'CONNECTING') {
    marketDataClient.connect();
  } else if (marketDataClient.isConnected) {
    marketDataClient.subscribe(NC.marketState.symbol, ['1M', '2M', '3M', '4M', '5M']);
    marketDataClient.requestProviderStatus();
  }
}

// ============================================================
// 5. INCOMING REALTIME TICKS
// Every tick immediately updates price, current candle, chart bar
// ============================================================
function _onRealtimeTick(tick) {
  if (tick.symbol !== NC.marketState.symbol) return;

  const ms = NC.marketState;
  ms.bid = tick.bid;
  ms.ask = tick.ask;
  ms.mid = tick.mid;
  ms.spread = tick.spread;
  ms.spreadPips = tick.spreadPips;
  ms.lastUpdateTime = tick.timestamp;
  ms.provider = tick.provider || ms.provider;
  ms.providerSymbol = tick.providerSymbol || ms.providerSymbol;
  ms.canonicalSymbol = tick.canonicalSymbol || ms.canonicalSymbol;
  if (tick.isBackup !== undefined) ms.isBackup = !!tick.isBackup;

  if (tick.provider) {
    _updateProviderUI(tick.provider, ms.isBackup);
  }

  // Update active candle data-driven (Requirements 5 & 10)
  if (ms.currentCandle) {
    ms.currentCandle.high = Math.max(ms.currentCandle.high, tick.mid);
    ms.currentCandle.low = Math.min(ms.currentCandle.low, tick.mid);
    ms.currentCandle.close = tick.mid;
    ms.currentCandle.spread = tick.spread;
    ms.currentCandle.volume = (ms.currentCandle.volume || 0) + (tick.volume || 1);
    ms.currentCandle.tickCount = (ms.currentCandle.tickCount || 0) + 1;
    ms.currentCandle.lastUpdateTime = tick.timestamp;

    // Immediately push incremental update to chart
    _updateActiveCandle(ms.currentCandle);
  }

  // Update top price strip UI
  _updatePriceStripUI(tick);
}

function _onHistoricalCandles(data) {
  if (data.symbol !== NC.marketState.symbol) return;
  if (data.provider) NC.marketState.provider = data.provider;
  if (data.providerSymbol) NC.marketState.providerSymbol = data.providerSymbol;
  if (data.isBackup !== undefined) NC.marketState.isBackup = !!data.isBackup;

  _updateProviderUI(NC.marketState.provider, NC.marketState.isBackup);
  $('ncMetaSymbol', NC.marketState.providerSymbol);

  if (data.timeframe === NC.marketState.selectedTimeframe) {
    _renderHistorical(data.candles, data.activeCandle);

    if (data.activeCandle) {
      _updateActiveCandle(data.activeCandle);
    }

    // Generate initial prediction if not already set or if it's stale
    const contextCandles = [...data.candles];
    if (data.activeCandle) {
      // We use the last closed candle to predict the active one, or if we want to predict the next one after the active one,
      // Wait, the active candle is "FORMING", meaning it's the target candle. 
      // So the prediction should be based on data.candles (the closed candles).
      if (contextCandles.length > 0) {
        const indicators = calculateTechnicalIndicators(contextCandles);
        const strategies = evaluateTradingStrategies(contextCandles, indicators, null, null, null, null, null, null, { symbol: NC.marketState.symbol, timeframe: data.timeframe });
        const prediction = generateNextCandlePrediction(contextCandles, indicators, strategies, data.timeframe, { symbol: NC.marketState.symbol });

        _onPrediction({
          symbol: NC.marketState.symbol,
          timeframe: data.timeframe,
          prediction: prediction
        });
      }
    }
  }
}

function _onCandleUpdate(data) {
  if (data.symbol !== NC.marketState.symbol || data.timeframe !== NC.marketState.selectedTimeframe) return;
  _updateActiveCandle(data.candle);
}

function _onCandleClose(data) {
  if (data.symbol !== NC.marketState.symbol) return;

  // Append closed candle to historical cache
  if (!NC.historicalCandles[data.timeframe]) NC.historicalCandles[data.timeframe] = [];
  const hist = NC.historicalCandles[data.timeframe];
  if (!hist.length || hist[hist.length - 1].time < data.candle.time) {
    hist.push(data.candle);
    if (hist.length > 2000) hist.shift();

    // Update overlays on candle close instead of every tick
    if (data.timeframe === NC.marketState.selectedTimeframe) {
      _updateOverlays([...hist]);
    }
  }

  // Handle resolved prediction
  if (data.resolvedPrediction) {
    _renderHistoryTable();
    _updatePerformanceStats();
  }

  if (data.timeframe === NC.marketState.selectedTimeframe) {
    _flashPredictionCard();
  }
}

function _onPrediction(data) {
  if (data.symbol !== NC.marketState.symbol || data.timeframe !== NC.marketState.selectedTimeframe) return;

  if (!data.prediction.id) {
    data.prediction.id = 'pred_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    data.prediction.pair = data.symbol;
    data.prediction.timeframe = data.timeframe;
    data.prediction.predictionTimestamp = Date.now();
    data.prediction.resolved = false;
    data.prediction.modelVersion = 'NCF-ENS-v3';
    data.prediction.targetStart = NC.marketState.currentCandleStart;
    data.prediction.targetEnd = NC.marketState.currentCandleEnd;

    NC.predictionHistory.unshift(data.prediction);
    if (NC.predictionHistory.length > 200) NC.predictionHistory.pop();
    _renderHistoryTable();
  }

  NC.prediction = data.prediction;
  const syncNow = data.serverTime || data.prediction?.timestamp || marketDataClient.getSynchronizedTime();
  NC.predictionTime = new Date(syncNow);
  _renderPrediction(data.prediction);
}

function _onMarketStatus(data) {
  if (data.symbol !== NC.marketState.symbol) return;
  const sessEl = document.getElementById('ncSessionText');
  if (sessEl && data.session) sessEl.textContent = data.session.description || data.session.session || '—';
  const badge = document.getElementById('ncMarketBadge');
  if (badge) {
    badge.className = 'nc-market-badge' + (data.status === 'LIVE' ? ' live' : ' closed');
  }
}

function _onConnectionStatus(data) {
  NC.marketState.connectionStatus = data.status;
  _updateConnectionBadge(data.status);
}

function _onStatusChange(data) {
  NC.marketState.connectionStatus = data.status;
  _updateConnectionBadge(data.status);
}

function _onHeartbeat(data) {
  if (data.serverTime) {
    NC.marketState.serverTime = data.serverTime;
  }
}

// ============================================================
// 23 & 30. DIAGNOSTICS & TV COMPARISON RESPONSE
// ============================================================
function _onDiagnosticsResponse(data) {
  if (!NC.showDiagnostics || data.symbol !== NC.marketState.symbol) return;
  NC.diagnosticsData = data;

  const digits = NC.marketState.symbol.includes('JPY') ? 3 : 5;
  const fmt = (v) => v != null ? Number(v).toFixed(digits) : '—';

  $('ncDiagOurPrice', fmt(data.ourPrice));
  $('ncDiagRefPrice', fmt(data.referencePrice));

  if (data.message) {
    const logEl = document.getElementById('ncDiagLastSwitchText');
    if (logEl) {
      logEl.innerText = data.message;
      logEl.style.color = 'var(--yellow-text, #eab308)';
    }
  }

  const diff = data.ourPrice != null && data.referencePrice != null ? Math.abs(data.ourPrice - data.referencePrice) : 0;
  $('ncDiagDiff', `Diff: ${diff.toFixed(digits)} (${(diff / (digits === 3 ? 0.01 : 0.0001)).toFixed(1)} pips)`);

  $('ncDiagOurOpen', fmt(data.ourCandle?.open));
  $('ncDiagRefOpen', fmt(data.referenceCandle?.open));
  $('ncDiagOurHL', `${fmt(data.ourCandle?.high)} / ${fmt(data.ourCandle?.low)}`);
  $('ncDiagRefHL', `${fmt(data.referenceCandle?.high)} / ${fmt(data.referenceCandle?.low)}`);
  $('ncDiagTimeDiff', `${data.timestampDiffMs ?? 0} ms`);
}

function _pollDiagnostics() {
  if (!NC.showDiagnostics || !marketDataClient.isConnected) return;
  marketDataClient.getDiagnostics(NC.marketState.symbol, NC.marketState.selectedTimeframe).catch(() => { });
  marketDataClient.requestProviderStatus();
}

// Multi-Provider Failover Handlers
function _onProviderSwitch(data) {
  NC.marketState.provider = data.newProvider || NC.marketState.provider;
  NC.marketState.isBackup = !!data.isBackup;
  _updateProviderUI(NC.marketState.provider, NC.marketState.isBackup);
  _updateDiagFailoverPanel(data.providers, data.newProvider, data.isBackup);

  // Re-request history so the chart data reconciles with the new provider seamlessly
  if (marketDataClient.isConnected) {
    marketDataClient.requestHistory(NC.marketState.symbol, NC.marketState.selectedTimeframe);
  }
}

function _onProviderStatus(data) {
  NC.marketState.provider = data.activeProvider || NC.marketState.provider;
  NC.marketState.isBackup = !!data.isBackup;

  const allFailed = data.providers && data.providers.length > 0 && data.providers.every(p => p.state === 'FAILED' || p.state === 'UNRESPONSIVE');
  const errorMsg = data.error || (allFailed ? 'ALL MARKET DATA PROVIDERS UNAVAILABLE' : null);

  _updateProviderUI(NC.marketState.provider, NC.marketState.isBackup, errorMsg);
  _updateDiagFailoverPanel(data.providers, data.activeProvider, data.isBackup);
}

function _updateProviderUI(providerName, isBackup, errorMessage) {
  if (errorMessage) {
    $('ncMetaProvider', errorMessage);
    const metaEl = document.getElementById('ncMetaProvider');
    if (metaEl) { metaEl.style.color = '#ef4444'; metaEl.style.fontWeight = 'bold'; }
    $('ncHeaderProvider', 'DATA UNAVAILABLE');
    const badge = document.getElementById('ncProviderBadge');
    if (badge) badge.className = 'nc-provider-badge error';
  } else {
    const pName = providerName || 'Biquote';
    $('ncMetaProvider', pName);
    const metaEl = document.getElementById('ncMetaProvider');
    if (metaEl) { metaEl.style.color = ''; metaEl.style.fontWeight = ''; }
    $('ncHeaderProvider', pName);
    const badge = document.getElementById('ncProviderBadge');
    if (badge) badge.className = 'nc-provider-badge' + (isBackup ? ' backup-active' : '');
  }

  const backupTag = document.getElementById('ncProviderBackupTag');
  if (backupTag) {
    backupTag.style.display = isBackup && !errorMessage ? 'inline-block' : 'none';
  }
  const metaBackup = document.getElementById('ncMetaBackupTag');
  if (metaBackup) {
    metaBackup.style.display = isBackup && !errorMessage ? 'inline-block' : 'none';
  }
}

function _updateDiagFailoverPanel(providers, activeName, isBackup) {
  const pActive = activeName || NC.marketState.provider || 'Biquote';
  const badgeEl = document.getElementById('ncDiagActiveProvBadge');
  if (badgeEl) {
    badgeEl.textContent = `ACTIVE: ${pActive}${isBackup ? ' [BACKUP]' : ''}`;
    badgeEl.style.color = isBackup ? 'var(--yellow-text)' : 'var(--blue-text)';
  }

  const defaultProviders = [
    { name: 'Biquote', state: 'HEALTHY' }
  ];
  const pList = (Array.isArray(providers) && providers.length > 0) ? providers : defaultProviders;

  pList.forEach(p => {
    const slug = p.name.replace(/[\s\.]+/g, '_');
    const pill = document.getElementById(`pill_${slug}`);
    const st = document.getElementById(`st_${slug}`);
    const isActive = p.name === pActive;

    if (pill) {
      pill.className = 'nc-provider-pill' + (isActive ? (isBackup ? ' is-backup-active' : ' is-active') : '');
    }
    if (st) {
      const stateStr = p.state || (isActive ? 'HEALTHY' : 'STANDBY');
      st.textContent = stateStr;
      if (stateStr === 'HEALTHY') st.style.color = 'var(--green-text)';
      else if (stateStr === 'STANDBY') st.style.color = 'var(--blue-text)';
      else if (stateStr === 'FAILED' || stateStr === 'UNRESPONSIVE') st.style.color = 'var(--red-text)';
      else st.style.color = 'var(--yellow-text)';
    }
  });

  const hist = marketDataClient.getSwitchHistory ? marketDataClient.getSwitchHistory() : [];
  const logEl = document.getElementById('ncDiagLastSwitchText');
  if (logEl) {
    if (hist.length > 0) {
      const latest = hist[hist.length - 1];
      const time = new Date(latest.timestamp).toLocaleTimeString('en-US', { hour12: false });
      logEl.innerHTML = `<span style="color:var(--text-primary);font-weight:600;">${latest.from || 'INIT'} ➔ ${latest.to}</span> <span style="color:var(--text-muted);">(${latest.reason || 'switch'} at ${time})</span>`;
    } else {
      logEl.textContent = 'No failovers triggered. Primary stream healthy.';
    }
  }
}

// ============================================================
// 12. DYNAMIC AUTHORITATIVE CLOCK & SYNCHRONIZED COUNTDOWN
// Strictly derives all time values from marketDataClient.getSynchronizedTime()
// Countdown formula: candleEndTimestamp - synchronizedCurrentTime
// Automatically adapts whenever measured clock offset changes (+3s -> +9s -> +4s)
// ============================================================
function _onTimeSync(syncData) {
  NC.marketState.clockOffset = syncData.currentOffset;
  NC.marketState.serverTime = syncData.serverTime;

  // Every time synchronization occurs:
  // 1. measure current clock offset -> syncData.currentOffset
  // 2. update synchronized time -> syncNowMs
  // 3. recalculate current candle boundary -> start
  // 4. recalculate candle close time -> end
  // 5. recalculate countdown -> end - syncNowSec
  const tf = NC.marketState.selectedTimeframe;
  const { start, end, syncNowSec, syncNowMs } = calculateCandleBoundaries(tf);
  NC.marketState.currentCandleStart = start;
  NC.marketState.currentCandleEnd = end;

  _tickClock(syncNowMs, start, end, syncNowSec);
}

function _tickClock(forcedSyncNowMs, forcedStart, forcedEnd, forcedSyncNowSec) {
  const syncNowMs = forcedSyncNowMs || marketDataClient.getSynchronizedTime();
  const syncNowSec = forcedSyncNowSec || (syncNowMs / 1000);
  const tf = NC.marketState.selectedTimeframe;
  const step = TF_SEC[tf] || 60;
  const candleStart = forcedStart != null ? forcedStart : (Math.floor(syncNowSec / step) * step);
  const candleEnd = forcedEnd != null ? forcedEnd : (candleStart + step);

  NC.marketState.currentCandleStart = candleStart;
  NC.marketState.currentCandleEnd = candleEnd;

  // Local Machine Time
  const localNow = new Date();
  $('ncLocalTime', localNow.toLocaleTimeString('en-US', { hour12: false }));

  // Synchronized UTC Time
  const utcDate = new Date(syncNowMs);
  const uH = String(utcDate.getUTCHours()).padStart(2, '0');
  const uM = String(utcDate.getUTCMinutes()).padStart(2, '0');
  const uS = String(utcDate.getUTCSeconds()).padStart(2, '0');
  $('ncUtcTime', `${uH}:${uM}:${uS}`);

  // Quotex Time (Asia/Kolkata UTC+5:30) strictly derived from synchronized clock
  const qtDate = new Date(syncNowMs + (5.5 * 3600 * 1000));
  const qH = String(qtDate.getUTCHours()).padStart(2, '0');
  const qM = String(qtDate.getUTCMinutes()).padStart(2, '0');
  const qS = String(qtDate.getUTCSeconds()).padStart(2, '0');
  $('ncQuotexTime', `${qH}:${qM}:${qS}`);

  // Countdown strictly calculated as: candleEndTimestamp - synchronizedCurrentTime
  const remainingSec = Math.max(0, candleEnd - syncNowSec);
  const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0');
  const ss = String(Math.floor(remainingSec % 60)).padStart(2, '0');
  $('ncCountdown', `${mm}:${ss}`);

  // Data age & latency
  const age = typeof marketDataClient?.getDataAge === 'function' ? marketDataClient.getDataAge() : null;
  if (age !== null && age !== undefined) {
    $('ncDataAge', `${age}ms`);
    $('ncDataQual', age < 3000 ? 'LIVE' : age < 10000 ? 'FAIR' : 'DELAYED');
  }
  if (marketDataClient?.syncLatency !== null && marketDataClient?.syncLatency !== undefined) {
    $('ncLatency', `${marketDataClient.syncLatency}ms`);
  }

  // Update System Status Offset badge
  const diag = typeof marketDataClient?.getSyncDiagnostics === 'function'
    ? marketDataClient.getSyncDiagnostics()
    : { currentOffset: marketDataClient?.currentOffset || 0, serverTime: Date.now() };
  const offSign = (diag?.currentOffset || 0) >= 0 ? '+' : '';
  const offSecStr = `${offSign}${((diag?.currentOffset || 0) / 1000).toFixed(2)}s`;
  const offsetLabelEl = document.getElementById('ncStatusOffset');
  if (offsetLabelEl) {
    offsetLabelEl.textContent = `${offSecStr} (DYN)`;
  }

  // Diagnostics Box live fields
  if (NC.showDiagnostics) {
    const stStr = new Date(candleStart * 1000).toUTCString().split(' ')[4];
    const endStr = new Date(candleEnd * 1000).toUTCString().split(' ')[4];
    $('ncDiagBoundary', `${stStr} → ${endStr}`);
    $('ncDiagLastChart', `${Date.now() - (NC.lastChartUpdateMs || Date.now())} ms ago`);
    $('ncDiagLastTick', `${(typeof marketDataClient?.getDataAge === 'function' ? marketDataClient.getDataAge() : 0) || 0} ms ago`);
    $('ncDiagLatency', `${marketDataClient?.syncLatency || 0} ms`);

    // Authoritative Clock Synchronization Metrics:
    // SERVER TIME, CLIENT TIME, PROVIDER TIME, CURRENT OFFSET, LAST SYNC, SYNC LATENCY
    const sDate = new Date(diag.serverTime);
    const sMs = String(diag.serverTime % 1000).padStart(3, '0');
    $('ncDiagServerTime', `${sDate.toUTCString().split(' ')[4]}.${sMs} UTC`);

    const cDate = new Date(diag.clientTime);
    const cMs = String(diag.clientTime % 1000).padStart(3, '0');
    $('ncDiagClientTime', `${cDate.toLocaleTimeString('en-US', { hour12: false })}.${cMs}`);

    const pDate = new Date(diag.providerTime);
    const pMs = String(diag.providerTime % 1000).padStart(3, '0');
    $('ncDiagProviderTime', `${pDate.toUTCString().split(' ')[4]}.${pMs} UTC`);

    $('ncDiagCurrentOffset', `${offSign}${diag.currentOffset} ms (${offSecStr})`);
    $('ncDiagLastSync', `${Math.max(0, Date.now() - (diag.lastSync || Date.now()))} ms ago`);
    $('ncDiagSyncLatency', `${diag.syncLatency} ms`);
  }

  // Check if candle rollover occurred on synchronized minute boundary
  if (NC.marketState.currentCandle && NC.marketState.currentCandle.time < candleStart) {
    _rolloverFormingCandle(candleStart, candleEnd);
  }
}

function _rolloverFormingCandle(candleStart, candleEnd) {
  const prev = NC.marketState.currentCandle;
  if (!prev) return;
  const prevClose = prev.close;

  const closedCandle = { ...prev, status: 'CLOSED' };

  let resolvedPrediction = null;
  if (NC.prediction && !NC.prediction.resolved) {
    const actualDir = closedCandle.close > closedCandle.open ? 'UP' : (closedCandle.close < closedCandle.open ? 'DOWN' : 'FLAT');
    const isCorrect = actualDir === NC.prediction.direction;
    resolvedPrediction = {
      ...NC.prediction,
      actualDirection: actualDir,
      correct: isCorrect,
      resolved: true,
      closePrice: closedCandle.close
    };
    NC.prediction.resolved = true;

    const histPred = NC.predictionHistory.find(p => p.id === NC.prediction.id);
    if (histPred) {
      Object.assign(histPred, resolvedPrediction);
    }
  }

  // Simulate server candleClose locally
  _onCandleClose({
    symbol: NC.marketState.symbol,
    timeframe: NC.marketState.selectedTimeframe,
    candle: closedCandle,
    resolvedPrediction: resolvedPrediction
  });

  const newCandle = {
    time: candleStart,
    timestamp: candleStart * 1000,
    open: prevClose,
    high: prevClose,
    low: prevClose,
    close: prevClose,
    volume: 0,
    tickCount: 0,
    spread: prev.spread || 0.0001,
    status: 'FORMING',
    timeframe: NC.marketState.selectedTimeframe,
    symbol: NC.marketState.symbol,
    startTime: candleStart,
    endTime: candleEnd,
    dataQuality: 'GOOD',
  };

  NC.marketState.currentCandle = newCandle;
  if (NC.mainSeries) {
    NC.mainSeries.update(_validateCandle(newCandle));
  }

  // Client-side Generate next prediction cycle
  if (NC.historicalCandles[NC.marketState.selectedTimeframe]) {
    const hist = NC.historicalCandles[NC.marketState.selectedTimeframe];
    // Include closed candle as it's the last finalized one
    const contextCandles = [...hist, closedCandle];

    // Sort and ensure unique by time to avoid duplicates
    const uniqueCandles = Array.from(new Map(contextCandles.map(c => [c.time, c])).values())
      .sort((a, b) => a.time - b.time);

    const indicators = calculateTechnicalIndicators(uniqueCandles);
    const strategies = evaluateTradingStrategies(uniqueCandles, indicators, null, null, null, null, null, null, { symbol: NC.marketState.symbol, timeframe: NC.marketState.selectedTimeframe });
    const prediction = generateNextCandlePrediction(uniqueCandles, indicators, strategies, NC.marketState.selectedTimeframe, { symbol: NC.marketState.symbol });

    _onPrediction({
      symbol: NC.marketState.symbol,
      timeframe: NC.marketState.selectedTimeframe,
      prediction: prediction
    });
  }
}

function _startClock() {
  if (NC.clockTimer) clearInterval(NC.clockTimer);

  // Fast 100ms clock interval for smooth countdown transitions
  NC.clockTimer = setInterval(() => {
    _tickClock();
  }, 100);

  // Background diagnostics poll every 3 seconds when diagnostics open
  NC.diagPollTimer = setInterval(() => {
    if (NC.showDiagnostics) _pollDiagnostics();
  }, 3000);
}

// ============================================================
// UI UPDATES — PRICE STRIP & CANDLE STRIP
// ============================================================
function _updatePriceStripUI(tick) {
  const digits = NC.marketState.symbol.includes('JPY') ? 3 : 5;
  const fmt = (v, d = digits) => v != null ? Number(v).toFixed(d) : '—';

  $('ncPrice', fmt(tick.mid));
  $('ncBid', fmt(tick.bid));
  $('ncAsk', fmt(tick.ask));
  $('ncSpread', fmt(tick.spread, digits + 1));
  $('ncSpreadPips', `${tick.spreadPips?.toFixed(1) || '0.8'} pips`);
  $dot('ncDotStream', 'active');
  $('ncStreamText', 'LIVE');
}

function _updateCandleStripUI(candle) {
  if (!candle) return;
  const digits = NC.marketState.symbol.includes('JPY') ? 3 : 5;
  const fmt = (v) => v != null ? Number(v).toFixed(digits) : '—';

  $('ncCandleO', fmt(candle.open));
  $('ncCandleH', fmt(candle.high));
  $('ncCandleL', fmt(candle.low));
  $('ncCandleC', fmt(candle.close));
  $('ncCandleTicks', candle.tickCount ?? 1);
}

function _updateConnectionBadge(status) {
  const map = {
    connected: { text: 'LIVE', cls: 'live', dotCls: 'active' },
    live: { text: 'LIVE', cls: 'live', dotCls: 'active' },
    resyncing: { text: 'RESYNCING', cls: 'warn', dotCls: 'warn' },
    reconnecting: { text: 'RECONNECTING', cls: 'warn', dotCls: 'warn' },
    disconnected: { text: 'DISCONNECTED', cls: 'error', dotCls: 'error' },
    error: { text: 'ERROR', cls: 'error', dotCls: 'error' },
    failed: { text: 'DISCONNECTED', cls: 'error', dotCls: 'error' },
    connecting: { text: 'CONNECTING', cls: 'warn', dotCls: 'warn' },
    'rest / periodic': { text: 'REST / PERIODIC', cls: 'warn', dotCls: 'warn' },
  };
  const s = map[status?.toLowerCase()] || map.disconnected;
  const dot = document.getElementById('ncStatusDot');
  const text = document.getElementById('ncStatusText');
  const sdot = document.getElementById('ncDotStream');
  const stxt = document.getElementById('ncStreamText');
  if (dot) dot.className = `nc-status-dot ${s.cls}`;
  if (text) text.textContent = s.text;
  if (sdot) sdot.className = `nc-dot ${s.dotCls}`;
  if (stxt) stxt.textContent = s.text;
  $('ncDiagConn', s.text);
}

// ============================================================
// PREDICTION DISPLAY — ALWAYS UP OR DOWN (NO EXCEPTIONS)
// ============================================================
function _renderPrediction(pred) {
  if (!pred) return;
  const dir = pred.direction === 'UP' ? 'UP' : 'DOWN';
  const pUp = +(pred.probability?.up * 100 || 50).toFixed(1);
  const pDown = +(pred.probability?.down * 100 || 50).toFixed(1);

  const dirEl = document.getElementById('ncPredDirValue');
  const probEl = document.getElementById('ncPredProb');
  const card = document.getElementById('ncPredDirection');

  if (dirEl) {
    dirEl.textContent = dir;
    dirEl.className = `nc-pred-dir-value ${dir.toLowerCase()}`;
  }
  if (probEl) probEl.textContent = `${dir === 'UP' ? pUp : pDown}% PROBABILITY`;
  if (card) card.className = `nc-pred-direction ${dir.toLowerCase()}`;

  const bUp = document.getElementById('ncBarUp');
  const bDown = document.getElementById('ncBarDown');
  if (bUp) bUp.style.width = Math.max(4, pUp) + '%';
  if (bDown) bDown.style.width = Math.max(4, pDown) + '%';
  $('ncProbUp', pUp + '%');
  $('ncProbDown', pDown + '%');

  const sigEl = document.getElementById('ncQuality');
  if (sigEl) {
    sigEl.textContent = pred.signalStrength || 'HIGH';
    sigEl.className = 'nc-pred-meta-val ' + (pred.signalStrength === 'HIGH' ? 'high' : pred.signalStrength === 'MEDIUM' ? 'medium' : 'low');
  }

  if (NC.predictionTime) {
    const qtPred = new Date(NC.predictionTime.getTime() + (5.5 * 3600 * 1000));
    const pH = String(qtPred.getUTCHours()).padStart(2, '0');
    const pM = String(qtPred.getUTCMinutes()).padStart(2, '0');
    const pS = String(qtPred.getUTCSeconds()).padStart(2, '0');
    $('ncPredTime', `${pH}:${pM}:${pS} (QTX)`);
  }
  $('ncRegimeLabel', `Regime: ${pred.regime || 'TRENDING'}`);

  _updateEvidenceGrid(pred);
  _renderMarketSummary(pred);
  if (pred.indicators?.length) _renderIndicatorList(pred.indicators);
  if (pred.strategies?.length) _renderStrategyList(pred.strategies);
  if (pred.supportResistance) _renderSupportResistance(pred.supportResistance, NC.marketState.mid);
  if (pred.orderBlocks) _renderOrderBlocks(pred.orderBlocks, NC.marketState.mid);
  if (pred.marketStructure && pred.priceAction) _renderMarketStructure(pred.marketStructure, pred.priceAction);

  $dot('ncDotModel', 'active');
  $('ncModelText', 'ACTIVE');
}

function _renderMarketSummary(pred) {
  const assetTf = document.getElementById('ncSummaryAssetTF');
  if (assetTf) assetTf.textContent = `${NC.marketState.symbol} · ${NC.marketState.selectedTimeframe}`;

  const regEl = document.getElementById('ncSummaryRegime');
  if (regEl) regEl.textContent = (pred.regime || 'RANGE BOUND').replace(/_/g, ' ');

  const biasEl = document.getElementById('ncSummaryBias');
  if (biasEl) {
    const isUp = pred.direction === 'UP';
    biasEl.textContent = isUp ? 'BULLISH BIAS' : 'BEARISH BIAS';
    biasEl.className = 'nc-summary-val ' + (isUp ? 'bull' : 'bear');
  }

  let bullCount = 0, bearCount = 0, waitCount = 0;
  for (const s of (pred.strategies || [])) {
    if (s.signal === 'BULLISH') bullCount++;
    else if (s.signal === 'BEARISH') bearCount++;
    else waitCount++;
  }
  $('ncSummaryBull', `${bullCount}▲`);
  $('ncSummaryBear', `${bearCount}▼`);
  $('ncSummaryWait', `${waitCount}⧗`);

  const srEl = document.getElementById('ncSummarySR');
  if (srEl && pred.supportResistance) {
    const digits = NC.marketState.symbol.includes('JPY') ? 3 : 5;
    const supStr = pred.supportResistance.nearestSupport ? pred.supportResistance.nearestSupport.price.toFixed(digits) : '—';
    const resStr = pred.supportResistance.nearestResistance ? pred.supportResistance.nearestResistance.price.toFixed(digits) : '—';
    srEl.textContent = `${supStr} / ${resStr}`;
  }

  const obEl = document.getElementById('ncSummaryOB');
  if (obEl && pred.orderBlocks) {
    const digits = NC.marketState.symbol.includes('JPY') ? 3 : 5;
    const bullOBStr = pred.orderBlocks.nearestBullishOB ? pred.orderBlocks.nearestBullishOB.mid.toFixed(digits) : '—';
    const bearOBStr = pred.orderBlocks.nearestBearishOB ? pred.orderBlocks.nearestBearishOB.mid.toFixed(digits) : '—';
    obEl.textContent = `${bullOBStr} / ${bearOBStr}`;
  }
}

function _updateEvidenceGrid(pred) {
  const f = pred.features || {};
  const rd = pred.regimeData || {};
  const ta = pred.tickActivity || {};

  // Volatility formatting
  let volLabel = 'VOLATILITY';
  let volVal = 'NORMAL';
  let volDir = 'neut';
  if (rd.volatilityState) {
    volVal = rd.volatilityState;
    if (volVal.includes('HIGH')) volDir = 'bull';
    if (volVal.includes('LOW')) volDir = 'bear';
  }

  // Regime formatting
  let regVal = (pred.regime || 'UNCERTAIN').replace(/_/g, ' ');
  let regDir = pred.regime === 'TRENDING_UP' ? 'bull' : pred.regime === 'TRENDING_DOWN' ? 'bear' : 'neut';

  // Tick Activity formatting
  let tickVal = 'NORMAL';
  let tickDir = 'neut';
  if (ta.activityLevel) {
    tickVal = ta.activityLevel.replace('_', ' ');
    if (ta.activityLevel.includes('HIGH')) tickDir = 'bull';
    if (ta.activityLevel.includes('LOW')) tickDir = 'bear';
  }

  // Spread formatting
  let spreadVal = ta.spreadQuality || pred.spreadAssessment?.quality || 'NORMAL';
  let spreadDir = spreadVal === 'TIGHT' ? 'bull' : spreadVal === 'WIDE' ? 'bear' : 'neut';

  const rows = [
    { label: 'TREND', dir: f.emaAligned > 0 ? 'bull' : f.emaAligned < 0 ? 'bear' : 'neut', val: f.emaAligned > 0 ? 'Bullish' : f.emaAligned < 0 ? 'Bearish' : 'Neutral', fill: f.emaAligned > 0 ? 75 : f.emaAligned < 0 ? 25 : 50 },
    { label: 'MOMENTUM', dir: (f.rsi) > 50 ? 'bull' : 'bear', val: `RSI ${(f.rsi)?.toFixed(0) || '—'}`, fill: f.rsi ? Math.min(95, Math.max(5, f.rsi)) : 50 },
    { label: 'PRICE ACTION', dir: f.engulfingBull ? 'bull' : f.engulfingBear ? 'bear' : f.bodyDir > 0 ? 'bull' : f.bodyDir < 0 ? 'bear' : 'neut', val: f.engulfingBull ? 'Bull Engulf' : f.engulfingBear ? 'Bear Engulf' : f.pinBarBull ? 'Pin ↑' : f.pinBarBear ? 'Pin ↓' : f.insideBar ? 'Inside Bar' : f.outsideBar ? 'Outside Bar' : 'Continuous', fill: f.bodyDir > 0 ? 70 : f.bodyDir < 0 ? 30 : 50 },
    { label: 'VOLATILITY', dir: volDir, val: volVal, fill: volDir === 'bull' ? 80 : volDir === 'bear' ? 20 : 50 },
    { label: 'TICK ACTIVITY', dir: tickDir, val: tickVal, fill: tickDir === 'bull' ? 80 : tickDir === 'bear' ? 20 : 50 },
    { label: 'STATISTICS', dir: f.zScore > 1.5 ? 'bull' : f.zScore < -1.5 ? 'bear' : 'neut', val: `Z ${f.zScore?.toFixed(2) || '0.00'}`, fill: Math.min(90, Math.max(10, 50 + (f.zScore || 0) * 15)) },
    { label: 'MARKET REGIME', dir: regDir, val: regVal, fill: regDir === 'bull' ? 80 : regDir === 'bear' ? 20 : 50 },
    { label: 'SESSION', dir: 'neut', val: (pred.session || 'LONDON').replace(/_/g, ' '), fill: 50 },
    { label: 'SPREAD', dir: spreadDir, val: spreadVal, fill: spreadDir === 'bull' ? 80 : spreadDir === 'bear' ? 20 : 50 },
  ];

  const grid = document.getElementById('ncEvidenceGrid');
  if (!grid) return;
  grid.innerHTML = rows.map(r => `
    <div class="nc-evidence-row">
      <span class="nc-evidence-label">${r.label}</span>
      <div class="nc-evidence-bar"><div class="nc-evidence-fill ${r.dir}" style="width:${Math.max(4, Math.min(96, r.fill))}%"></div></div>
      <span class="nc-evidence-val ${r.dir}">${r.val}</span>
    </div>
  `).join('');
}

function _renderIndicatorList(indicators) {
  let bull = 0, bear = 0, neut = 0;
  const list = document.getElementById('ncIndicatorList');
  if (!list) return;
  list.innerHTML = indicators.map(ind => {
    const cls = ind.signal === 'BULLISH' ? 'bull' : ind.signal === 'BEARISH' ? 'bear' : 'neut';
    const arrow = ind.signal === 'BULLISH' ? '▲' : ind.signal === 'BEARISH' ? '▼' : '→';
    if (ind.signal === 'BULLISH') bull++;
    else if (ind.signal === 'BEARISH') bear++;
    else neut++;
    return `<div class="nc-ind-row">
      <span class="nc-ind-name" title="${ind.name}">${ind.name}</span>
      <span class="nc-ind-val mono">${ind.value || '—'}</span>
      <span class="nc-ind-sig ${cls}">${arrow} ${ind.signal}</span>
    </div>`;
  }).join('');
  $('ncIndBull', `${bull} ▲`);
  $('ncIndBear', `${bear} ▼`);
  $('ncIndNeut', `${neut} →`);
}

// Global UI interaction helpers
window.__toggleStratDetail = function(stratId) {
  const el = document.getElementById('detail_' + stratId);
  if (!el) return;
  const isHidden = el.style.display === 'none' || !el.style.display;
  el.style.display = isHidden ? 'flex' : 'none';
};

window.__toggleCategory = function(catId) {
  const body = document.getElementById('catBody_' + catId);
  const header = document.getElementById('catHeader_' + catId);
  if (!body) return;
  body.classList.toggle('is-collapsed');
  header?.classList.toggle('collapsed');
};

function _renderStrategyList(strategies) {
  let globalBull = 0, globalBear = 0, globalWait = 0;
  const list = document.getElementById('ncStrategyList');
  if (!list) return;

  const grouped = {};
  for (const s of strategies) {
    const cat = s.category || 'Uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }

  // If 1M is active, prioritize M1 SCALPING STRATEGIES at the top
  const catKeys = Object.keys(grouped);
  catKeys.sort((a, b) => {
    if (a === 'M1 SCALPING STRATEGIES') return -1;
    if (b === 'M1 SCALPING STRATEGIES') return 1;
    return a.localeCompare(b);
  });

  let html = '';
  for (const cat of catKeys) {
    const strats = grouped[cat];
    let catBull = 0, catBear = 0, catWait = 0;
    const catId = cat.replace(/[^a-zA-Z0-9]/g, '_');
    const isM1Cat = cat === 'M1 SCALPING STRATEGIES';

    let stratItemsHtml = '';
    for (const s of strats) {
      const isBull = s.signal === 'BULLISH';
      const isBear = s.signal === 'BEARISH';
      const isWait = s.signal === 'WAIT';
      const isUnver = s.signal === 'EXECUTION NOT VERIFIED';

      const badgeCls = isBull ? 'bull' : isBear ? 'bear' : isUnver ? 'unver' : isWait ? 'wait' : 'noval';
      const badgeText = isBull ? 'BUY ▲' : isBear ? 'SELL ▼' : isUnver ? 'UNVERIFIED' : isWait ? 'WAIT ⧗' : 'NO SETUP';

      if (isBull) { catBull++; globalBull++; }
      else if (isBear) { catBear++; globalBear++; }
      else { catWait++; globalWait++; }

      const statusSnippet = s.status ? s.status.replace(/^BULLISH SETUP — |^BEARISH SETUP — |^WAIT — /, '') : (s.evidence || '');
      const sId = s.id ? s.id.replace(/[^a-zA-Z0-9_]/g, '_') : ('st_' + Math.random().toString(36).substring(2, 7));

      stratItemsHtml += `
      <div class="nc-strat-item">
        <div class="nc-strat-row" onclick="window.__toggleStratDetail('${sId}')" title="${s.name} — Click to expand technical details">
          <span class="nc-strat-name">${s.name}</span>
          <span class="nc-strat-badge ${badgeCls}">${badgeText}</span>
          <span class="nc-strat-status">${statusSnippet}</span>
          <span class="nc-strat-chevron">▾</span>
        </div>
        <div class="nc-strat-detail" id="detail_${sId}" style="display:none;">
          <div class="nc-detail-explanation"><strong>Analysis:</strong> ${s.evidence || 'Evaluating price action and structure.'}</div>
          <div class="nc-detail-tags">
            ${(s.conditionsMet || []).map(c => `<span class="nc-tag met">✓ ${c}</span>`).join('')}
            ${(s.conditionsUnmet || []).map(c => `<span class="nc-tag unmet">⏳ ${c}</span>`).join('')}
          </div>
          <div class="nc-detail-meta">
            <div><span>Trigger:</span> <span class="mono">${s.trigger || 'Confirmation'}</span></div>
            <div><span>Invalidation:</span> <span class="mono">${s.invalidation || 'Boundary'}</span></div>
            <div><span>Level:</span> <span class="mono">${s.relevantLevel || 'S/R zone'}</span></div>
            <div><span>Quality / Cost:</span> <span class="mono">${s.qualityScore || 50}/100 · ${s.costEvaluation || 'Normal'}</span></div>
          </div>
        </div>
      </div>`;
    }

    // Collapsible Category Section
    html += `
    <div class="nc-category-group">
      <div class="nc-category-header" id="catHeader_${catId}" onclick="window.__toggleCategory('${catId}')">
        <span class="nc-cat-title ${isM1Cat ? 'is-m1' : ''}">
          <span class="nc-cat-icon">▾</span> ${cat} (${strats.length})
        </span>
        <span class="nc-cat-counts">
          <span class="bull">${catBull}▲</span>
          <span class="bear">${catBear}▼</span>
          <span class="neut">${catWait}⧗</span>
        </span>
      </div>
      <div class="nc-category-body" id="catBody_${catId}">
        ${stratItemsHtml}
      </div>
    </div>`;
  }

  list.innerHTML = html;

  $('ncStratBull', `${globalBull} ▲`);
  $('ncStratBear', `${globalBear} ▼`);
  $('ncStratNeut', `${globalWait} ⧗`);
}

function _renderSupportResistance(sr, currentPrice) {
  const grid = document.getElementById('ncSRGrid');
  if (!grid || !sr) return;

  const digits = NC.marketState.symbol.includes('JPY') ? 3 : 5;
  const fmt = (v) => v != null ? Number(v).toFixed(digits) : '—';
  const pipMult = digits === 3 ? 100 : 10000;

  let html = '';

  if (sr.nearestResistance) {
    const pips = (sr.nearestResistance.distance * pipMult).toFixed(1);
    const freshness = sr.nearestResistance.freshness || 'ACTIVE';
    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;">
      <span style="color:var(--red-text);font-weight:700;">RES: ${fmt(sr.nearestResistance.price)}</span>
      <span class="mono" style="font-size:10px;">${pips} pips · <span class="nc-tag ${freshness === 'FRESH' ? 'met' : 'unmet'}">${freshness}</span></span>
    </div>`;
  } else {
    html += `<div style="color:var(--text-muted);padding:2px 0;">RES: None nearby</div>`;
  }

  if (sr.nearestSupport) {
    const pips = (sr.nearestSupport.distance * pipMult).toFixed(1);
    const freshness = sr.nearestSupport.freshness || 'ACTIVE';
    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;border-top:1px solid var(--border-subtle);margin-top:2px;padding-top:2px;">
      <span style="color:var(--green-text);font-weight:700;">SUP: ${fmt(sr.nearestSupport.price)}</span>
      <span class="mono" style="font-size:10px;">${pips} pips · <span class="nc-tag ${freshness === 'FRESH' ? 'met' : 'unmet'}">${freshness}</span></span>
    </div>`;
  } else {
    html += `<div style="color:var(--text-muted);padding:2px 0;border-top:1px solid var(--border-subtle);margin-top:2px;padding-top:2px;">SUP: None nearby</div>`;
  }

  _drawSRZonesOnChart(sr);
  grid.innerHTML = html;
}

function _renderOrderBlocks(ob, currentPrice) {
  const grid = document.getElementById('ncOBGrid');
  if (!grid || !ob) return;

  const digits = NC.marketState.symbol.includes('JPY') ? 3 : 5;
  const fmt = (v) => v != null ? Number(v).toFixed(digits) : '—';
  const pipMult = digits === 3 ? 100 : 10000;

  const countEl = document.getElementById('ncOBCount');
  if (countEl) countEl.textContent = `${ob.activeOrderBlocks?.length || 0} Active`;

  let html = '';

  if (ob.nearestBearishOB) {
    const o = ob.nearestBearishOB;
    const pips = (o.distance * pipMult).toFixed(1);
    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;">
      <span style="color:var(--orange-text, #f97316);font-weight:700;">BEAR OB: ${fmt(o.low)}–${fmt(o.high)}</span>
      <span class="mono" style="font-size:10px;">${pips} pips · <span class="nc-tag ${o.status === 'UNTESTED' ? 'met' : 'unmet'}">${o.status}</span></span>
    </div>`;
  } else {
    html += `<div style="color:var(--text-muted);padding:2px 0;">BEAR OB: None nearby</div>`;
  }

  if (ob.nearestBullishOB) {
    const o = ob.nearestBullishOB;
    const pips = (o.distance * pipMult).toFixed(1);
    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;border-top:1px solid var(--border-subtle);margin-top:2px;padding-top:2px;">
      <span style="color:var(--cyan-text, #06b6d4);font-weight:700;">BULL OB: ${fmt(o.low)}–${fmt(o.high)}</span>
      <span class="mono" style="font-size:10px;">${pips} pips · <span class="nc-tag ${o.status === 'UNTESTED' ? 'met' : 'unmet'}">${o.status}</span></span>
    </div>`;
  } else {
    html += `<div style="color:var(--text-muted);padding:2px 0;border-top:1px solid var(--border-subtle);margin-top:2px;padding-top:2px;">BULL OB: None nearby</div>`;
  }

  _drawOrderBlocksOnChart(ob);
  grid.innerHTML = html;
}

let _srLines = [];
function _drawSRZonesOnChart(sr) {
  if (!NC.chart || !NC.mainSeries) return;
  _srLines.forEach(line => {
    try { NC.mainSeries.removePriceLine(line); } catch (e) {}
  });
  _srLines = [];

  const addLine = (price, color, title) => {
    try {
      const line = NC.mainSeries.createPriceLine({
        price: price,
        color: color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: title,
      });
      _srLines.push(line);
    } catch (e) {}
  };

  if (sr?.nearestResistance) addLine(sr.nearestResistance.price, '#ef4444', 'Res');
  if (sr?.nearestSupport) addLine(sr.nearestSupport.price, '#22c55e', 'Sup');
}

let _obLines = [];
function _drawOrderBlocksOnChart(ob) {
  if (!NC.chart || !NC.mainSeries) return;
  _obLines.forEach(line => {
    try { NC.mainSeries.removePriceLine(line); } catch (e) {}
  });
  _obLines = [];

  const addLine = (price, color, title) => {
    try {
      const line = NC.mainSeries.createPriceLine({
        price: price,
        color: color,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: title,
      });
      _obLines.push(line);
    } catch (e) {}
  };

  if (ob?.nearestBearishOB) {
    addLine(ob.nearestBearishOB.mid, '#f97316', 'Bear OB');
  }
  if (ob?.nearestBullishOB) {
    addLine(ob.nearestBullishOB.mid, '#06b6d4', 'Bull OB');
  }
}

function _renderMarketStructure(struct, pa) {
  const grid = document.getElementById('ncStructGrid');
  if (!grid || !struct || !pa) return;

  const digits = NC.marketState.symbol.includes('JPY') ? 3 : 5;
  const fmt = (v) => v != null ? Number(v).toFixed(digits) : '—';

  let html = '';

  // Trend & BOS
  const trendCol = struct.trend === 'BULLISH' ? 'var(--green-text)' : struct.trend === 'BEARISH' ? 'var(--red-text)' : 'var(--text-primary)';
  html += `<div style="display:flex;justify-content:space-between;padding:2px 0;">
    <span>TREND (H/L):</span>
    <span style="color:${trendCol};font-weight:bold;">${struct.trend}</span>
  </div>`;

  if (struct.lastEvent) {
    html += `<div style="display:flex;justify-content:space-between;padding:2px 0;">
      <span>LAST BREAK:</span>
      <span class="mono">${struct.lastEvent}</span>
    </div>`;
  }

  // Sweeps
  if (struct.liquidity.hasSweep) {
    html += `<div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--yellow-text);">
      <span>LIQUIDITY SWEEP:</span>
      <span class="mono">${struct.liquidity.sweepType} @ ${fmt(struct.liquidity.sweepPrice)}</span>
    </div>`;
  }

  if (struct.liquidity.equalHighs) {
    html += `<div style="display:flex;justify-content:space-between;padding:2px 0;">
      <span>EQUAL HIGHS:</span>
      <span class="mono">${fmt(struct.liquidity.equalHighs)}</span>
    </div>`;
  }
  if (struct.liquidity.equalLows) {
    html += `<div style="display:flex;justify-content:space-between;padding:2px 0;">
      <span>EQUAL LOWS:</span>
      <span class="mono">${fmt(struct.liquidity.equalLows)}</span>
    </div>`;
  }

  // Price Action
  const pats = [];
  if (pa.patterns.isBullEngulf) pats.push('Bull Engulf');
  if (pa.patterns.isBearEngulf) pats.push('Bear Engulf');
  if (pa.patterns.isHammer) pats.push('Hammer');
  if (pa.patterns.isShootingStar) pats.push('Shooting Star');
  if (pa.patterns.isInsideBar) pats.push('Inside Bar');
  if (pa.patterns.isOutsideBar) pats.push('Outside Bar');
  if (pa.patterns.isMomentum) pats.push('Momentum Expand');

  html += `<div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--border-subtle);margin-top:4px;">
    <span>CANDLE PATTERN:</span>
    <span class="mono" style="color:var(--blue-text);">${pats.length ? pats.join(', ') : 'None'}</span>
  </div>`;

  grid.innerHTML = html;
}

function _appendPredictionHistory(resolved) {
  NC.predictionHistory.unshift(resolved);
  if (NC.predictionHistory.length > 200) NC.predictionHistory.pop();
  _renderHistoryTable();
}

function _renderHistoryTable() {
  const tbody = document.getElementById('ncHistoryBody');
  if (!tbody) return;
  if (!NC.predictionHistory.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="nc-table-empty">Awaiting first prediction cycle...</td></tr>';
    return;
  }
  tbody.innerHTML = NC.predictionHistory.slice(0, 50).map(p => {
    const time = p.predictionTimestamp ? new Date(p.predictionTimestamp).toLocaleTimeString('en-US', { hour12: false }) : '—';
    const dirCls = p.direction === 'UP' ? 'bull' : 'bear';
    const actCls = p.actualDirection === 'UP' ? 'bull' : p.actualDirection === 'DOWN' ? 'bear' : '';
    const resCls = !p.resolved ? 'result-pending' : p.correct ? 'result-correct' : 'result-wrong';
    const resText = !p.resolved ? '•' : p.correct ? '✓' : '✗';
    const pct = p.probability ? `${Math.round(Math.max(p.probability.up, p.probability.down) * 100)}%` : '—';
    const spreadQ = p.spreadAssessment?.quality || p.tickActivity?.spreadQuality || 'NORMAL';
    const regime = (p.regimeData?.regime || p.regime || '—').replace(/_/g, ' ');

    let ctx = '';
    if (p.marketStructure?.liquidity?.hasSweep) ctx += '<span style="color:var(--yellow-text);" title="Liquidity Sweep">SWP</span> ';
    if (p.regimeData?.regime?.includes('BREAKOUT')) ctx += '<span style="color:var(--blue-text);" title="Breakout">BRK</span> ';
    if (p.marketStructure?.lastEvent?.includes('BOS')) ctx += '<span style="color:var(--text-primary);" title="Break of Structure">BOS</span> ';
    if (p.marketStructure?.lastEvent?.includes('CHOCH')) ctx += '<span style="color:var(--text-primary);" title="Change of Character">CHoCH</span> ';
    if (p.priceAction?.patterns?.isBullEngulf || p.priceAction?.patterns?.isBearEngulf) ctx += '<span style="color:var(--purple-text);" title="Engulfing Pattern">ENG</span> ';
    if (!ctx) ctx = '<span style="color:var(--text-muted);">—</span>';

    return `<tr class="${!p.resolved ? 'nc-row-pending' : ''}">
      <td class="mono">${time}</td>
      <td>${p.pair || '—'}</td>
      <td>${p.timeframe || '—'}</td>
      <td class="nc-td-pred ${dirCls}">${p.direction || '—'}</td>
      <td class="mono">${pct}</td>
      <td class="${actCls}">${p.actualDirection || '—'}</td>
      <td class="${resCls}">${resText}</td>
      <td>${spreadQ}</td>
      <td class="mono" style="font-size:9px;">${regime}</td>
      <td class="mono" style="font-size:9px;">${ctx}</td>
    </tr>`;
  }).join('');
}

function _updatePerformanceStats() {
  const resolved = NC.predictionHistory.filter(p => p.resolved);
  const n = resolved.length;
  const correct = resolved.filter(p => p.correct).length;
  $('ncSampleN', n.toString());
  if (n >= 5) {
    $('ncPrecision', (correct / n * 100).toFixed(1) + '%');
  } else {
    $('ncPrecision', `N/A (${5 - n} more)`);
  }
  const statsEl = document.getElementById('ncHistStats');
  if (statsEl) statsEl.textContent = n >= 5 ? `Precision: ${(correct / n * 100).toFixed(1)}% · N=${n}` : `N=${n}`;
}

function _resetPredictionUI() {
  $('ncPredDirValue', '—');
  $('ncPredProb', '');
  $('ncProbUp', '50.0%');
  $('ncProbDown', '50.0%');
  const bUp = document.getElementById('ncBarUp');
  const bDn = document.getElementById('ncBarDown');
  if (bUp) bUp.style.width = '50%';
  if (bDn) bDn.style.width = '50%';
  const card = document.getElementById('ncPredDirection');
  if (card) card.className = 'nc-pred-direction';
  const dirEl = document.getElementById('ncPredDirValue');
  if (dirEl) dirEl.className = 'nc-pred-dir-value';
}

function _flashPredictionCard() {
  const card = document.getElementById('ncPredictionCard');
  if (card) {
    card.classList.add('nc-flash');
    setTimeout(() => card.classList.remove('nc-flash'), 800);
  }
}

// Helpers
function $(id, text) { const e = document.getElementById(id); if (e) e.textContent = text; }
function $dot(id, cls) { const e = document.getElementById(id); if (e) e.className = `nc-dot ${cls}`; }
