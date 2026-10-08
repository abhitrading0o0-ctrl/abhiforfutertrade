// ============================================================
// ForFuture — Technical Analysis Page
// ============================================================

import { icon } from '../icons.js';
import { getTechnicalData, getMultiTimeframeData } from '../data.js';
import { renderAssetHeader, signalClass } from '../main.js';

export function renderTechnical(state) {
  const d = state.assetData;
  const tech = getTechnicalData(d.ticker);
  const mtf = getMultiTimeframeData();

  const allIndicators = [...tech.trend, ...tech.momentum, ...tech.volatility, ...tech.volume, ...tech.structure, ...tech.orderFlow];
  const bullCount = allIndicators.filter(i => i.signal === 'BULLISH').length;
  const bearCount = allIndicators.filter(i => i.signal === 'BEARISH').length;
  const neutralCount = allIndicators.filter(i => i.signal === 'NEUTRAL').length;
  const totalCount = allIndicators.length;
  const overallSignal = bullCount > bearCount ? 'BULLISH' : bearCount > bullCount ? 'BEARISH' : 'NEUTRAL';

  const categories = [
    { key: 'trend', title: 'Trend', icon: 'trendUp', data: tech.trend },
    { key: 'momentum', title: 'Momentum', icon: 'zap', data: tech.momentum },
    { key: 'volatility', title: 'Volatility', icon: 'statistics', data: tech.volatility },
    { key: 'volume', title: 'Volume', icon: 'chart', data: tech.volume },
    { key: 'structure', title: 'Market Structure', icon: 'layers', data: tech.structure },
    { key: 'orderFlow', title: 'Order Flow', icon: 'list', data: tech.orderFlow },
  ];

  return `
    ${renderAssetHeader(d)}

    <div class="page-title">
      ${icon('technical', 22)} Technical Analysis
      <span class="page-subtitle">${d.ticker} · ${state.timeframe}</span>
    </div>

    <!-- Controls -->
    <div class="controls-row">
      <div class="control-group">
        <span class="control-label">Timeframe</span>
        <select class="control-select">
          ${['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'].map(tf =>
    `<option ${tf === state.timeframe ? 'selected' : ''}>${tf}</option>`
  ).join('')}
        </select>
      </div>
      <div class="control-group">
        <span class="control-label">Parameters</span>
        <select class="control-select">
          <option>Default</option>
          <option>Adaptive</option>
          <option>Custom</option>
        </select>
      </div>
      <button class="btn btn-secondary btn-sm">${icon('refresh', 12)} Refresh</button>
      <button class="btn btn-ghost btn-sm">${icon('settings', 12)} Advanced</button>
    </div>

    <!-- Overall Signal Summary -->
    <div class="signal-summary mb-4">
      <div class="signal-summary-main">
        <div class="signal-summary-label">Technical Consensus</div>
        <div class="signal-summary-value" style="color:var(--${overallSignal === 'BULLISH' ? 'green-text' : overallSignal === 'BEARISH' ? 'red-text' : 'text-tertiary'})">${overallSignal}</div>
      </div>
      <div class="signal-distribution">
        <div class="signal-dist-item">
          <div class="signal-dist-count text-positive">${bullCount}</div>
          <div class="signal-dist-label">Bullish</div>
        </div>
        <div class="signal-dist-item">
          <div class="signal-dist-count text-negative">${bearCount}</div>
          <div class="signal-dist-label">Bearish</div>
        </div>
        <div class="signal-dist-item">
          <div class="signal-dist-count text-muted">${neutralCount}</div>
          <div class="signal-dist-label">Neutral</div>
        </div>
      </div>
      <div class="signal-bar" style="min-width:200px">
        <div class="signal-bar-segment bullish" style="width:${(bullCount / totalCount * 100).toFixed(0)}%"></div>
        <div class="signal-bar-segment bearish" style="width:${(bearCount / totalCount * 100).toFixed(0)}%"></div>
        <div class="signal-bar-segment neutral" style="width:${(neutralCount / totalCount * 100).toFixed(0)}%"></div>
      </div>
      <div style="margin-left:auto;text-align:right;">
        <div class="data-source fresh"><span class="data-source-dot"></span> ${totalCount} indicators analyzed</div>
        <div class="text-xs text-muted mt-2">Weighted confidence — not certainty</div>
      </div>
    </div>

    <!-- Category Signal Distribution -->
    <div class="grid-6 mb-4">
      ${categories.map(cat => {
    const b = cat.data.filter(i => i.signal === 'BULLISH').length;
    const br = cat.data.filter(i => i.signal === 'BEARISH').length;
    const n = cat.data.filter(i => i.signal === 'NEUTRAL').length;
    const total = cat.data.length;
    const sig = b > br ? 'BULLISH' : br > b ? 'BEARISH' : 'NEUTRAL';
    return `
          <div class="stat-card">
            <div class="stat-label">${cat.title}</div>
            <div class="signal-badge ${signalClass(sig)}" style="align-self:flex-start;margin:4px 0">${sig}</div>
            <div style="display:flex;gap:8px;font-size:var(--text-xs);font-family:var(--font-mono);">
              <span class="text-positive">${b}</span>
              <span class="text-negative">${br}</span>
              <span class="text-muted">${n}</span>
            </div>
            <div class="signal-bar" style="height:3px">
              <div class="signal-bar-segment bullish" style="width:${(b / total * 100)}%"></div>
              <div class="signal-bar-segment bearish" style="width:${(br / total * 100)}%"></div>
              <div class="signal-bar-segment neutral" style="width:${(n / total * 100)}%"></div>
            </div>
          </div>
        `;
  }).join('')}
    </div>

    <!-- Detailed Indicators by Category -->
    ${categories.map(cat => `
      <div class="widget mb-4">
        <div class="widget-header">
          <span class="widget-title">${icon(cat.icon, 14)} ${cat.title}</span>
          <span class="text-xs text-muted">${cat.data.length} indicators</span>
        </div>
        <div class="widget-body no-pad">
          <div style="display:grid;grid-template-columns:180px 90px 80px 100px 80px 1fr;padding:6px 12px;font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid var(--border-default);background:var(--bg-secondary);">
            <div>Indicator</div>
            <div>Value</div>
            <div>Params</div>
            <div>Signal</div>
            <div>Strength</div>
            <div>Analysis</div>
          </div>
          ${cat.data.map(ind => `
            <div class="indicator-row">
              <div class="indicator-name">${ind.name}</div>
              <div class="indicator-value">${ind.value}</div>
              <div class="indicator-params">${ind.params}</div>
              <div><span class="signal-badge ${signalClass(ind.signal)}">${ind.signal}</span></div>
              <div style="font-size:var(--text-xs);color:var(--text-muted)">${ind.strength}</div>
              <div class="indicator-reason">${ind.direction} ${ind.reason}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('')}

    <!-- Multi-Timeframe Matrix -->
    <div class="widget mb-4">
      <div class="widget-header">
        <span class="widget-title">${icon('layers', 14)} Multi-Timeframe Analysis</span>
        <span class="text-xs text-muted">Click any cell for detailed analysis</span>
      </div>
      <div class="widget-body no-pad" style="padding:8px;">
        <div class="tf-matrix">
          <table>
            <thead>
              <tr>
                <th></th>
                ${mtf.timeframes.map(tf => `<th>${tf}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${mtf.categories.map(cat => `
                <tr>
                  <td>${cat}</td>
                  ${mtf.timeframes.map(tf => {
    const sig = mtf.matrix[cat][tf];
    return `<td><span class="tf-cell ${sig}" title="${cat} — ${tf}: ${sig}">${sig === 'bullish' ? '▲' : sig === 'bearish' ? '▼' : sig === 'neutral' ? '—' : '·'}</span></td>`;
  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Timeframe Summary -->
    <div class="grid-5 mb-4">
      ${[
      { label: 'Short Term', tf: '1m–15m', signal: mtf.matrix['Trend']['5m'] },
      { label: 'Intraday', tf: '15m–1H', signal: mtf.matrix['Momentum']['1H'] },
      { label: 'Swing', tf: '4H–1D', signal: mtf.matrix['Trend']['4H'] },
      { label: 'Positional', tf: '1D–1W', signal: mtf.matrix['Trend']['1D'] },
      { label: 'Long Term', tf: '1W–1M', signal: mtf.matrix['Trend']['1M'] },
    ].map(t => `
        <div class="stat-card" style="text-align:center;">
          <div class="stat-label">${t.label}</div>
          <div class="text-xs text-muted">${t.tf}</div>
          <div class="signal-badge ${t.signal}" style="align-self:center;margin-top:4px;">
            ${t.signal === 'bullish' ? '▲ BULLISH' : t.signal === 'bearish' ? '▼ BEARISH' : '— NEUTRAL'}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="data-source fresh" style="text-align:center;justify-content:center;padding:8px;">
      <span class="data-source-dot"></span>
      Analysis computed from ${totalCount} indicators across ${mtf.timeframes.length} timeframes · Source: ForFuture Analysis Engine · Parameters: ${state.timeframe} default
    </div>
  `;
}
