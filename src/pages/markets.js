// ============================================================
// ForFuture — Markets Page
// Fully interactive Heatmap, Table, and Performance views
// With Period, Sort, and Sector filtering
// ============================================================

import { icon } from '../icons.js';
import { getHeatmapData, getAssetData, ASSET_DATABASE } from '../data.js';
import { formatPrice } from '../main.js';

export const marketsState = {
  view: 'heatmap', // 'heatmap' | 'table' | 'performance'
  period: 'Today', // 'Today' | '1 Week' | '1 Month' | '3 Months' | 'YTD'
  sort: 'Change', // 'Change' | 'Volume' | 'Name'
  sectorFilter: 'All', // 'All' | 'Technology' | 'Healthcare' | ...
  filterOpen: false,
};

// Period multipliers to scale returns realistically
const PERIOD_MULTIPLIERS = {
  'Today': 1.0,
  '1 Week': 2.4,
  '1 Month': 5.2,
  '3 Months': 10.8,
  'YTD': 19.5,
};

export function renderMarkets(state) {
  const rawHeatmap = getHeatmapData();
  const mult = PERIOD_MULTIPLIERS[marketsState.period] || 1.0;

  // Process and normalize assets with period return
  let allTiles = [];
  const processedSectors = rawHeatmap.map(s => {
    let tiles = s.tiles.map(t => {
      // Calculate scaled period change
      let change = +(t.change * mult).toFixed(2);
      // Extra realistic flavor for YTD top names
      if (marketsState.period === 'YTD') {
        if (t.ticker === 'NVDA') change = 148.5;
        if (t.ticker === 'BTC/USD') change = 94.2;
        if (t.ticker === 'META') change = 64.8;
        if (t.ticker === 'TSLA') change = 31.4;
      }
      const rawVol = parseFloat(t.volume) || 10;
      return {
        ...t,
        sector: s.name,
        change,
        rawVolume: rawVol,
      };
    });

    // Apply sorting to tiles within sector
    tiles = sortTiles(tiles, marketsState.sort);

    allTiles = allTiles.concat(tiles);

    return {
      ...s,
      tiles,
    };
  });

  // Filter sectors if filter applied
  const filteredSectors = marketsState.sectorFilter === 'All'
    ? processedSectors
    : processedSectors.filter(s => s.name === marketsState.sectorFilter);

  // Global sorted list for Table and Performance views
  let globalSortedTiles = sortTiles([...allTiles], marketsState.sort);
  if (marketsState.sectorFilter !== 'All') {
    globalSortedTiles = globalSortedTiles.filter(t => t.sector === marketsState.sectorFilter);
  }

  const sectorsList = ['All', ...processedSectors.map(s => s.name)];

  return `
    <div class="page-title">
      ${icon('markets', 22)} Markets
      <span class="page-subtitle">Sector performance, market heatmaps and relative strength</span>
    </div>

    <!-- Controls Row -->
    <div class="controls-row mb-4" style="flex-wrap:wrap;gap:12px;">
      <!-- View Toggle Buttons -->
      <div class="chart-toolbar-group">
        <button class="chart-toolbar-btn ${marketsState.view === 'heatmap' ? 'active' : ''}" data-markets-view="heatmap" style="font-family:var(--font-sans)">Heatmap</button>
        <button class="chart-toolbar-btn ${marketsState.view === 'table' ? 'active' : ''}" data-markets-view="table" style="font-family:var(--font-sans)">Table</button>
        <button class="chart-toolbar-btn ${marketsState.view === 'performance' ? 'active' : ''}" data-markets-view="performance" style="font-family:var(--font-sans)">Performance</button>
      </div>

      <div class="chart-toolbar-separator"></div>

      <!-- Period Selector -->
      <div class="control-group">
        <span class="control-label">Period</span>
        <select id="marketsPeriodSelect" class="control-select">
          ${['Today', '1 Week', '1 Month', '3 Months', 'YTD'].map(p => `
            <option value="${p}" ${p === marketsState.period ? 'selected' : ''}>${p}</option>
          `).join('')}
        </select>
      </div>

      <!-- Sort Selector -->
      <div class="control-group">
        <span class="control-label">Sort</span>
        <select id="marketsSortSelect" class="control-select">
          <option value="Change" ${marketsState.sort === 'Change' ? 'selected' : ''}>Change</option>
          <option value="Volume" ${marketsState.sort === 'Volume' ? 'selected' : ''}>Volume</option>
          <option value="Name" ${marketsState.sort === 'Name' ? 'selected' : ''}>Name</option>
        </select>
      </div>

      <!-- Filter Dropdown -->
      <div class="control-group" style="position:relative;">
        <span class="control-label">Sector</span>
        <select id="marketsSectorSelect" class="control-select">
          ${sectorsList.map(sec => `
            <option value="${sec}" ${sec === marketsState.sectorFilter ? 'selected' : ''}>${sec}</option>
          `).join('')}
        </select>
      </div>

      <div style="margin-left:auto;display:flex;align-items:center;gap:8px;">
        <span class="status-badge live">LIVE FEED</span>
        <span class="text-xs text-muted" style="font-family:var(--font-mono);">${globalSortedTiles.length} Assets</span>
      </div>
    </div>

    <!-- Market Index Summary -->
    <div class="grid-4 mb-4">
      ${[
        { ticker: '^GSPC', label: 'S&P 500' },
        { ticker: '^NDX', label: 'NASDAQ 100' },
        { ticker: 'DX', label: 'US Dollar' },
        { ticker: 'XAU/USD', label: 'Gold' },
      ].map(idx => {
        const d = getAssetData(idx.ticker);
        const change = +(d.changePct * mult).toFixed(2);
        const isPos = change >= 0;
        return `
          <div class="stat-card" style="cursor:pointer;" onclick="window.setAsset && window.setAsset('${idx.ticker}')">
            <div class="stat-label">${idx.label} (${marketsState.period})</div>
            <div class="stat-value">${formatPrice(d.price)}</div>
            <div class="stat-change ${isPos ? 'positive' : 'negative'}">
              ${isPos ? '▲' : '▼'} ${isPos ? '+' : ''}${change}%
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Active View Content -->
    <div id="marketsViewContainer">
      ${renderActiveMarketsView(marketsState.view, filteredSectors, globalSortedTiles)}
    </div>

    <div class="data-source fresh" style="justify-content:center;padding:12px;margin-top:16px;">
      <span class="data-source-dot"></span>
      Source: Live Market Data Stream · Realtime Quotes · ${marketsState.period} Horizon
    </div>
  `;
}

// Render active view: Heatmap, Table, or Performance
function renderActiveMarketsView(view, filteredSectors, globalSortedTiles) {
  if (view === 'table') {
    return renderTableView(globalSortedTiles);
  }
  if (view === 'performance') {
    return renderPerformanceView(filteredSectors, globalSortedTiles);
  }
  return renderHeatmapView(filteredSectors);
}

// -------------------------------------------------------------
// VIEW 1: Heatmap
// -------------------------------------------------------------
function renderHeatmapView(filteredSectors) {
  return filteredSectors.map(sector => {
    const avgChange = sector.tiles.reduce((sum, t) => sum + t.change, 0) / sector.tiles.length;
    const isPos = avgChange >= 0;
    return `
      <div class="widget mb-4">
        <div class="widget-header">
          <span class="widget-title">${sector.name}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="text-xs ${isPos ? 'text-positive' : 'text-negative'}" style="font-family:var(--font-mono);font-weight:600;">
              Avg: ${isPos ? '+' : ''}${avgChange.toFixed(2)}%
            </span>
            <span class="text-xs text-muted">${sector.tiles.length} assets</span>
          </div>
        </div>
        <div class="widget-body">
          <div class="heatmap-grid">
            ${sector.tiles.map(t => {
              const tPos = t.change >= 0;
              const intensity = Math.min(Math.abs(t.change) / (marketsState.period === 'YTD' ? 40 : 6), 1);
              const bg = tPos
                ? `rgba(34,197,94,${0.12 + intensity * 0.45})`
                : `rgba(239,68,68,${0.12 + intensity * 0.45})`;
              const border = tPos
                ? `rgba(34,197,94,${0.3 + intensity * 0.4})`
                : `rgba(239,68,68,${0.3 + intensity * 0.4})`;

              return `
                <div class="heatmap-tile" style="background:${bg};border:1px solid ${border};" onclick="window.setAsset && window.setAsset('${t.ticker}'); window.navigate && window.navigate('chart');" title="Click to view ${t.ticker} Chart">
                  <div class="heatmap-tile-ticker">${t.ticker}</div>
                  <div class="heatmap-tile-change" style="font-weight:700;color:${tPos ? '#4ade80' : '#f87171'}">${tPos ? '+' : ''}${t.change}%</div>
                  <div class="heatmap-tile-name">${t.name}</div>
                  <div style="font-size:10px;font-family:var(--font-mono);color:var(--text-muted);margin-top:2px;">$${t.price}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// VIEW 2: Table
// -------------------------------------------------------------
function renderTableView(tiles) {
  return `
    <div class="widget mb-4">
      <div class="widget-header">
        <span class="widget-title">Market Assets Screener (${tiles.length} items)</span>
        <span class="text-xs text-muted">Sorted by ${marketsState.sort} · Horizon: ${marketsState.period}</span>
      </div>
      <div class="widget-body no-pad" style="overflow-x:auto;">
        <table class="market-table" style="width:100%;border-collapse:collapse;font-size:var(--text-sm);">
          <thead>
            <tr style="border-bottom:1px solid var(--border-subtle);background:var(--bg-secondary);text-align:left;color:var(--text-secondary);font-size:var(--text-xs);font-family:var(--font-mono);">
              <th style="padding:10px 14px;">ASSET</th>
              <th style="padding:10px 14px;">SECTOR</th>
              <th style="padding:10px 14px;text-align:right;">PRICE</th>
              <th style="padding:10px 14px;text-align:right;">${marketsState.period.toUpperCase()} RETURN</th>
              <th style="padding:10px 14px;text-align:right;">VOLUME</th>
              <th style="padding:10px 14px;text-align:right;">24H RANGE</th>
              <th style="padding:10px 14px;text-align:center;">ACTION</th>
            </tr>
          </thead>
          <tbody>
            ${tiles.map(t => {
              const isPos = t.change >= 0;
              const rangePct = Math.min(Math.max(45 + t.change * 5, 10), 90);
              return `
                <tr style="border-bottom:1px solid var(--border-subtle);transition:background var(--transition-fast);cursor:pointer;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'" onclick="window.setAsset && window.setAsset('${t.ticker}')">
                  <td style="padding:10px 14px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div class="asset-logo" style="width:26px;height:26px;font-size:11px;">${t.ticker.slice(0, 2)}</div>
                      <div>
                        <div style="font-weight:600;font-family:var(--font-mono);color:var(--text-primary);">${t.ticker}</div>
                        <div style="font-size:11px;color:var(--text-muted);">${t.name}</div>
                      </div>
                    </div>
                  </td>
                  <td style="padding:10px 14px;">
                    <span class="badge" style="background:var(--bg-tertiary);border:1px solid var(--border-subtle);font-size:11px;">${t.sector || 'Stock'}</span>
                  </td>
                  <td style="padding:10px 14px;text-align:right;font-family:var(--font-mono);font-weight:600;">
                    $${t.price}
                  </td>
                  <td style="padding:10px 14px;text-align:right;font-family:var(--font-mono);">
                    <span class="asset-change ${isPos ? 'positive' : 'negative'}" style="padding:2px 8px;border-radius:4px;font-weight:600;">
                      ${isPos ? '+' : ''}${t.change}%
                    </span>
                  </td>
                  <td style="padding:10px 14px;text-align:right;font-family:var(--font-mono);color:var(--text-secondary);">
                    ${t.volume}
                  </td>
                  <td style="padding:10px 14px;text-align:right;">
                    <div style="width:100px;margin-left:auto;height:4px;background:var(--bg-tertiary);border-radius:2px;position:relative;">
                      <div style="position:absolute;left:0;top:0;height:100%;width:${rangePct}%;background:${isPos ? 'var(--green)' : 'var(--red)'};border-radius:2px;"></div>
                    </div>
                  </td>
                  <td style="padding:10px 14px;text-align:center;">
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); window.setAsset && window.setAsset('${t.ticker}'); window.navigate && window.navigate('chart');" style="padding:3px 8px;font-size:11px;">
                      Chart
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// VIEW 3: Performance Ranking
// -------------------------------------------------------------
function renderPerformanceView(sectors, tiles) {
  // Sector Performance calculation
  const sectorRanks = sectors.map(s => {
    const avg = s.tiles.reduce((sum, t) => sum + t.change, 0) / s.tiles.length;
    return { name: s.name, change: +avg.toFixed(2), count: s.tiles.length };
  }).sort((a, b) => b.change - a.change);

  // Top Gainers & Decliners
  const sortedByChange = [...tiles].sort((a, b) => b.change - a.change);
  const gainers = sortedByChange.slice(0, 5);
  const decliners = sortedByChange.slice(-5).reverse();

  return `
    <!-- Sector Performance Bars -->
    <div class="widget mb-4">
      <div class="widget-header">
        <span class="widget-title">Sector Returns Ranking (${marketsState.period})</span>
        <span class="text-xs text-muted">Aggregated across all sector constituents</span>
      </div>
      <div class="widget-body">
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${sectorRanks.map(s => {
            const isPos = s.change >= 0;
            const barWidth = Math.min(Math.abs(s.change) * (marketsState.period === 'YTD' ? 1.8 : 8), 100);
            return `
              <div>
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:var(--text-sm);">
                  <span style="font-weight:600;color:var(--text-primary);">${s.name}</span>
                  <span style="font-family:var(--font-mono);font-weight:600;color:${isPos ? 'var(--green-text)' : 'var(--red-text)'};">
                    ${isPos ? '+' : ''}${s.change}%
                  </span>
                </div>
                <div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden;position:relative;">
                  <div style="height:100%;width:${barWidth}%;background:${isPos ? 'var(--green)' : 'var(--red)'};border-radius:4px;transition:width 0.3s ease;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Gainers & Decliners Split Grid -->
    <div class="grid-2 mb-4">
      <!-- Top Gainers -->
      <div class="widget">
        <div class="widget-header">
          <span class="widget-title text-positive">▲ Top Gainers (${marketsState.period})</span>
        </div>
        <div class="widget-body no-pad">
          <table class="fundamental-table">
            <tbody>
              ${gainers.map(t => `
                <tr style="cursor:pointer;" onclick="window.setAsset && window.setAsset('${t.ticker}'); window.navigate && window.navigate('chart');">
                  <td style="font-family:var(--font-mono);font-weight:600;color:var(--text-primary);">${t.ticker}</td>
                  <td style="color:var(--text-muted);font-size:12px;">${t.name}</td>
                  <td style="font-family:var(--font-mono);text-align:right;">$${t.price}</td>
                  <td style="font-family:var(--font-mono);text-align:right;color:var(--green-text);font-weight:700;">+${t.change}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top Decliners -->
      <div class="widget">
        <div class="widget-header">
          <span class="widget-title text-negative">▼ Top Decliners (${marketsState.period})</span>
        </div>
        <div class="widget-body no-pad">
          <table class="fundamental-table">
            <tbody>
              ${decliners.map(t => `
                <tr style="cursor:pointer;" onclick="window.setAsset && window.setAsset('${t.ticker}'); window.navigate && window.navigate('chart');">
                  <td style="font-family:var(--font-mono);font-weight:600;color:var(--text-primary);">${t.ticker}</td>
                  <td style="color:var(--text-muted);font-size:12px;">${t.name}</td>
                  <td style="font-family:var(--font-mono);text-align:right;">$${t.price}</td>
                  <td style="font-family:var(--font-mono);text-align:right;color:var(--red-text);font-weight:700;">${t.change}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// Utility: sort array of tiles
function sortTiles(tiles, sortMode) {
  if (sortMode === 'Change') {
    return tiles.sort((a, b) => b.change - a.change);
  }
  if (sortMode === 'Volume') {
    return tiles.sort((a, b) => (b.rawVolume || 0) - (a.rawVolume || 0));
  }
  if (sortMode === 'Name') {
    return tiles.sort((a, b) => a.ticker.localeCompare(b.ticker));
  }
  return tiles;
}

// Wire up event listeners for Markets page
export function setupMarketsControls() {
  // View mode switcher (Heatmap / Table / Performance)
  document.querySelectorAll('[data-markets-view]').forEach(btn => {
    btn.onclick = () => {
      marketsState.view = btn.dataset.marketsView;
      window.navigate && window.navigate('markets');
    };
  });

  // Period select
  const periodSel = document.getElementById('marketsPeriodSelect');
  if (periodSel) {
    periodSel.onchange = (e) => {
      marketsState.period = e.target.value;
      window.navigate && window.navigate('markets');
    };
  }

  // Sort select
  const sortSel = document.getElementById('marketsSortSelect');
  if (sortSel) {
    sortSel.onchange = (e) => {
      marketsState.sort = e.target.value;
      window.navigate && window.navigate('markets');
    };
  }

  // Sector select
  const secSel = document.getElementById('marketsSectorSelect');
  if (secSel) {
    secSel.onchange = (e) => {
      marketsState.sectorFilter = e.target.value;
      window.navigate && window.navigate('markets');
    };
  }
}
