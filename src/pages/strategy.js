// ============================================================
// ForFuture — Strategy Analysis Page
// ============================================================

import { icon } from '../icons.js';
import { getStrategyData } from '../data.js';
import { renderAssetHeader, signalClass } from '../main.js';

export function renderStrategy(state) {
  const d = state.assetData;
  const strategies = getStrategyData(d.ticker);

  const bullCount = strategies.filter(s => s.signal === 'BULLISH').length;
  const bearCount = strategies.filter(s => s.signal === 'BEARISH').length;
  const neutralCount = strategies.filter(s => s.signal === 'NEUTRAL').length;
  const totalCount = strategies.length;
  const overallSignal = bullCount > bearCount ? 'BULLISH' : bearCount > bullCount ? 'BEARISH' : 'NEUTRAL';

  // Group by family
  const families = {};
  strategies.forEach(s => {
    if (!families[s.family]) families[s.family] = [];
    families[s.family].push(s);
  });

  return `
    ${renderAssetHeader(d)}

    <div class="page-title">
      ${icon('strategy', 22)} Strategy Analysis
      <span class="page-subtitle">${d.ticker} · ${state.timeframe} · Current Market Conditions</span>
    </div>

    <div class="controls-row">
      <div class="control-group">
        <span class="control-label">Timeframe</span>
        <select class="control-select">
          ${['5m', '15m', '1H', '4H', '1D'].map(tf =>
    `<option ${tf === state.timeframe ? 'selected' : ''}>${tf}</option>`
  ).join('')}
        </select>
      </div>
      <div class="control-group">
        <span class="control-label">Parameters</span>
        <select class="control-select">
          <option>Default</option>
          <option>Adaptive</option>
          <option>Aggressive</option>
          <option>Conservative</option>
        </select>
      </div>
      <button class="btn btn-secondary btn-sm">${icon('refresh', 12)} Refresh All</button>
      <button class="btn btn-ghost btn-sm">${icon('filter', 12)} Filter</button>
      <div style="margin-left:auto;" class="data-source fresh">
        <span class="data-source-dot"></span>
        ${totalCount} strategies evaluated · Updated 8s ago
      </div>
    </div>

    <!-- Strategy Signal Summary -->
    <div class="signal-summary mb-4">
      <div class="signal-summary-main">
        <div class="signal-summary-label">Strategy Consensus</div>
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
    </div>

    <!-- Important Notice -->
    <div style="background:var(--bg-secondary);border:1px solid var(--border-subtle);border-left:3px solid var(--blue);border-radius:var(--panel-radius);padding:10px 14px;margin-bottom:16px;font-size:var(--text-xs);color:var(--text-secondary);display:flex;align-items:center;gap:8px;">
      ${icon('eye', 14)}
      <div>
        <strong>Current Market Analysis</strong> — These signals reflect strategy conditions applied to <strong>current</strong> market data. 
        This is NOT historical backtesting. For historical performance, use the <a href="#" onclick="window.__navigate && window.__navigate('backtesting');return false;" style="color:var(--blue-text)">Backtesting</a> page.
      </div>
    </div>

    <!-- All Strategies -->
    ${strategies.map(s => {
    const metCount = s.conditionsMet.length;
    const unmetCount = s.conditionsUnmet.length;
    const totalConds = metCount + unmetCount;
    const pct = (metCount / totalConds * 100).toFixed(0);

    return `
        <div class="strategy-row">
          <div class="strategy-row-header">
            <div>
              <span class="strategy-name">${s.name}</span>
              <span style="font-size:var(--text-xs);color:var(--text-muted);margin-left:8px;">${s.family}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:var(--text-xs);color:var(--text-muted);font-family:var(--font-mono)">${metCount}/${totalConds}</span>
              <span class="signal-badge ${signalClass(s.signal)}">${s.signal} · ${s.strength}</span>
            </div>
          </div>

          <!-- Condition Progress Bar -->
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="flex:1;height:3px;background:var(--bg-primary);border-radius:2px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${s.signal === 'BULLISH' ? 'var(--green)' : s.signal === 'BEARISH' ? 'var(--red)' : 'var(--text-muted)'};transition:width 0.3s ease;"></div>
            </div>
            <span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono)">${pct}%</span>
          </div>

          <div class="strategy-conditions">
            ${s.conditionsMet.map(c => `<span class="strategy-condition met">✓ ${c}</span>`).join('')}
            ${s.conditionsUnmet.map(c => `<span class="strategy-condition unmet">○ ${c}</span>`).join('')}
          </div>

          <div class="strategy-reasoning">${s.reasoning}</div>

          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
            <div style="display:flex;gap:4px;">
              ${s.indicators.map(ind => `
                <span style="font-size:10px;color:var(--blue-text);background:var(--blue-dim);padding:1px 5px;border-radius:3px;">${ind}</span>
              `).join('')}
            </div>
            <span style="font-size:10px;color:var(--text-muted)">${s.timestamp}</span>
          </div>
        </div>
      `;
  }).join('')}

    <!-- Adaptive Engine Notice -->
    <div class="widget mt-4">
      <div class="widget-header">
        <span class="widget-title">${icon('settings', 14)} Adaptive Strategy Engine</span>
        <span class="status-badge info">ACTIVE</span>
      </div>
      <div class="widget-body">
        <div class="grid-4" style="font-size:var(--text-xs);">
          <div>
            <span class="text-muted">Asset Type</span><br/>
            <span class="text-mono fw-semibold">${d.type}</span>
          </div>
          <div>
            <span class="text-muted">Volatility Regime</span><br/>
            <span class="text-mono fw-semibold">${d.volatility > 35 ? 'HIGH' : d.volatility > 20 ? 'MODERATE' : 'LOW'}</span>
          </div>
          <div>
            <span class="text-muted">Timeframe</span><br/>
            <span class="text-mono fw-semibold">${state.timeframe}</span>
          </div>
          <div>
            <span class="text-muted">Parameter Mode</span><br/>
            <span class="text-mono fw-semibold">Adaptive (Default)</span>
          </div>
        </div>
        <div style="margin-top:8px;font-size:10px;color:var(--text-muted);">
          Parameters are adjusted based on asset type, volatility regime, timeframe, and historical behavior. Advanced users can inspect and override individual parameters.
        </div>
      </div>
    </div>
  `;
}
