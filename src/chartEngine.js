// ============================================================
// ForFuture — Chart Engine (v4.0)
// High-performance charting powered by lightweight-charts v5
// Supports OANDA Forex pipeline, multi-asset data, incremental
// live updates, decoupled viewport state, and ResizeObserver
// ============================================================

import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import {
  generateVolumeData,
  generateLineData,
  generateEquityCurveData,
} from './data.js';
import { chartOptionsState, setupChartPageInteractivity } from './pages/chart.js';
import { marketDataClient, formatTradingTime, validateCandles, normalizeCandle } from './marketDataClient.js';

const chartInstances = [];
let currentChartType = 'candle';

// Active diagnostics state accessible by Developer Diagnostics Panel
export const chartDiagnosticsState = {
  provider: 'OANDA',
  symbol: 'EUR/USD',
  providerSymbol: 'EUR_USD',
  assetType: 'FOREX',
  timeframe: '1D',
  priceBasis: 'MID',
  lastTick: null,
  lastCandle: null,
  currentCandle: null,
  dataAgeMs: 0,
  connection: 'CONNECTING',
  historicalCount: 0,
  liveSubscription: 'Active',
  viewportState: 'Live Edge',
  isAtLiveEdge: true,
  scrollToLiveFn: null,
};

export function initCharts(state) {
  // Clean up any existing chart instances to avoid canvas/memory leaks
  chartInstances.forEach(item => {
    try {
      if (item.cleanup) item.cleanup();
      if (item.resizeObserver) item.resizeObserver.disconnect();
      if (item && item.chart && typeof item.chart.remove === 'function') {
        item.chart.remove();
      }
    } catch (e) {
      /* ignore */
    }
  });
  chartInstances.length = 0;

  // Find all chart containers
  const containers = document.querySelectorAll('[data-chart]');
  if (!containers.length) return;

  const symbol = state && state.currentAsset ? state.currentAsset : 'EUR/USD';
  const globalTf = state && state.timeframe ? state.timeframe : '1D';

  containers.forEach(container => {
    const defaultType = container.dataset.chart || 'candle';
    const isMainChart = container.classList.contains('chart-area') || container.dataset.main === 'true';
    const chartType = isMainChart ? currentChartType : defaultType;

    // Use container-specific timeframe if specified (e.g. in multi-layout 2H and 4)
    const tf = (container.dataset.tf || globalTf).toUpperCase();
    const isIntraday = ['1M', '2M', '3M', '4M', '5M', '15M', '30M', '1H', '2H', '4H'].includes(tf);

    // Ensure container has minimum height
    const containerHeight = container.clientHeight || parseInt(container.style.height, 10) || 380;
    const containerWidth = container.clientWidth || 600;

    // Clear any previous overlay messages
    const prevOverlay = container.querySelector('.chart-status-overlay');
    if (prevOverlay) prevOverlay.remove();

    const chart = createChart(container, {
      autoSize: false,
      width: containerWidth,
      height: containerHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#0f1117' },
        textColor: '#8b949e',
        fontSize: 11,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(59,130,246,0.5)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e2230',
        },
        horzLine: {
          color: 'rgba(59,130,246,0.5)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e2230',
        },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: isIntraday,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 10,
        minBarSpacing: 3,
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        vertTouchDrag: false,
        horzTouchDrag: true,
        mouseWheel: true,
        pressedMouseMove: true,
      },
    });

    // ResizeObserver: auto-resizes chart container flawlessly
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height, autoSize: false });
        }
      }
    });
    resizeObserver.observe(container);

    let mainSeries = null;
    let volumeSeries = null;
    let sma20Series = null;
    let sma50Series = null;
    let ema200Series = null;
    let bbUpperSeries = null;
    let bbLowerSeries = null;
    let compareSeries = null;
    let currentCandleData = [];
    let isAtLiveEdge = true;

    // Viewport State Tracking (Requirement 9: CHART VIEWPORT MUST NEVER STOP LIVE DATA)
    chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (!range || !currentCandleData.length) return;
      const totalBars = currentCandleData.length;
      // If right edge is within 4 bars of live candle, consider user at live edge
      isAtLiveEdge = range.to >= totalBars - 4;
      chartDiagnosticsState.isAtLiveEdge = isAtLiveEdge;
      chartDiagnosticsState.viewportState = isAtLiveEdge ? 'Live Edge' : 'Browsing History';
      updateViewportStatusBadge(isAtLiveEdge);
    });

    // Scroll to Realtime function for "GO TO LIVE"
    const scrollToLive = () => {
      isAtLiveEdge = true;
      chartDiagnosticsState.isAtLiveEdge = true;
      chartDiagnosticsState.viewportState = 'Live Edge';
      try {
        chart.timeScale().scrollToRealtime();
      } catch (e) {
        chart.timeScale().fitContent();
      }
      updateViewportStatusBadge(true);
    };

    if (isMainChart) {
      chartDiagnosticsState.scrollToLiveFn = scrollToLive;
    }

    // ==========================================
    // BACKTEST EQUITY CURVE
    // ==========================================
    if (chartType === 'equity') {
      const equityData = generateEquityCurveData(100000, 0.74, '2024-01-02', '2026-09-28');
      mainSeries = chart.addSeries(AreaSeries, {
        lineColor: '#3b82f6',
        topColor: 'rgba(59,130,246,0.3)',
        bottomColor: 'rgba(59,130,246,0.02)',
        lineWidth: 2,
        priceFormat: {
          type: 'custom',
          formatter: val => '$' + (val / 1000).toFixed(1) + 'k',
        },
      });
      mainSeries.setData(equityData);
      chart.timeScale().fitContent();
      chartInstances.push({ chart, container, mainSeries, type: 'equity', resizeObserver });
      return;
    }

    // ==========================================
    // CANDLESTICK CHART (Main or Research)
    // ==========================================
    if (chartType === 'candle') {
      currentCandleData = [];

      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });

      // Volume histogram overlay
      if (chartOptionsState.indicators.volume) {
        volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        });
        try {
          chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.82, bottom: 0 },
          });
        } catch (e) { }
      }

      // Technical indicators overlay on main charts
      if (isMainChart) {
        if (chartOptionsState.indicators.sma20) {
          sma20Series = chart.addSeries(LineSeries, {
            color: '#f59e0b',
            lineWidth: 1.5,
            title: 'SMA 20',
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
        }

        if (chartOptionsState.indicators.sma50) {
          sma50Series = chart.addSeries(LineSeries, {
            color: '#3b82f6',
            lineWidth: 1.5,
            title: 'SMA 50',
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
        }

        if (chartOptionsState.indicators.ema200) {
          ema200Series = chart.addSeries(LineSeries, {
            color: '#a855f7',
            lineWidth: 2,
            title: 'EMA 200',
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
        }

        if (chartOptionsState.indicators.bollinger) {
          bbUpperSeries = chart.addSeries(LineSeries, {
            color: 'rgba(6, 182, 212, 0.75)',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            title: 'BB Upper',
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });

          bbLowerSeries = chart.addSeries(LineSeries, {
            color: 'rgba(6, 182, 212, 0.75)',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            title: 'BB Lower',
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
        }
      }

      // Crosshair legend update
      chart.subscribeCrosshairMove(param => {
        updateOHLCLegend(param, mainSeries, currentCandleData, compareSeries, symbol);
      });

      // Data Handler with Incremental Updates
      const updateChartData = (data, isHistory = false) => {
        if (data.symbol !== symbol || data.timeframe !== tf) return;

        // Check for UNAVAILABLE state
        if (isHistory && (!data.candles || data.candles.length === 0)) {
          if (data.marketStatus === 'UNAVAILABLE' || !data.isConfigured) {
            showUnavailableOverlay(container, symbol);
            return;
          }
        }
        hideUnavailableOverlay(container);

        if (isHistory && data.candles) {
          currentCandleData = validateCandles(data.candles);
          if (currentCandleData.length === 0) return;

          mainSeries.setData(currentCandleData);

          if (volumeSeries) {
            volumeSeries.setData(currentCandleData.map(c => ({
              time: c.time,
              value: c.volume || 0,
              color: c.close >= c.open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
            })));
          }

          // Initial autoscale / view range
          const totalBars = currentCandleData.length;
          requestAnimationFrame(() => {
            try {
              chart.timeScale().setVisibleLogicalRange({
                from: Math.max(0, totalBars - 120),
                to: totalBars + 5,
              });
            } catch (e) {
              chart.timeScale().fitContent();
            }
          });

          // Diagnostics
          chartDiagnosticsState.provider = data.provider || (symbol.includes('/') ? 'OANDA' : 'Market');
          chartDiagnosticsState.providerSymbol = data.providerSymbol || symbol;
          chartDiagnosticsState.symbol = symbol;
          chartDiagnosticsState.timeframe = tf;
          chartDiagnosticsState.historicalCount = currentCandleData.length;
          chartDiagnosticsState.lastCandle = currentCandleData[currentCandleData.length - 1];

          // Compute initial indicators
          updateIndicators(currentCandleData);

        } else if (data.candle) {
          // Live forming candle incremental update (Requirement 6 & 8)
          const norm = normalizeCandle(data.candle);
          mainSeries.update(norm);

          if (currentCandleData.length > 0) {
            const last = currentCandleData[currentCandleData.length - 1];
            if (last.time === norm.time) {
              currentCandleData[currentCandleData.length - 1] = norm;
            } else if (norm.time > last.time) {
              currentCandleData.push(norm);
              if (currentCandleData.length > 3000) currentCandleData.shift();
            }
          } else {
            currentCandleData = [norm];
          }

          if (volumeSeries) {
            volumeSeries.update({
              time: norm.time,
              value: norm.volume || 1,
              color: norm.close >= norm.open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
            });
          }

          // If user is at live edge, follow latest candle automatically
          if (isAtLiveEdge) {
            try {
              chart.timeScale().scrollToRealtime();
            } catch (e) { }
          }

          // Update diagnostics
          chartDiagnosticsState.currentCandle = norm;
          chartDiagnosticsState.lastTick = norm.close;
          chartDiagnosticsState.dataAgeMs = Date.now() - (norm.time * 1000);

          // Update OHLC bar
          updateOHLCLegend(null, mainSeries, currentCandleData, compareSeries, symbol);

          if (data.isClosed) {
            updateIndicators(currentCandleData);
          }
        }
      };

      const updateIndicators = (candles) => {
        if (!candles || candles.length < 20) return;
        if (sma20Series) sma20Series.setData(calculateSMA(candles, 20));
        if (sma50Series) sma50Series.setData(calculateSMA(candles, 50));
        if (ema200Series) ema200Series.setData(calculateEMA(candles, 200));
        if (chartOptionsState.indicators.bollinger && bbUpperSeries && bbLowerSeries) {
          const bb = calculateBollingerBands(candles, 20, 2);
          bbUpperSeries.setData(bb.upper);
          bbLowerSeries.setData(bb.lower);
        }
      };

      const handleHistory = (d) => updateChartData(d, true);
      const handleTick = (d) => updateChartData(d, false);
      const handleClose = (d) => updateChartData({ ...d, isClosed: true }, false);
      const handleStatus = (d) => {
        chartDiagnosticsState.connection = d.status || 'LIVE';
      };

      marketDataClient.on('historicalCandles', handleHistory);
      marketDataClient.on('candleUpdate', handleTick);
      marketDataClient.on('candleClose', handleClose);
      marketDataClient.on('statusChange', handleStatus);

      // Subscribe to symbol and timeframe
      if (marketDataClient.isConnected) {
        marketDataClient.subscribe(symbol, [tf]);
      } else {
        marketDataClient.connect();
        marketDataClient.subscribe(symbol, [tf]);
      }

      const cleanupFn = () => {
        marketDataClient.off('historicalCandles', handleHistory);
        marketDataClient.off('candleUpdate', handleTick);
        marketDataClient.off('candleClose', handleClose);
        marketDataClient.off('statusChange', handleStatus);
      };

      chartInstances.push({
        chart,
        container,
        mainSeries,
        volumeSeries,
        type: 'candle',
        cleanup: cleanupFn,
        resizeObserver,
        scrollToLive,
      });

      // ==========================================
      // LINE OR AREA CHART
      // ==========================================
    } else if (chartType === 'line' || chartType === 'area') {
      const lineData = generateLineData(isMainChart ? 800 : 365, 150, tf);

      if (chartType === 'line') {
        mainSeries = chart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
        });
      } else {
        mainSeries = chart.addSeries(AreaSeries, {
          lineColor: '#3b82f6',
          topColor: 'rgba(59,130,246,0.28)',
          bottomColor: 'rgba(59,130,246,0.02)',
          lineWidth: 2,
        });
      }
      mainSeries.setData(lineData);
      chart.timeScale().fitContent();

      chartInstances.push({ chart, container, mainSeries, type: chartType, resizeObserver });
    }
  });

  // Attach toolbar listeners
  setupChartToolbar(state);
}

// Show clean 'DATA UNAVAILABLE' state (Requirement 13)
function showUnavailableOverlay(container, symbol) {
  let overlay = container.querySelector('.chart-status-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'chart-status-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 17, 23, 0.88);
      backdrop-filter: blur(4px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 20;
      color: var(--text-primary);
      text-align: center;
      padding: 24px;
      font-family: var(--font-sans);
    `;
    container.style.position = 'relative';
    container.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div style="width:48px;height:48px;border-radius:50%;background:rgba(239,68,68,0.12);color:var(--red-text);display:flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:22px;border:1px solid rgba(239,68,68,0.3)">
      ⚠
    </div>
    <div style="font-size:16px;font-weight:700;letter-spacing:0.04em;color:var(--text-primary);margin-bottom:6px;">DATA UNAVAILABLE</div>
    <div style="font-size:12px;color:var(--text-secondary);max-width:380px;line-height:1.5;margin-bottom:14px;">
      Live data for <span style="font-family:var(--font-mono);color:var(--accent-blue);font-weight:600;">${symbol}</span> requires an active OANDA connection.
    </div>
    <div style="font-size:11px;color:var(--text-muted);background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:6px;padding:8px 14px;max-width:420px;text-align:left;font-family:var(--font-mono);">
      <div>• Add <span style="color:#60a5fa">OANDA_API_TOKEN</span> to <span style="color:#f59e0b">forfuture/.env</span></div>
      <div>• Set <span style="color:#60a5fa">OANDA_ACCOUNT_ID</span> in <span style="color:#f59e0b">forfuture/.env</span></div>
      <div>• Or set <span style="color:#60a5fa">DATA_MODE=MOCK</span> for offline dev</div>
    </div>
  `;
}

function hideUnavailableOverlay(container) {
  const overlay = container.querySelector('.chart-status-overlay');
  if (overlay) overlay.remove();
}

function updateViewportStatusBadge(isAtLive) {
  const badge = document.getElementById('viewportLiveBadge');
  if (badge) {
    if (isAtLive) {
      badge.textContent = 'LIVE EDGE';
      badge.className = 'status-badge live';
    } else {
      badge.textContent = 'VIEWING HISTORY';
      badge.className = 'status-badge';
      badge.style.background = 'rgba(245,158,11,0.15)';
      badge.style.color = '#f59e0b';
    }
  }
}

// Update OHLCV bar on crosshair hover
function updateOHLCLegend(param, series, allCandles, compSeries, symbol) {
  const oEl = document.getElementById('ohlc-open');
  const hEl = document.getElementById('ohlc-high');
  const lEl = document.getElementById('ohlc-low');
  const cEl = document.getElementById('ohlc-close');
  const vEl = document.getElementById('ohlc-volume');
  const tEl = document.getElementById('ohlc-time');
  const vLabelEl = document.getElementById('ohlc-vol-label');
  const sourceEl = document.getElementById('ohlc-source-badge');

  if (!oEl) return;

  const isForex = symbol && (symbol.includes('/') || symbol.length === 6);
  if (vLabelEl) {
    vLabelEl.textContent = isForex ? 'Tick Vol:' : 'Vol:';
  }
  if (sourceEl) {
    sourceEl.textContent = isForex ? 'OANDA v20 Live Stream' : 'Live Market Feed';
  }

  let bar = null;
  if (param && param.time) {
    const data = param.seriesData.get(series);
    if (data && data.open !== undefined) {
      bar = data;
    }
  }

  if (!bar && allCandles && allCandles.length) {
    bar = allCandles[allCandles.length - 1];
  }

  if (bar) {
    const dec = isForex ? 5 : 2;
    oEl.textContent = bar.open ? bar.open.toFixed(dec) : '-';
    hEl.textContent = bar.high ? bar.high.toFixed(dec) : '-';
    lEl.textContent = bar.low ? bar.low.toFixed(dec) : '-';
    cEl.textContent = bar.close ? bar.close.toFixed(dec) : '-';

    if (vEl) {
      if (isForex) {
        vEl.textContent = `${bar.volume || 1} ticks`;
      } else {
        vEl.textContent = bar.volume ? `${(bar.volume / 1e6).toFixed(2)}M` : '-';
      }
    }

    if (tEl && bar.time) {
      // Display time strictly in UTC+5:30 (Asia/Kolkata)
      tEl.textContent = formatTradingTime(bar.time, true);
    }
  }
}

// Technical indicator calculations
function calculateSMA(data, period) {
  const sma = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += (data[i - j].close || data[i - j].mid || 0);
    }
    sma.push({ time: data[i].time, value: +(sum / period).toFixed(5) });
  }
  return sma;
}

function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  const ema = [];
  let prevEma = data[0].close || data[0].mid || 0;
  for (let i = 0; i < data.length; i++) {
    const price = data[i].close || data[i].mid || 0;
    const val = i === 0 ? price : price * k + prevEma * (1 - k);
    prevEma = val;
    if (i >= period - 1) {
      ema.push({ time: data[i].time, value: +val.toFixed(5) });
    }
  }
  return ema;
}

function calculateBollingerBands(data, period = 20, multiplier = 2) {
  const upper = [];
  const lower = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += (data[i - j].close || data[i - j].mid || 0);
    }
    const sma = sum / period;
    let sumSq = 0;
    for (let j = 0; j < period; j++) {
      const diff = (data[i - j].close || data[i - j].mid || 0) - sma;
      sumSq += diff * diff;
    }
    const stdDev = Math.sqrt(sumSq / period);
    upper.push({ time: data[i].time, value: +(sma + multiplier * stdDev).toFixed(5) });
    lower.push({ time: data[i].time, value: +(sma - multiplier * stdDev).toFixed(5) });
  }
  return { upper, lower };
}

// Wire up toolbar buttons (timeframe, chart type, indicators, fullscreen, Go To Live)
function setupChartToolbar(state) {
  // Timeframe buttons
  document.querySelectorAll('[data-tf]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('[data-tf]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (state) state.timeframe = btn.dataset.tf;
      initCharts(state);
    };
  });

  // Chart type buttons
  document.querySelectorAll('[data-chart-type]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('[data-chart-type]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentChartType = btn.dataset.chartType;
      initCharts(state);
    };
  });

  // Fullscreen toggle
  const fsBtn = document.getElementById('btnFullscreenChart');
  if (fsBtn) {
    fsBtn.onclick = () => {
      const container = document.querySelector('.chart-container');
      if (!container) return;
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch(() => { });
      } else {
        document.exitFullscreen().catch(() => { });
      }
    };
  }

  // GO TO LIVE button (Requirement 10)
  const liveBtn = document.getElementById('btnGoToLive');
  if (liveBtn) {
    liveBtn.onclick = () => {
      if (chartDiagnosticsState.scrollToLiveFn) {
        chartDiagnosticsState.scrollToLiveFn();
      }
    };
  }

  // Developer Diagnostics Panel Toggle (Requirement 25)
  const diagBtn = document.getElementById('btnToggleDiag');
  if (diagBtn) {
    diagBtn.onclick = () => {
      toggleDiagnosticsPanel();
    };
  }

  // Interactivity for indicators, drawings, compare, layouts
  setupChartPageInteractivity(state);
}

export function toggleDiagnosticsPanel() {
  const panel = document.getElementById('developerDiagnosticsModal');
  if (!panel) return;
  const isHidden = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    renderDiagnosticsContent();
  }
}
window.__toggleDiag = toggleDiagnosticsPanel;

export function renderDiagnosticsContent() {
  const body = document.getElementById('diagPanelBody');
  if (!body) return;

  const s = chartDiagnosticsState;
  const c = s.currentCandle || {};
  const l = s.lastCandle || {};

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-family:var(--font-mono);font-size:11px;">
      <div style="background:var(--bg-primary);padding:8px 10px;border-radius:4px;border:1px solid var(--border-subtle);">
        <div style="color:var(--text-muted);margin-bottom:2px;">DATA PROVIDER</div>
        <div style="color:var(--text-primary);font-weight:600;">${s.provider} (v20 API)</div>
      </div>
      <div style="background:var(--bg-primary);padding:8px 10px;border-radius:4px;border:1px solid var(--border-subtle);">
        <div style="color:var(--text-muted);margin-bottom:2px;">INSTRUMENT SYMBOL</div>
        <div style="color:var(--accent-blue);font-weight:600;">${s.symbol} → ${s.providerSymbol}</div>
      </div>
      <div style="background:var(--bg-primary);padding:8px 10px;border-radius:4px;border:1px solid var(--border-subtle);">
        <div style="color:var(--text-muted);margin-bottom:2px;">ASSET TYPE / BASIS</div>
        <div style="color:var(--text-primary);">${s.assetType} · ${s.priceBasis} BASIS</div>
      </div>
      <div style="background:var(--bg-primary);padding:8px 10px;border-radius:4px;border:1px solid var(--border-subtle);">
        <div style="color:var(--text-muted);margin-bottom:2px;">TIMEFRAME / HISTORY</div>
        <div style="color:var(--text-primary);">${s.timeframe} (${s.historicalCount} candles)</div>
      </div>
      <div style="background:var(--bg-primary);padding:8px 10px;border-radius:4px;border:1px solid var(--border-subtle);">
        <div style="color:var(--text-muted);margin-bottom:2px;">CONNECTION STATE</div>
        <div style="color:var(--green-text);font-weight:600;">${s.connection}</div>
      </div>
      <div style="background:var(--bg-primary);padding:8px 10px;border-radius:4px;border:1px solid var(--border-subtle);">
        <div style="color:var(--text-muted);margin-bottom:2px;">VIEWPORT STATE</div>
        <div style="color:${s.isAtLiveEdge ? 'var(--green-text)' : '#f59e0b'};font-weight:600;">${s.viewportState}</div>
      </div>
      <div style="background:var(--bg-primary);padding:8px 10px;border-radius:4px;border:1px solid var(--border-subtle);grid-column:span 2;">
        <div style="color:var(--text-muted);margin-bottom:2px;">CURRENT FORMING CANDLE</div>
        <div style="color:var(--text-primary);">O: ${c.open || '—'} · H: ${c.high || '—'} · L: ${c.low || '—'} · C: ${c.close || '—'} · Vol: ${c.volume || 0} (${c.volumeType || 'TICK'})</div>
      </div>
      <div style="background:var(--bg-primary);padding:8px 10px;border-radius:4px;border:1px solid var(--border-subtle);grid-column:span 2;">
        <div style="color:var(--text-muted);margin-bottom:2px;">LAST CLOSED CANDLE</div>
        <div style="color:var(--text-secondary);">O: ${l.open || '—'} · H: ${l.high || '—'} · L: ${l.low || '—'} · C: ${l.close || '—'} · Time: ${formatTradingTime(l.time, true)}</div>
      </div>
    </div>
  `;
}
