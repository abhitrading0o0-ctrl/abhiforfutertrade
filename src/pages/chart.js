// ============================================================
// ForFuture — Chart Page
// Interactive Charting with Multi-Layouts (1, 2H, 4),
// Indicator Overlays, Drawing Tools, and Asset Comparison
// ============================================================

import { icon } from '../icons.js';
import { renderAssetHeader } from '../main.js';
import { ASSET_DATABASE } from '../data.js';
import { initCharts } from '../chartEngine.js';
import { marketDataClient } from '../marketDataClient.js';

export const chartOptionsState = {
  indicators: {
    sma20: true,
    sma50: true,
    ema200: false,
    bollinger: false,
    volume: true,
  },
  showIndicatorsMenu: false,
  showCompareMenu: false,
  drawingMode: null, // null | 'horizontal' | 'trendline'
  drawingStartPoint: null,
  showDrawingToolbar: false,
  drawings: [], // array of { id, type, x1, y1, x2, y2, y, label }
  compareSymbol: null, // e.g. 'SPY' or null
  layout: '1', // '1' | '2h' | '4'
};

export function renderChart(state) {
  const d = state.assetData;
  const isForex = d.ticker.includes('/') || d.type === 'Forex';
  const activeProv = isForex ? marketDataClient.getActiveProvider() : 'Market Data';
  const isBackup = isForex ? marketDataClient.isBackupActive() : false;
  const timeframes = ['1M', '3M', '5M', '15M', '30M', '1H', '2H', '4H', '1D', '1W', '1MN'];
  const chartTypes = [
    { id: 'candle', label: 'Candle', icon: 'candlestick' },
    { id: 'line', label: 'Line', icon: 'chart' },
    { id: 'area', label: 'Area', icon: 'trendUp' },
  ];
  const layouts = [
    { id: '1', label: '1' },
    { id: '2h', label: '2H' },
    { id: '4', label: '4' },
  ];

  // Count active indicators
  const activeCount = Object.values(chartOptionsState.indicators).filter(Boolean).length;
  const indLabel = activeCount > 0 ? `SMA (20, 50)${activeCount > 2 ? ` +${activeCount - 2}` : ''}` : 'Indicators';

  return `
    ${renderAssetHeader(d)}

    <div class="chart-container" style="position:relative;">
      <!-- Main Chart Toolbar -->
      <div class="chart-toolbar">
        <!-- Timeframes -->
        <div class="chart-toolbar-group">
          ${timeframes.map(tf => `
            <button class="chart-toolbar-btn ${tf === (state.timeframe || '1D').toUpperCase() ? 'active' : ''}" data-tf="${tf}">${tf}</button>
          `).join('')}
        </div>

        <div class="chart-toolbar-separator"></div>

        <!-- Chart Type -->
        <div class="chart-toolbar-group">
          ${chartTypes.map(ct => `
            <button class="chart-toolbar-btn ${ct.id === 'candle' ? 'active' : ''}" data-chart-type="${ct.id}" title="${ct.label}">
              ${icon(ct.icon, 14)}
            </button>
          `).join('')}
        </div>

        <div class="chart-toolbar-separator"></div>

        <!-- Indicators Dropdown Trigger -->
        <div style="position:relative;">
          <button id="btnToggleIndicators" class="chart-toolbar-btn ${activeCount > 0 ? 'active' : ''}" style="font-family:var(--font-sans)">
            ${icon('layers', 14)} <span style="margin-left:4px;">${indLabel}</span>
          </button>

          <!-- Indicators Popover Menu -->
          ${chartOptionsState.showIndicatorsMenu ? `
            <div id="indicatorsMenu" style="position:absolute;top:36px;left:0;z-index:120;background:var(--bg-secondary);border:1px solid var(--border-default);border-radius:var(--panel-radius);padding:12px;width:240px;box-shadow:0 12px 30px rgba(0,0,0,0.6);">
              <div style="font-weight:600;font-size:12px;color:var(--text-primary);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
                <span>Technical Indicators</span>
                <span class="text-xs text-muted">Toggle overlays</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;color:var(--text-primary);">
                  <input type="checkbox" id="chkSMA20" ${chartOptionsState.indicators.sma20 ? 'checked' : ''} />
                  <span style="width:10px;height:10px;border-radius:50%;background:#f59e0b;display:inline-block;"></span>
                  <span>SMA 20 (Short-term)</span>
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;color:var(--text-primary);">
                  <input type="checkbox" id="chkSMA50" ${chartOptionsState.indicators.sma50 ? 'checked' : ''} />
                  <span style="width:10px;height:10px;border-radius:50%;background:#3b82f6;display:inline-block;"></span>
                  <span>SMA 50 (Intermediate)</span>
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;color:var(--text-primary);">
                  <input type="checkbox" id="chkEMA200" ${chartOptionsState.indicators.ema200 ? 'checked' : ''} />
                  <span style="width:10px;height:10px;border-radius:50%;background:#a855f7;display:inline-block;"></span>
                  <span>EMA 200 (Long-term)</span>
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;color:var(--text-primary);">
                  <input type="checkbox" id="chkBollinger" ${chartOptionsState.indicators.bollinger ? 'checked' : ''} />
                  <span style="width:10px;height:10px;border-radius:50%;background:#06b6d4;display:inline-block;"></span>
                  <span>Bollinger Bands (20, 2)</span>
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;color:var(--text-primary);">
                  <input type="checkbox" id="chkVolume" ${chartOptionsState.indicators.volume ? 'checked' : ''} />
                  <span style="width:10px;height:10px;border-radius:50%;background:#22c55e;display:inline-block;"></span>
                  <span>Volume Histogram</span>
                </label>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Drawing Tool Button -->
        <button id="btnToggleDrawing" class="chart-toolbar-btn ${chartOptionsState.showDrawingToolbar ? 'active' : ''}" style="font-family:var(--font-sans)">
          ${icon('crosshair', 14)} <span style="margin-left:4px;">Drawing</span>
        </button>

        <!-- Compare Symbol Button -->
        <div style="position:relative;">
          <button id="btnOpenCompare" class="chart-toolbar-btn ${chartOptionsState.compareSymbol ? 'active' : ''}" style="font-family:var(--font-sans)">
            ${icon('grid', 14)} <span style="margin-left:4px;">Compare</span>
          </button>

          <!-- Compare Popover Modal -->
          ${chartOptionsState.showCompareMenu ? `
            <div id="compareMenu" style="position:absolute;top:36px;left:0;z-index:120;background:var(--bg-secondary);border:1px solid var(--border-default);border-radius:var(--panel-radius);padding:14px;width:280px;box-shadow:0 12px 30px rgba(0,0,0,0.6);">
              <div style="font-weight:600;font-size:12px;color:var(--text-primary);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                <span>Compare Symbol</span>
                <span class="text-xs text-muted">vs ${d.ticker}</span>
              </div>
              <input type="text" id="compareSearchInput" placeholder="Search ticker (e.g. SPY, QQQ)..." style="width:100%;padding:6px 10px;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:var(--radius-xs);color:var(--text-primary);font-size:12px;margin-bottom:10px;" />
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">POPULAR BENCHMARKS</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;">
                ${['SPY', 'QQQ', 'BTC/USD', 'NVDA', 'TSLA', 'GLD', 'EUR/USD'].map(sym => `
                  <button class="btn btn-ghost btn-sm btn-compare-chip" data-sym="${sym}" style="padding:3px 8px;font-size:11px;font-family:var(--font-mono);">
                    ${sym}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Active Comparison Tag -->
        ${chartOptionsState.compareSymbol ? `
          <span class="badge" style="background:rgba(6,182,212,0.15);color:#06b6d4;border:1px solid rgba(6,182,212,0.3);display:inline-flex;align-items:center;gap:6px;padding:3px 8px;font-size:11px;font-family:var(--font-mono);font-weight:600;">
            vs ${chartOptionsState.compareSymbol}
            <button id="btnRemoveCompare" style="background:none;border:none;color:#06b6d4;cursor:pointer;font-weight:700;padding:0 2px;font-size:11px;" title="Remove comparison">✕</button>
          </span>
        ` : ''}

        <div class="chart-toolbar-separator"></div>

        <!-- Layout Selector [1] [2H] [4] -->
        <div class="chart-toolbar-group">
          ${layouts.map(l => `
            <button class="chart-toolbar-btn ${l.id === chartOptionsState.layout ? 'active' : ''}" data-layout="${l.id}" title="Layout ${l.label}">
              ${l.label}
            </button>
          `).join('')}
        </div>

        <!-- Actions: Provider Badge, Go To Live & Diagnostics -->
        <div style="margin-left:auto;display:flex;align-items:center;gap:6px;">
          <div id="chartProviderBadge" class="provider-status-badge ${isBackup ? 'backup-active' : ''}" style="margin-right:2px;">
            <span class="provider-status-dot"></span>
            <span id="chartProviderText">${activeProv}</span>
            <span id="chartProviderBackupTag" class="provider-backup-tag" style="display:${isBackup ? 'inline-block' : 'none'};">[BACKUP]</span>
          </div>
          <button id="btnGoToLive" class="chart-toolbar-btn" style="color:var(--accent-blue);font-weight:600;display:flex;align-items:center;gap:4px;" title="Jump directly to newest realtime candle">
            ${icon('zap', 13)} <span style="font-size:11px;">GO TO LIVE</span>
          </button>
          <button id="btnToggleDiag" class="chart-toolbar-btn" style="display:flex;align-items:center;gap:4px;" title="Developer Diagnostics Panel" onclick="window.__toggleDiag && window.__toggleDiag()">
            ${icon('terminal', 13)} <span style="font-size:11px;">DIAGNOSTICS</span>
          </button>
          <span id="viewportLiveBadge" class="status-badge live">LIVE EDGE</span>
          <button id="btnFullscreenChart" class="chart-toolbar-btn" title="Fullscreen">${icon('expand', 14)}</button>
        </div>
      </div>

      <!-- Developer Diagnostics Modal (Requirement 25) -->
      <div id="developerDiagnosticsModal" style="display:none;position:absolute;top:44px;right:12px;z-index:150;background:var(--bg-secondary);border:1px solid var(--border-default);border-radius:var(--panel-radius);padding:14px;width:400px;box-shadow:0 16px 36px rgba(0,0,0,0.7);">
        <div style="font-weight:600;font-size:12px;color:var(--text-primary);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-subtle);padding-bottom:6px;">
          <span style="display:flex;align-items:center;gap:6px;">${icon('terminal', 13)} Developer Diagnostics</span>
          <button onclick="document.getElementById('developerDiagnosticsModal').style.display='none'" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;">✕</button>
        </div>
        <div id="diagPanelBody"></div>
      </div>

      <!-- Secondary Drawing Toolbar -->
      ${chartOptionsState.showDrawingToolbar ? `
        <div id="drawingToolbar" style="display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--bg-tertiary);border-bottom:1px solid var(--border-subtle);font-size:12px;">
          <span style="font-weight:600;color:var(--text-secondary);margin-right:4px;">DRAWING:</span>
          <button id="btnDrawHorizontal" class="btn btn-sm ${chartOptionsState.drawingMode === 'horizontal' ? 'btn-primary' : 'btn-ghost'}" style="padding:3px 10px;font-size:11px;">
            ⎯ Horizontal Ray (S/R)
          </button>
          <button id="btnDrawTrendline" class="btn btn-sm ${chartOptionsState.drawingMode === 'trendline' ? 'btn-primary' : 'btn-ghost'}" style="padding:3px 10px;font-size:11px;">
            ╱ Trendline
          </button>
          <div style="margin-left:auto;display:flex;align-items:center;gap:8px;">
            <span class="text-xs text-muted">
              ${chartOptionsState.drawingMode ? 'Click on chart to place drawing' : 'Select a tool to draw'}
            </span>
            <button id="btnClearDrawings" class="btn btn-ghost btn-sm" style="padding:3px 8px;font-size:11px;color:var(--red-text);">
              Clear (${chartOptionsState.drawings.length})
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Chart Content Area (Responsive to Layout 1, 2H, 4) -->
      <div id="chartContainerInner" style="position:relative;">
        ${renderLayoutBody(state, d)}

        <!-- Interactive SVG Drawings Overlay -->
        <svg id="chartDrawingSvg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:${chartOptionsState.drawingMode ? 'all' : 'none'};z-index:15;cursor:${chartOptionsState.drawingMode ? 'crosshair' : 'default'};">
          ${renderDrawingsSvg(chartOptionsState.drawings)}
        </svg>
      </div>
    </div>

    <!-- OHLCV Info Bar -->
    <div style="display:flex;align-items:center;gap:16px;padding:8px 14px;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:var(--panel-radius);margin-top:8px;font-size:var(--text-xs);font-family:var(--font-mono);flex-wrap:wrap;">
      <span style="color:var(--text-muted)">O:</span> <span id="ohlc-open" style="font-weight:600;color:var(--text-primary);">${d.open}</span>
      <span style="color:var(--text-muted)">H:</span> <span id="ohlc-high" style="font-weight:600;color:var(--text-primary);">${d.high24h}</span>
      <span style="color:var(--text-muted)">L:</span> <span id="ohlc-low" style="font-weight:600;color:var(--text-primary);">${d.low24h}</span>
      <span style="color:var(--text-muted)">C:</span> <span id="ohlc-close" style="font-weight:600;color:var(--accent-blue);">${d.price}</span>
      <span id="ohlc-vol-label" style="color:var(--text-muted)">${d.ticker.includes('/') ? 'Tick Vol:' : 'Vol:'}</span> <span id="ohlc-volume" style="font-weight:600;color:var(--text-secondary);">${d.volume || '—'}</span>
      ${chartOptionsState.compareSymbol ? `
        <span style="color:#06b6d4;margin-left:8px;">${chartOptionsState.compareSymbol}: <span id="ohlc-compare">-</span></span>
      ` : ''}
      <span id="ohlc-time" style="color:var(--text-muted);margin-left:8px;">Hover chart to inspect candles (UTC+5:30 IST)</span>
      <div style="margin-left:auto;" class="data-source fresh">
        <span class="data-source-dot"></span>
        <span id="ohlc-source-badge">${d.ticker.includes('/') ? 'OANDA v20 Live Stream' : 'Live Market Feed'}</span>
      </div>
    </div>

  `;
}

// -------------------------------------------------------------
// LAYOUTS RENDERER: 1, 2H, 4
// -------------------------------------------------------------
function renderLayoutBody(state, d) {
  // Layout 1: Single Full Chart
  if (chartOptionsState.layout === '1') {
    return `
      <div class="chart-area" data-chart="candle" style="height:calc(100vh - 240px);min-height:480px;"></div>
    `;
  }

  // Layout 2H: 2 Stacked Horizontal Charts (Daily Macro + 1H Intraday)
  if (chartOptionsState.layout === '2h') {
    return `
      <div style="display:grid;grid-template-rows:1fr 1fr;gap:8px;height:calc(100vh - 240px);min-height:550px;padding:6px;background:var(--bg-root);">
        <div style="display:flex;flex-direction:column;border:1px solid var(--border-subtle);border-radius:var(--panel-radius);overflow:hidden;background:var(--bg-primary);">
          <div style="display:flex;justify-content:space-between;padding:4px 10px;background:var(--bg-secondary);font-size:11px;font-family:var(--font-mono);border-bottom:1px solid var(--border-subtle);">
            <span style="color:var(--text-primary);font-weight:600;">${d.ticker} · 1D (Daily Macro Trend)</span>
            <span class="status-badge live">LIVE</span>
          </div>
          <div class="chart-area" data-chart="candle" data-tf="1D" style="flex:1;min-height:220px;"></div>
        </div>
        <div style="display:flex;flex-direction:column;border:1px solid var(--border-subtle);border-radius:var(--panel-radius);overflow:hidden;background:var(--bg-primary);">
          <div style="display:flex;justify-content:space-between;padding:4px 10px;background:var(--bg-secondary);font-size:11px;font-family:var(--font-mono);border-bottom:1px solid var(--border-subtle);">
            <span style="color:var(--text-primary);font-weight:600;">${d.ticker} · 1H (Intraday Momentum)</span>
            <span class="status-badge live">LIVE</span>
          </div>
          <div class="chart-area" data-chart="candle" data-tf="1H" style="flex:1;min-height:220px;"></div>
        </div>
      </div>
    `;
  }

  // Layout 4: 4-Quadrant Multi-Timeframe Matrix (1D, 4H, 1H, 15m)
  if (chartOptionsState.layout === '4') {
    const quadrants = [
      { tf: '1D', label: '1D · Macro Trend' },
      { tf: '4H', label: '4H · Swing Structure' },
      { tf: '1H', label: '1H · Hourly Momentum' },
      { tf: '15m', label: '15m · Entry Execution' },
    ];

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:6px;height:calc(100vh - 240px);min-height:550px;padding:6px;background:var(--bg-root);">
        ${quadrants.map(q => `
          <div style="display:flex;flex-direction:column;border:1px solid var(--border-subtle);border-radius:var(--panel-radius);overflow:hidden;background:var(--bg-primary);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 10px;background:var(--bg-secondary);font-size:11px;font-family:var(--font-mono);border-bottom:1px solid var(--border-subtle);">
              <span style="color:var(--text-primary);font-weight:600;">${d.ticker} · ${q.label}</span>
              <span class="status-badge live" style="font-size:9px;padding:1px 4px;">LIVE</span>
            </div>
            <div class="chart-area" data-chart="candle" data-tf="${q.tf}" style="flex:1;min-height:200px;"></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  return `<div class="chart-area" data-chart="candle" style="height:calc(100vh - 240px);min-height:480px;"></div>`;
}

// -------------------------------------------------------------
// SVG DRAWINGS RENDERER
// -------------------------------------------------------------
function renderDrawingsSvg(drawings) {
  if (!drawings || !drawings.length) return '';

  return drawings.map(d => {
    if (d.type === 'horizontal') {
      return `
        <line x1="0" y1="${d.y}" x2="100%" y2="${d.y}" stroke="#3b82f6" stroke-width="2" stroke-dasharray="6,4" />
        <rect x="12" y="${d.y - 12}" width="90" height="22" rx="4" fill="#1e2230" stroke="#3b82f6" stroke-width="1.5" />
        <text x="18" y="${d.y + 3}" fill="#60a5fa" font-size="11" font-family="'JetBrains Mono', monospace" font-weight="600">S/R Level</text>
      `;
    }
    if (d.type === 'trendline') {
      return `
        <line x1="${d.x1}" y1="${d.y1}" x2="${d.x2}" y2="${d.y2}" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="${d.x1}" cy="${d.y1}" r="4" fill="#f59e0b" />
        <circle cx="${d.x2}" cy="${d.y2}" r="4" fill="#f59e0b" />
      `;
    }
    return '';
  }).join('');
}

// -------------------------------------------------------------
// WIRE UP CHART TOOLBAR & INTERACTIVE CONTROLS
// -------------------------------------------------------------
export function setupChartPageInteractivity(state) {
  // Indicators Menu Toggle
  const indBtn = document.getElementById('btnToggleIndicators');
  if (indBtn) {
    indBtn.onclick = (e) => {
      e.stopPropagation();
      chartOptionsState.showIndicatorsMenu = !chartOptionsState.showIndicatorsMenu;
      chartOptionsState.showCompareMenu = false;
      window.navigate('chart');
    };
  }

  // Indicators Checkboxes
  const bindCheckbox = (id, key) => {
    const el = document.getElementById(id);
    if (el) {
      el.onchange = (e) => {
        chartOptionsState.indicators[key] = e.target.checked;
        initCharts(state);
      };
    }
  };
  bindCheckbox('chkSMA20', 'sma20');
  bindCheckbox('chkSMA50', 'sma50');
  bindCheckbox('chkEMA200', 'ema200');
  bindCheckbox('chkBollinger', 'bollinger');
  bindCheckbox('chkVolume', 'volume');

  // Drawing Toolbar Toggle
  const drawBtn = document.getElementById('btnToggleDrawing');
  if (drawBtn) {
    drawBtn.onclick = () => {
      chartOptionsState.showDrawingToolbar = !chartOptionsState.showDrawingToolbar;
      if (!chartOptionsState.showDrawingToolbar) {
        chartOptionsState.drawingMode = null;
        chartOptionsState.drawingStartPoint = null;
      }
      window.navigate('chart');
    };
  }

  // Drawing Sub-buttons
  const btnHorizontal = document.getElementById('btnDrawHorizontal');
  if (btnHorizontal) {
    btnHorizontal.onclick = () => {
      chartOptionsState.drawingMode = chartOptionsState.drawingMode === 'horizontal' ? null : 'horizontal';
      chartOptionsState.drawingStartPoint = null;
      window.navigate('chart');
    };
  }

  const btnTrendline = document.getElementById('btnDrawTrendline');
  if (btnTrendline) {
    btnTrendline.onclick = () => {
      chartOptionsState.drawingMode = chartOptionsState.drawingMode === 'trendline' ? null : 'trendline';
      chartOptionsState.drawingStartPoint = null;
      window.navigate('chart');
    };
  }

  const btnClearDrawings = document.getElementById('btnClearDrawings');
  if (btnClearDrawings) {
    btnClearDrawings.onclick = () => {
      chartOptionsState.drawings = [];
      chartOptionsState.drawingMode = null;
      window.navigate('chart');
    };
  }

  // Drawing SVG Pointer Interactions
  const svgOverlay = document.getElementById('chartDrawingSvg');
  if (svgOverlay && chartOptionsState.drawingMode) {
    svgOverlay.onclick = (e) => {
      const rect = svgOverlay.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (chartOptionsState.drawingMode === 'horizontal') {
        chartOptionsState.drawings.push({
          id: Date.now(),
          type: 'horizontal',
          y: Math.round(y),
        });
        chartOptionsState.drawingMode = null;
        window.navigate('chart');
      } else if (chartOptionsState.drawingMode === 'trendline') {
        if (!chartOptionsState.drawingStartPoint) {
          chartOptionsState.drawingStartPoint = { x, y };
        } else {
          chartOptionsState.drawings.push({
            id: Date.now(),
            type: 'trendline',
            x1: Math.round(chartOptionsState.drawingStartPoint.x),
            y1: Math.round(chartOptionsState.drawingStartPoint.y),
            x2: Math.round(x),
            y2: Math.round(y),
          });
          chartOptionsState.drawingMode = null;
          chartOptionsState.drawingStartPoint = null;
          window.navigate('chart');
        }
      }
    };
  }

  // Compare Menu Toggle
  const compBtn = document.getElementById('btnOpenCompare');
  if (compBtn) {
    compBtn.onclick = (e) => {
      e.stopPropagation();
      chartOptionsState.showCompareMenu = !chartOptionsState.showCompareMenu;
      chartOptionsState.showIndicatorsMenu = false;
      window.navigate('chart');
    };
  }

  // Compare Chips
  document.querySelectorAll('.btn-compare-chip').forEach(chip => {
    chip.onclick = () => {
      chartOptionsState.compareSymbol = chip.dataset.sym;
      chartOptionsState.showCompareMenu = false;
      window.navigate('chart');
    };
  });

  // Compare Search Input
  const compInput = document.getElementById('compareSearchInput');
  if (compInput) {
    compInput.onkeydown = (e) => {
      if (e.key === 'Enter' && compInput.value.trim()) {
        chartOptionsState.compareSymbol = compInput.value.trim().toUpperCase();
        chartOptionsState.showCompareMenu = false;
        window.navigate('chart');
      }
    };
  }

  // Remove Compare Button
  const remCompBtn = document.getElementById('btnRemoveCompare');
  if (remCompBtn) {
    remCompBtn.onclick = () => {
      chartOptionsState.compareSymbol = null;
      window.navigate('chart');
    };
  }

  // Layout Buttons [1] [2H] [4]
  document.querySelectorAll('[data-layout]').forEach(lBtn => {
    lBtn.onclick = () => {
      chartOptionsState.layout = lBtn.dataset.layout;
      window.navigate('chart');
    };
  });

  // Close menus on outside click
  document.onclick = (e) => {
    if (!e.target.closest('#indicatorsMenu') && !e.target.closest('#btnToggleIndicators')) {
      if (chartOptionsState.showIndicatorsMenu) {
        chartOptionsState.showIndicatorsMenu = false;
        window.navigate('chart');
      }
    }
    if (!e.target.closest('#compareMenu') && !e.target.closest('#btnOpenCompare')) {
      if (chartOptionsState.showCompareMenu) {
        chartOptionsState.showCompareMenu = false;
        window.navigate('chart');
      }
    }
  };

  // Provider failover listeners for chart toolbar
  const updateChartProviderUI = (pName, isBackup) => {
    const pText = document.getElementById('chartProviderText');
    const pTag = document.getElementById('chartProviderBackupTag');
    const pBadge = document.getElementById('chartProviderBadge');
    if (pText) pText.textContent = pName || 'OANDA';
    if (pTag) pTag.style.display = isBackup ? 'inline-block' : 'none';
    if (pBadge) pBadge.className = 'provider-status-badge' + (isBackup ? ' backup-active' : '');
  };

  marketDataClient.on('providerSwitch', (data) => updateChartProviderUI(data.newProvider, data.isBackup));
  marketDataClient.on('providerStatus', (data) => updateChartProviderUI(data.activeProvider, data.isBackup));
}
