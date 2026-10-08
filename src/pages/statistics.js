// ============================================================
// ForFuture — Statistics Page
// ============================================================

import { icon } from '../icons.js';
import { getStatisticsData } from '../data.js';
import { renderAssetHeader } from '../main.js';

export function renderStatistics(state) {
  const d = state.assetData;
  const stats = getStatisticsData(d.ticker);

  return `
    ${renderAssetHeader(d)}

    <div class="page-title">
      ${icon('statistics', 22)} Statistics
      <span class="page-subtitle">${d.ticker} · Statistical analysis and risk metrics</span>
    </div>

    <div class="grid-2 mb-4">
      <!-- Returns -->
      <div class="widget">
        <div class="widget-header">
          <span class="widget-title">${icon('trendUp', 14)} Returns</span>
        </div>
        <div class="widget-body no-pad">
          <table class="fundamental-table">
            <thead><tr><th>Period</th><th style="text-align:right">Return</th><th style="text-align:right">Performance</th></tr></thead>
            <tbody>
              ${stats.returns.map(r => {
                const val = parseFloat(r.value);
                const isPos = val >= 0;
                const barWidth = Math.min(Math.abs(val) * 3, 100);
                return `
                  <tr>
                    <td class="label">${r.period}</td>
                    <td class="value ${isPos ? 'text-positive' : 'text-negative'}">${r.value}</td>
                    <td style="width:120px;">
                      <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;">
                        <div style="width:100px;height:4px;background:var(--bg-tertiary);border-radius:2px;overflow:hidden;position:relative;">
                          <div style="position:absolute;${isPos ? 'left:50%' : `right:50%`};width:${barWidth/2}%;height:100%;background:var(--${isPos ? 'green' : 'red'});border-radius:2px;"></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Risk Metrics -->
      <div class="widget">
        <div class="widget-header">
          <span class="widget-title">${icon('crosshair', 14)} Risk Metrics</span>
        </div>
        <div class="widget-body no-pad">
          <table class="fundamental-table">
            <thead><tr><th>Metric</th><th style="text-align:right">Value</th></tr></thead>
            <tbody>
              ${Object.entries(stats.risk).map(([key, val]) => {
                const label = key.replace(/([A-Z0-9]+)/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
                  .replace('Volatility 30d', '30d Volatility')
                  .replace('Volatility 90d', '90d Volatility')
                  .replace('Max Drawdown', 'Max Drawdown')
                  .replace('Var 95', 'VaR (95%)')
                  .replace('Cvar 95', 'CVaR (95%)')
                  .replace('Z Score', 'Z-Score');
                return `<tr><td class="label">${label}</td><td class="value">${val}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Correlation -->
    <div class="widget mb-4">
      <div class="widget-header">
        <span class="widget-title">${icon('layers', 14)} Correlation</span>
        <span class="text-xs text-muted">90-day rolling</span>
      </div>
      <div class="widget-body">
        <div class="grid-5">
          ${stats.correlation.map(c => {
            const abs = Math.abs(c.value);
            const color = c.value > 0.5 ? 'var(--green)' : c.value < -0.3 ? 'var(--red)' : 'var(--text-muted)';
            return `
              <div class="stat-card" style="text-align:center;">
                <div class="stat-label">${c.asset}</div>
                <div class="stat-value" style="color:${color}">${c.value}</div>
                <div style="width:100%;height:4px;background:var(--bg-tertiary);border-radius:2px;overflow:hidden;margin-top:4px;">
                  <div style="width:${abs * 100}%;height:100%;background:${color};border-radius:2px;opacity:0.6;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Distribution Chart placeholder -->
    <div class="widget mb-4">
      <div class="widget-header">
        <span class="widget-title">${icon('chart', 14)} Return Distribution</span>
        <span class="text-xs text-muted">Daily returns · 1 Year</span>
      </div>
      <div class="widget-body" style="height:180px;">
        <div style="display:flex;align-items:flex-end;justify-content:center;height:100%;gap:2px;padding:0 20px;">
          ${Array.from({ length: 40 }, (_, i) => {
            const x = (i - 20) / 20;
            const h = Math.exp(-x * x * 8) * 100;
            const color = i < 18 ? 'var(--red-dim)' : i > 22 ? 'var(--green-dim)' : 'var(--bg-hover)';
            return `<div style="width:100%;height:${h}%;background:${color};border-radius:2px 2px 0 0;min-width:4px;transition:height 0.3s ease;"></div>`;
          }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 20px;font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">
          <span>-5%</span>
          <span>0%</span>
          <span>+5%</span>
        </div>
      </div>
    </div>

    <div class="data-source fresh" style="justify-content:center;padding:8px;">
      <span class="data-source-dot"></span>
      Source: ForFuture Statistical Engine · Period: Rolling calculations · Simulated data
    </div>
  `;
}
