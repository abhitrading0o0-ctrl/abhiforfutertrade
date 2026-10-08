// ============================================================
// ForFuture — Overview Page
// ============================================================

import { icon } from '../icons.js';
import { getAssetData, getHeatmapData, getNewsData, ASSET_DATABASE } from '../data.js';
import { formatPrice, formatVolume, signalClass } from '../main.js';

export function renderOverview(state) {
  const marketData = [
    { ticker: '^GSPC', label: 'S&P 500' },
    { ticker: '^NDX', label: 'NASDAQ 100' },
    { ticker: 'BTC/USD', label: 'Bitcoin' },
    { ticker: 'EUR/USD', label: 'EUR/USD' },
    { ticker: 'XAU/USD', label: 'Gold' },
    { ticker: 'CL', label: 'Crude Oil' },
  ].map(m => ({ ...m, ...getAssetData(m.ticker) }));

  const movers = ASSET_DATABASE.slice(0, 8).map(a => {
    const d = getAssetData(a.ticker);
    return { ...a, ...d };
  }).sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  const news = getNewsData(state.currentAsset).slice(0, 6);

  return `
    <div class="page-title">
      ${icon('overview', 22)} Overview
      <span class="page-subtitle">Market summary and research dashboard</span>
    </div>

    <!-- Market Overview Cards -->
    <div class="grid-6 mb-4">
      ${marketData.map(m => {
        const isPos = m.change >= 0;
        return `
          <div class="stat-card" style="cursor:pointer" onclick="window.__setAsset && window.__setAsset('${m.ticker}')">
            <div class="stat-label">${m.label}</div>
            <div class="stat-value">${formatPrice(m.price)}</div>
            <div class="stat-change ${isPos ? 'positive' : 'negative'}">
              ${isPos ? '▲' : '▼'} ${isPos ? '+' : ''}${m.changePct.toFixed(2)}%
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="grid-research">
      <div>
        <!-- Top Movers -->
        <div class="widget mb-4">
          <div class="widget-header">
            <span class="widget-title">${icon('trendUp', 14)} Top Movers</span>
            <div class="panel-actions">
              <button class="btn btn-ghost btn-sm">${icon('filter', 12)} Filter</button>
            </div>
          </div>
          <div class="widget-body no-pad">
            <table class="watchlist-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th class="num">Price</th>
                  <th class="num">Change</th>
                  <th class="num">Volume</th>
                </tr>
              </thead>
              <tbody>
                ${movers.map(m => {
                  const isPos = m.changePct >= 0;
                  return `
                    <tr onclick="window.__setAsset && window.__setAsset('${m.ticker}')">
                      <td>
                        <div class="watchlist-ticker">${m.ticker}</div>
                        <div class="watchlist-name">${m.name}</div>
                      </td>
                      <td class="num">${formatPrice(m.price)}</td>
                      <td class="num ${isPos ? 'text-positive' : 'text-negative'}">
                        ${isPos ? '+' : ''}${m.changePct.toFixed(2)}%
                      </td>
                      <td class="num text-secondary">${formatVolume(m.volume)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Quick Chart -->
        <div class="widget mb-4">
          <div class="widget-header">
            <span class="widget-title">${icon('chart', 14)} ${state.currentAsset} — Quick Chart</span>
            <span class="status-badge live">LIVE</span>
          </div>
          <div class="widget-body no-pad">
            <div data-chart="area" style="height:280px;"></div>
          </div>
        </div>

        <!-- Sector Heatmap -->
        <div class="widget">
          <div class="widget-header">
            <span class="widget-title">${icon('grid', 14)} Sector Performance</span>
          </div>
          <div class="widget-body">
            ${renderMiniHeatmap()}
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div>
        <!-- Watchlist -->
        <div class="widget mb-4">
          <div class="widget-header">
            <span class="widget-title">${icon('watchlist', 14)} Watchlist</span>
            <button class="btn btn-ghost btn-sm">View All</button>
          </div>
          <div class="widget-body no-pad">
            ${state.watchlist.slice(0, 6).map(ticker => {
              const d = getAssetData(ticker);
              const isPos = d.change >= 0;
              return `
                <div class="news-card" onclick="window.__setAsset && window.__setAsset('${ticker}')" style="padding:8px 12px;">
                  <div style="flex:1">
                    <div style="font-family:var(--font-mono);font-weight:600;font-size:var(--text-sm)">${ticker}</div>
                    <div style="font-size:10px;color:var(--text-muted)">${d.name}</div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-family:var(--font-mono);font-size:var(--text-sm);font-weight:500">${formatPrice(d.price)}</div>
                    <div class="${isPos ? 'text-positive' : 'text-negative'}" style="font-size:var(--text-xs);font-family:var(--font-mono)">
                      ${isPos ? '+' : ''}${d.changePct.toFixed(2)}%
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Latest News -->
        <div class="widget mb-4">
          <div class="widget-header">
            <span class="widget-title">${icon('news', 14)} Latest News</span>
          </div>
          <div class="widget-body no-pad">
            ${news.map(n => `
              <div class="news-card">
                <div class="news-time">${n.time}</div>
                <div class="news-content">
                  <div class="news-headline">${n.headline}</div>
                  <div class="news-source">${n.source} · <span class="news-category ${n.breaking ? 'breaking' : ''}">${n.breaking ? 'BREAKING' : n.category}</span></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Upcoming Events -->
        <div class="widget">
          <div class="widget-header">
            <span class="widget-title">${icon('timeline', 14)} Upcoming Events</span>
          </div>
          <div class="widget-body">
            ${[
              { event: 'FOMC Rate Decision', date: 'Nov 2, 2026', impact: 'high' },
              { event: 'AAPL Earnings Report', date: 'Oct 24, 2026', impact: 'high' },
              { event: 'Non-Farm Payrolls', date: 'Oct 4, 2026', impact: 'high' },
              { event: 'CPI Data Release', date: 'Oct 10, 2026', impact: 'medium' },
            ].map(e => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-subtle);font-size:var(--text-sm);">
                <div>
                  <div style="color:var(--text-primary);font-weight:500">${e.event}</div>
                  <div style="color:var(--text-muted);font-size:var(--text-xs)">${e.date}</div>
                </div>
                <span class="signal-badge ${e.impact === 'high' ? 'warning' : 'info'}">${e.impact}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMiniHeatmap() {
  const sectors = getHeatmapData();
  return sectors.slice(0, 3).map(sector => `
    <div style="margin-bottom:12px;">
      <div style="font-size:var(--text-xs);color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">${sector.name}</div>
      <div class="heatmap-grid" style="grid-template-columns:repeat(auto-fill, minmax(80px, 1fr));">
        ${sector.tiles.slice(0, 6).map(t => {
          const isPos = t.change >= 0;
          const intensity = Math.min(Math.abs(t.change) / 5, 1);
          const bg = isPos
            ? `rgba(34,197,94,${0.1 + intensity * 0.35})`
            : `rgba(239,68,68,${0.1 + intensity * 0.35})`;
          return `
            <div class="heatmap-tile" style="background:${bg};" onclick="window.__setAsset && window.__setAsset('${t.ticker}')">
              <div class="heatmap-tile-ticker">${t.ticker}</div>
              <div class="heatmap-tile-change">${isPos ? '+' : ''}${t.change.toFixed(2)}%</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}

// Expose setAsset globally for onclick handlers
import { setAsset } from '../main.js';
window.__setAsset = setAsset;
