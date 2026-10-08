// ============================================================
// ForFuture — Fundamentals Page
// ============================================================

import { icon } from '../icons.js';
import { getFundamentalData } from '../data.js';
import { renderAssetHeader } from '../main.js';

export function renderFundamentals(state) {
  const d = state.assetData;
  const fund = getFundamentalData(d.ticker);

  return `
    ${renderAssetHeader(d)}

    <div class="page-title">
      ${icon('fundamentals', 22)} Fundamental Research
      <span class="page-subtitle">${d.ticker} · ${d.name}</span>
    </div>

    <!-- Company Overview -->
    <div class="widget mb-4">
      <div class="widget-header">
        <span class="widget-title">${icon('research', 14)} Company Overview</span>
      </div>
      <div class="widget-body">
        <p style="font-size:var(--text-sm);color:var(--text-secondary);line-height:var(--leading-relaxed);margin-bottom:12px;">${fund.overview.description}</p>
        <div class="grid-4" style="font-size:var(--text-xs);">
          ${[
            ['Sector', fund.overview.sector],
            ['Industry', fund.overview.industry],
            ['Employees', fund.overview.employees],
            ['Headquarters', fund.overview.headquarters],
            ['CEO', fund.overview.ceo],
            ['Founded', fund.overview.founded],
          ].map(([l, v]) => `
            <div style="padding:4px 0;">
              <span class="text-muted">${l}</span><br/>
              <span style="font-weight:500">${v}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="grid-2 mb-4">
      <!-- Income Statement -->
      <div class="widget">
        <div class="widget-header">
          <span class="widget-title">Income Statement</span>
          <span class="text-xs text-muted">${fund.period}</span>
        </div>
        <div class="widget-body no-pad">
          <table class="fundamental-table">
            <thead><tr><th>Metric</th><th style="text-align:right">Current</th><th style="text-align:right">Previous</th><th style="text-align:right">Change</th></tr></thead>
            <tbody>
              ${Object.entries(fund.income).map(([key, row]) => {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                const isPos = row.change.startsWith('+');
                return `
                  <tr>
                    <td class="label">${label}</td>
                    <td class="value">${row.current}</td>
                    <td class="value" style="color:var(--text-muted)">${row.prev}</td>
                    <td class="value ${isPos ? 'text-positive' : 'text-negative'}">${row.change}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Valuation -->
      <div class="widget">
        <div class="widget-header">
          <span class="widget-title">Valuation</span>
          <span class="text-xs text-muted">${fund.period}</span>
        </div>
        <div class="widget-body no-pad">
          <table class="fundamental-table">
            <thead><tr><th>Metric</th><th style="text-align:right">Value</th></tr></thead>
            <tbody>
              ${Object.entries(fund.valuation).map(([key, val]) => {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
                  .replace('Pe', 'P/E').replace('Peg', 'PEG').replace('Ev', 'EV');
                return `<tr><td class="label">${label}</td><td class="value">${val}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="grid-3 mb-4">
      <!-- Balance Sheet -->
      <div class="widget">
        <div class="widget-header">
          <span class="widget-title">Balance Sheet</span>
        </div>
        <div class="widget-body no-pad">
          <table class="fundamental-table">
            <tbody>
              ${Object.entries(fund.balance).map(([key, val]) => {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                return `<tr><td class="label">${label}</td><td class="value">${val}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Growth -->
      <div class="widget">
        <div class="widget-header">
          <span class="widget-title">Growth</span>
        </div>
        <div class="widget-body no-pad">
          <table class="fundamental-table">
            <tbody>
              ${Object.entries(fund.growth).map(([key, val]) => {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                const isPos = val.startsWith('+');
                return `<tr><td class="label">${label}</td><td class="value ${isPos ? 'text-positive' : 'text-negative'}">${val}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Returns & Dividends -->
      <div class="widget">
        <div class="widget-header">
          <span class="widget-title">Returns & Dividends</span>
        </div>
        <div class="widget-body no-pad">
          <table class="fundamental-table">
            <tbody>
              ${Object.entries(fund.returns).map(([key, val]) => {
                const label = key.toUpperCase();
                return `<tr><td class="label">${label}</td><td class="value">${val}</td></tr>`;
              }).join('')}
              <tr><td colspan="2" style="height:8px;border:none;"></td></tr>
              ${Object.entries(fund.dividends).map(([key, val]) => {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                return `<tr><td class="label">${label}</td><td class="value">${val}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Data Source -->
    <div class="data-source stale" style="justify-content:center;padding:8px;">
      <span class="data-source-dot"></span>
      Source: ${fund.source} · Period: ${fund.period} · Last Updated: ${fund.lastUpdate}
    </div>
  `;
}
