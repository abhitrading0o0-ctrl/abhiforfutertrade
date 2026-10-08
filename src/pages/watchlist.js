// ============================================================
// ForFuture — Watchlist Page
// ============================================================

import { icon } from '../icons.js';
import { getWatchlistData, getAssetData } from '../data.js';
import { formatPrice, formatVolume, signalClass, setAsset, navigate } from '../main.js';

export function renderWatchlist(state) {
  const watchlistAssets = state.watchlist.map(ticker => {
    const d = getAssetData(ticker);
    return {
      ...d,
      technicalSignal: ['BULLISH', 'BEARISH', 'NEUTRAL'][Math.floor(Math.random() * 3)],
      strategySignal: ['BULLISH', 'BEARISH', 'NEUTRAL'][Math.floor(Math.random() * 3)],
      hasNews: Math.random() > 0.5,
    };
  });

  return `
    <div class="page-title">
      ${icon('watchlist', 22)} Watchlists
      <span class="page-subtitle">${state.watchlist.length} assets tracked</span>
    </div>

    <div class="controls-row">
      <div class="chart-toolbar-group" style="font-family:var(--font-sans);">
        <button class="chart-toolbar-btn active" style="font-family:var(--font-sans);">Main Watchlist</button>
        <button class="chart-toolbar-btn" style="font-family:var(--font-sans);">Tech Stocks</button>
        <button class="chart-toolbar-btn" style="font-family:var(--font-sans);">Crypto</button>
        <button class="chart-toolbar-btn" style="font-family:var(--font-sans);">+ New</button>
      </div>
      <div style="margin-left:auto;display:flex;gap:4px;">
        <button class="btn btn-secondary btn-sm">${icon('sort', 12)} Sort</button>
        <button class="btn btn-secondary btn-sm">${icon('filter', 12)} Filter</button>
        <button class="btn btn-primary btn-sm">${icon('plus', 12)} Add Asset</button>
      </div>
    </div>

    <div class="widget">
      <div class="widget-body no-pad" style="overflow-x:auto;">
        <table class="watchlist-table">
          <thead>
            <tr>
              <th style="width:30px;"></th>
              <th>Asset</th>
              <th class="num">Price</th>
              <th class="num">Change</th>
              <th class="num">Volume</th>
              <th class="num">Volatility</th>
              <th>Technical</th>
              <th>Strategy</th>
              <th>News</th>
              <th style="width:40px;"></th>
            </tr>
          </thead>
          <tbody>
            ${watchlistAssets.map((a, i) => {
              const isPos = a.changePct >= 0;
              return `
                <tr onclick="window.__setAsset && window.__setAsset('${a.ticker}'); window.__navigate && window.__navigate('research');">
                  <td style="text-align:center;color:var(--text-muted);font-size:var(--text-xs);font-family:var(--font-mono)">${i + 1}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div class="asset-logo" style="width:28px;height:28px;font-size:10px;">${a.logo}</div>
                      <div>
                        <div class="watchlist-ticker">${a.ticker}</div>
                        <div class="watchlist-name">${a.name}</div>
                      </div>
                    </div>
                  </td>
                  <td class="num" style="font-weight:600;">${formatPrice(a.price)}</td>
                  <td class="num ${isPos ? 'text-positive' : 'text-negative'}" style="font-weight:600;">
                    ${isPos ? '+' : ''}${a.changePct.toFixed(2)}%
                  </td>
                  <td class="num text-secondary">${formatVolume(a.volume)}</td>
                  <td class="num text-secondary">${a.volatility}%</td>
                  <td><span class="signal-badge ${signalClass(a.technicalSignal)}" style="font-size:10px;">${a.technicalSignal}</span></td>
                  <td><span class="signal-badge ${signalClass(a.strategySignal)}" style="font-size:10px;">${a.strategySignal}</span></td>
                  <td style="text-align:center;">
                    ${a.hasNews ? `<span style="color:var(--amber-text);font-size:var(--text-xs);">●</span>` : '<span style="color:var(--text-muted);">—</span>'}
                  </td>
                  <td style="text-align:center;">
                    <button class="btn btn-ghost btn-sm" style="padding:2px;" title="Remove">${icon('close', 12)}</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="data-source fresh mt-3" style="justify-content:center;">
      <span class="data-source-dot"></span>
      Auto-refreshing every 5 seconds · ${watchlistAssets.length} assets · Click any row to open research
    </div>
  `;
}
