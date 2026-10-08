// ============================================================
// ForFuture — Backtesting Page
// ============================================================

import { icon } from '../icons.js';
import { getBacktestResults } from '../data.js';
import { renderAssetHeader } from '../main.js';

export function renderBacktesting(state) {
  const d = state.assetData;
  const bt = getBacktestResults();

  return `
    ${renderAssetHeader(d)}

    <div class="page-title">
      ${icon('backtesting', 22)} Backtesting
      <span class="page-subtitle">Historical strategy performance testing</span>
    </div>

    <!-- Important Notice -->
    <div style="background:var(--bg-secondary);border:1px solid var(--border-subtle);border-left:3px solid var(--amber);border-radius:var(--panel-radius);padding:10px 14px;margin-bottom:16px;font-size:var(--text-xs);color:var(--text-secondary);display:flex;align-items:flex-start;gap:8px;">
      ${icon('bell', 14)}
      <div>
        <strong>Historical Test Results</strong> — Backtesting shows how a strategy would have performed on historical data. 
        Past performance does not guarantee future results. Results are based on simulated execution with estimated fees and slippage.
      </div>
    </div>

    <!-- Configuration -->
    <div class="widget mb-4">
      <div class="widget-header">
        <span class="widget-title">${icon('settings', 14)} Backtest Configuration</span>
        <button class="btn btn-primary btn-sm">${icon('zap', 12)} Run Backtest</button>
      </div>
      <div class="widget-body">
        <div class="grid-4" style="gap:16px;">
          <div class="control-group" style="flex-direction:column;align-items:flex-start;gap:4px;">
            <span class="control-label">Asset</span>
            <select class="control-select" style="width:100%;">
              <option>${d.ticker} — ${d.name}</option>
            </select>
          </div>
          <div class="control-group" style="flex-direction:column;align-items:flex-start;gap:4px;">
            <span class="control-label">Strategy</span>
            <select class="control-select" style="width:100%;">
              <option>EMA Crossover (9/21)</option>
              <option>RSI Reversal</option>
              <option>MACD Crossover</option>
              <option>Bollinger Squeeze</option>
              <option>VWAP Reclaim</option>
              <option>Multi-Indicator Confluence</option>
            </select>
          </div>
          <div class="control-group" style="flex-direction:column;align-items:flex-start;gap:4px;">
            <span class="control-label">Timeframe</span>
            <select class="control-select" style="width:100%;">
              ${['5m','15m','1H','4H','1D'].map(tf =>
                `<option ${tf === '1D' ? 'selected' : ''}>${tf}</option>`
              ).join('')}
            </select>
          </div>
          <div class="control-group" style="flex-direction:column;align-items:flex-start;gap:4px;">
            <span class="control-label">Period</span>
            <select class="control-select" style="width:100%;">
              <option>Jan 2024 – Sep 2026</option>
              <option>Jan 2025 – Sep 2026</option>
              <option>Jan 2023 – Sep 2026</option>
            </select>
          </div>
        </div>
        <div class="grid-3 mt-3" style="gap:16px;">
          <div class="control-group" style="flex-direction:column;align-items:flex-start;gap:4px;">
            <span class="control-label">Starting Capital</span>
            <input type="text" value="$100,000" style="width:100%;" />
          </div>
          <div class="control-group" style="flex-direction:column;align-items:flex-start;gap:4px;">
            <span class="control-label">Commission (per trade)</span>
            <input type="text" value="$4.95" style="width:100%;" />
          </div>
          <div class="control-group" style="flex-direction:column;align-items:flex-start;gap:4px;">
            <span class="control-label">Slippage (est.)</span>
            <input type="text" value="0.05%" style="width:100%;" />
          </div>
        </div>
      </div>
    </div>

    <!-- Results Summary -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
      <span class="status-badge historical">HISTORICAL TEST RESULTS</span>
      <span class="text-xs text-muted">${bt.strategy} · ${bt.asset} · ${bt.timeframe} · ${bt.period}</span>
    </div>

    <div class="backtest-results">
      ${[
        { label: 'Total Return', value: bt.totalReturn, highlight: true },
        { label: 'Annual Return', value: bt.annualReturn },
        { label: 'Win Rate', value: bt.winRate },
        { label: 'Profit Factor', value: bt.profitFactor },
        { label: 'Max Drawdown', value: bt.maxDrawdown, negative: true },
        { label: 'Sharpe Ratio', value: bt.sharpe },
        { label: 'Sortino Ratio', value: bt.sortino },
        { label: 'Total Trades', value: bt.totalTrades },
      ].map(m => `
        <div class="backtest-metric">
          <div class="backtest-metric-label">${m.label}</div>
          <div class="backtest-metric-value ${m.negative ? 'text-negative' : m.highlight ? 'text-positive' : ''}">${m.value}</div>
        </div>
      `).join('')}
    </div>

    <!-- Equity Curve -->
    <div class="widget mb-4">
      <div class="widget-header">
        <span class="widget-title">${icon('chart', 14)} Equity Curve</span>
        <span class="status-badge historical">SIMULATED</span>
      </div>
      <div class="widget-body no-pad">
        <div data-chart="equity" style="height:320px;"></div>
      </div>
    </div>

    <div class="grid-2 mb-4">
      <!-- Trade Statistics -->
      <div class="widget">
        <div class="widget-header">
          <span class="widget-title">Trade Statistics</span>
        </div>
        <div class="widget-body no-pad">
          <table class="fundamental-table">
            <tbody>
              ${[
                ['Total Trades', bt.totalTrades],
                ['Average Trade', bt.avgTrade],
                ['Average Win', bt.avgWin],
                ['Average Loss', bt.avgLoss],
                ['Commission Paid', bt.fees],
                ['Slippage Cost', bt.slippage],
              ].map(([l, v]) => {
                const isNeg = typeof v === 'string' && v.startsWith('-');
                return `<tr><td class="label">${l}</td><td class="value ${isNeg ? 'text-negative' : ''}">${v}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Performance Breakdown -->
      <div class="widget">
        <div class="widget-header">
          <span class="widget-title">Risk Analysis</span>
        </div>
        <div class="widget-body no-pad">
          <table class="fundamental-table">
            <tbody>
              ${[
                ['Max Drawdown', bt.maxDrawdown],
                ['Sharpe Ratio', bt.sharpe],
                ['Sortino Ratio', bt.sortino],
                ['Starting Capital', bt.startingCapital],
                ['Strategy', bt.strategy],
                ['Status', bt.status],
              ].map(([l, v]) => `<tr><td class="label">${l}</td><td class="value">${v}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Disclaimer -->
    <div class="data-source stale" style="justify-content:center;padding:12px;flex-direction:column;align-items:center;gap:4px;">
      <div style="display:flex;align-items:center;gap:4px;">
        <span class="data-source-dot"></span>
        Source: ${bt.source} · Status: ${bt.status}
      </div>
      <div style="font-size:10px;color:var(--text-muted);max-width:500px;text-align:center;">${bt.disclaimer}</div>
    </div>
  `;
}
