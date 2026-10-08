// ============================================================
// ForFuture — Research Page (Main Workspace) (v4.0)
// Uses unified MarketDataService for chart, stats, and live telemetry
// ============================================================

import { icon } from '../icons.js';
import { getTechnicalData, getStrategyData, getNewsData, getAIResearchData, getMultiTimeframeData } from '../data.js';
import { renderAssetHeader, formatPrice, formatVolume, signalClass, state, navigate } from '../main.js';
import { marketDataClient, formatTradingTime } from '../marketDataClient.js';
import { initCharts } from '../chartEngine.js';

export function renderResearch(appState) {
  const d = appState.assetData;
  if (!d) return '<div class="empty-state"><div class="empty-state-title">Select an asset to begin research</div></div>';

  const isForex = d.ticker.includes('/') || d.type === 'Forex';
  const activeProv = isForex ? marketDataClient.getActiveProvider() : 'Market Data Feed';
  const isBackup = isForex ? marketDataClient.isBackupActive() : false;
  const providerName = isForex ? `${activeProv}${isBackup ? ' [BACKUP]' : ''}` : 'Market Data Feed';
  const timeframes = ['1M', '5M', '15M', '30M', '1H', '4H', '1D', '1W', '1MN'];
  const activeTf = (appState.timeframe || '1D').toUpperCase();

  const tech = getTechnicalData(d.ticker);
  const strategies = getStrategyData(d.ticker);
  const news = getNewsData(d.ticker).slice(0, 5);
  const ai = getAIResearchData(d.ticker);
  const mtf = getMultiTimeframeData();

  // Count signals
  const allIndicators = [...tech.trend, ...tech.momentum, ...tech.volatility, ...tech.volume, ...tech.structure, ...tech.orderFlow];
  const bullCount = allIndicators.filter(i => i.signal === 'BULLISH').length;
  const bearCount = allIndicators.filter(i => i.signal === 'BEARISH').length;
  const neutralCount = allIndicators.filter(i => i.signal === 'NEUTRAL').length;
  const totalCount = allIndicators.length;

  const bullStrat = strategies.filter(s => s.signal === 'BULLISH').length;
  const bearStrat = strategies.filter(s => s.signal === 'BEARISH').length;
  const neutralStrat = strategies.filter(s => s.signal === 'NEUTRAL').length;

  const overallSignal = bullCount > bearCount ? 'BULLISH' : bearCount > bullCount ? 'BEARISH' : 'NEUTRAL';

  return `
    ${renderAssetHeader(d)}

    <!-- Summary Stats (Driven by Unified Market Data) -->
    <div class="grid-6 mb-4">
      <div class="stat-card">
        <div class="stat-label">Open</div>
        <div class="stat-value mono" id="resStatOpen" style="font-size:var(--text-md)">${formatPrice(d.open)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">24h High</div>
        <div class="stat-value mono" id="resStatHigh" style="font-size:var(--text-md)">${formatPrice(d.high24h)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">24h Low</div>
        <div class="stat-value mono" id="resStatLow" style="font-size:var(--text-md)">${formatPrice(d.low24h)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${isForex ? 'Tick Volume' : 'Volume'}</div>
        <div class="stat-value mono" id="resStatVolume" style="font-size:var(--text-md)">${isForex ? `${d.volume || 1000} ticks` : formatVolume(d.volume)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Volatility</div>
        <div class="stat-value mono" style="font-size:var(--text-md)">${d.volatility}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Data Provider</div>
        <div class="stat-value" id="resStatProvider" style="font-size:var(--text-xs);color:var(--accent-blue);font-weight:600;">${providerName}</div>
      </div>
    </div>

    <div class="grid-research">
      <!-- Left Column: Chart + Analysis -->
      <div>
        <!-- Research Chart Widget -->
        <div class="widget mb-4">
          <div class="widget-header" style="flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="widget-title">${icon('chart', 14)} ${d.ticker} Interactive Chart</span>
              <span id="researchConnectionBadge" class="status-badge live">LIVE</span>
              <span id="researchLivePrice" class="mono" style="font-size:13px;font-weight:700;color:var(--text-primary);margin-left:4px;">${formatPrice(d.price)}</span>
              <span id="researchLiveChange" class="mono" style="font-size:11px;color:${d.change >= 0 ? 'var(--green-text)' : 'var(--red-text)'};">${d.change >= 0 ? '+' : ''}${d.change.toFixed(2)} (${d.changePct.toFixed(2)}%)</span>
            </div>

            <div class="panel-actions" style="margin-left:auto;display:flex;align-items:center;gap:6px;">
              <!-- Supported Timeframes (Requirement 14) -->
              <div class="chart-toolbar-group">
                ${timeframes.map(tf => `
                  <button class="chart-toolbar-btn ${tf === activeTf ? 'active' : ''}" data-tf="${tf}">${tf}</button>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Sub-header metadata -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 14px;background:var(--bg-tertiary);border-bottom:1px solid var(--border-subtle);font-size:11px;font-family:var(--font-mono);">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="color:var(--text-muted)">SOURCE: <strong id="researchDataSource" style="color:var(--accent-blue)">${providerName}</strong></span>
              <span style="color:var(--text-muted)">BASIS: <strong style="color:var(--text-primary)">MID</strong></span>
              <span style="color:var(--text-muted)">TYPE: <strong style="color:var(--text-secondary)">${isForex ? 'TICK VOLUME' : 'CENTRAL VOLUME'}</strong></span>
            </div>
            <div style="color:var(--text-muted)">
              TIME: <span id="researchLastUpdate" style="color:var(--text-secondary)">${formatTradingTime(Date.now(), true)}</span>
            </div>
          </div>

          <!-- Chart Area with ResizeObserver -->
          <div class="widget-body no-pad" style="position:relative;background:#0f1117;">
            <div id="researchChartArea" class="chart-area" data-chart="candle" data-main="true" style="height:420px;width:100%;position:relative;"></div>
          </div>
        </div>

        <!-- Technical Signal Summary -->
        <div class="signal-summary mb-4">
          <div class="signal-summary-main">
            <div class="signal-summary-label">Technical Consensus</div>
            <div class="signal-summary-value ${signalClass(overallSignal)}" style="color:var(--${overallSignal === 'BULLISH' ? 'green-text' : overallSignal === 'BEARISH' ? 'red-text' : 'text-tertiary'})">${overallSignal}</div>
          </div>
          <div class="signal-distribution">
            <div class="signal-dist-item">
              <div class="signal-dist-count text-positive">${bullCount}</div>
              <div class="signal-dist-label">Bull</div>
            </div>
            <div class="signal-dist-item">
              <div class="signal-dist-count text-negative">${bearCount}</div>
              <div class="signal-dist-label">Bear</div>
            </div>
            <div class="signal-dist-item">
              <div class="signal-dist-count text-muted">${neutralCount}</div>
              <div class="signal-dist-label">Neutral</div>
            </div>
          </div>
          <div class="signal-bar">
            <div class="signal-bar-segment bullish" style="width:${(bullCount/totalCount*100).toFixed(0)}%"></div>
            <div class="signal-bar-segment bearish" style="width:${(bearCount/totalCount*100).toFixed(0)}%"></div>
            <div class="signal-bar-segment neutral" style="width:${(neutralCount/totalCount*100).toFixed(0)}%"></div>
          </div>
          <div class="data-source fresh" style="margin-left:auto;white-space:nowrap;">
            <span class="data-source-dot"></span>
            ${totalCount} indicators · ${appState.timeframe}
          </div>
        </div>

        <!-- Technical Summary -->
        <div class="widget mb-4">
          <div class="widget-header">
            <span class="widget-title">${icon('technical', 14)} Key Technical Indicators</span>
            <button class="btn btn-ghost btn-sm" onclick="window.__navigate && window.__navigate('technical')">View Full Analysis →</button>
          </div>
          <div class="widget-body no-pad">
            ${renderIndicatorSection('Trend', tech.trend.slice(0, 4))}
            ${renderIndicatorSection('Momentum', tech.momentum.slice(0, 3))}
          </div>
        </div>

        <!-- Strategy Summary -->
        <div class="widget mb-4">
          <div class="widget-header">
            <span class="widget-title">${icon('strategy', 14)} Strategy Signals</span>
            <div class="panel-actions">
              <span class="signal-badge bullish" style="margin-right:4px;">${bullStrat} Bull</span>
              <span class="signal-badge bearish" style="margin-right:4px;">${bearStrat} Bear</span>
              <span class="signal-badge neutral">${neutralStrat} Neutral</span>
            </div>
          </div>
          <div class="widget-body">
            ${strategies.slice(0, 4).map(s => `
              <div class="strategy-row">
                <div class="strategy-row-header">
                  <span class="strategy-name">${s.name}</span>
                  <span class="signal-badge ${signalClass(s.signal)}">${s.signal} · ${s.strength}</span>
                </div>
                <div class="strategy-conditions">
                  ${s.conditionsMet.map(c => `<span class="strategy-condition met">✓ ${c}</span>`).join('')}
                  ${s.conditionsUnmet.slice(0, 2).map(c => `<span class="strategy-condition unmet">○ ${c}</span>`).join('')}
                </div>
              </div>
            `).join('')}
            <div style="text-align:center;padding:8px;">
              <button class="btn btn-ghost btn-sm" onclick="window.__navigate && window.__navigate('strategy')">View All ${strategies.length} Strategies →</button>
            </div>
          </div>
        </div>

        <!-- Multi-Timeframe Matrix -->
        <div class="widget">
          <div class="widget-header">
            <span class="widget-title">${icon('layers', 14)} Multi-Timeframe Matrix</span>
          </div>
          <div class="widget-body no-pad">
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
                        return `<td><span class="tf-cell ${sig}">${sig === 'bullish' ? '▲' : sig === 'bearish' ? '▼' : sig === 'neutral' ? '—' : '·'}</span></td>`;
                      }).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: AI + News + Events -->
      <div>
        <!-- AI Research Snapshot -->
        <div class="ai-panel mb-4">
          <div class="ai-panel-header">
            <span class="ai-panel-icon">${icon('aiResearch', 18)}</span>
            <span class="ai-panel-title">AI Research</span>
            <span class="ai-panel-timestamp">Updated ${ai.lastUpdate}</span>
          </div>
          <div class="ai-section">
            <div class="ai-section-title">${icon('zap', 12)} Market Context</div>
            <div class="ai-section-content">${ai.sections.context}</div>
          </div>
          <div class="ai-section">
            <div class="ai-section-title" style="color:var(--green-text)">▲ Bullish Case</div>
            <div class="ai-section-content">
              <ul>${ai.sections.bullishCase.slice(0, 3).map(b => `<li>${b}</li>`).join('')}</ul>
            </div>
          </div>
          <div class="ai-section">
            <div class="ai-section-title" style="color:var(--red-text)">▼ Bearish Case</div>
            <div class="ai-section-content">
              <ul>${ai.sections.bearishCase.slice(0, 3).map(b => `<li>${b}</li>`).join('')}</ul>
            </div>
          </div>
          <div class="ai-section">
            <div class="ai-section-title" style="color:var(--amber-text)">⚠ Key Risks</div>
            <div class="ai-section-content">
              <ul>${ai.sections.risks.slice(0, 2).map(r => `<li>${r}</li>`).join('')}</ul>
            </div>
          </div>
          <div style="padding:8px 16px;text-align:center;">
            <button class="btn btn-ghost btn-sm" onclick="window.__navigate && window.__navigate('airesearch')">Full AI Analysis →</button>
          </div>
        </div>

        <!-- News -->
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
            ${ai.sections.upcomingEvents.map(e => `
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

function renderIndicatorSection(title, indicators) {
  return `
    <div style="border-bottom:1px solid var(--border-default);">
      <div style="padding:6px 12px;font-size:var(--text-xs);color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;background:var(--bg-secondary);">${title}</div>
      ${indicators.map(ind => `
        <div class="indicator-row">
          <div class="indicator-name">${ind.name}</div>
          <div class="indicator-value">${ind.value}</div>
          <div class="indicator-params">${ind.params}</div>
          <div><span class="signal-badge ${signalClass(ind.signal)}">${ind.signal}</span></div>
          <div style="font-size:var(--text-xs);color:var(--text-muted)">${ind.strength}</div>
          <div class="indicator-reason">${ind.reason}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// Setup live interactivity and data bindings for Research page
export function setupResearchPage(appState) {
  const symbol = appState.assetData?.ticker || appState.currentAsset || 'EUR/USD';

  // Wire timeframe buttons on research page
  document.querySelectorAll('#appContent .widget [data-tf]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll('#appContent .widget [data-tf]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.timeframe = btn.dataset.tf;
      initCharts(appState);
    };
  });

  // Listen to live ticks from MarketDataService to synchronize price displays
  const onTick = (tick) => {
    if (tick.symbol !== symbol) return;

    const priceEl = document.getElementById('researchLivePrice');
    const updateEl = document.getElementById('researchLastUpdate');
    const sourceEl = document.getElementById('researchDataSource');
    const badgeEl = document.getElementById('researchConnectionBadge');

    if (priceEl) {
      priceEl.textContent = formatPrice(tick.mid || tick.close);
      priceEl.style.color = tick.close >= tick.open ? 'var(--green-text)' : 'var(--red-text)';
      setTimeout(() => { if (priceEl) priceEl.style.color = 'var(--text-primary)'; }, 400);
    }

    if (updateEl && tick.timestamp) {
      updateEl.textContent = formatTradingTime(tick.timestamp, true);
    }

    if (sourceEl) {
      const pName = (tick.provider || (symbol.includes('/') ? 'OANDA (v20 API)' : 'Market Data')) + (tick.isBackup ? ' [BACKUP]' : '');
      sourceEl.textContent = pName;
      sourceEl.style.color = tick.isBackup ? 'var(--yellow-text)' : 'var(--accent-blue)';
    }

    const statProvider = document.getElementById('resStatProvider');
    if (statProvider && tick.provider) {
      statProvider.textContent = tick.provider + (tick.isBackup ? ' [BACKUP]' : '');
      statProvider.style.color = tick.isBackup ? 'var(--yellow-text)' : 'var(--accent-blue)';
    }

    if (badgeEl) {
      badgeEl.textContent = 'LIVE';
      badgeEl.className = 'status-badge live';
    }

    // Update top stat cards
    const statHigh = document.getElementById('resStatHigh');
    const statLow = document.getElementById('resStatLow');
    const statVol = document.getElementById('resStatVolume');
    if (statHigh && tick.high) statHigh.textContent = formatPrice(tick.high);
    if (statLow && tick.low) statLow.textContent = formatPrice(tick.low);
    if (statVol && tick.volume) {
      statVol.textContent = symbol.includes('/') ? `${tick.volume} ticks` : formatVolume(tick.volume);
    }
  };

  const onStatus = ({ status }) => {
    const badgeEl = document.getElementById('researchConnectionBadge');
    if (badgeEl) {
      badgeEl.textContent = status;
      badgeEl.className = status === 'LIVE' ? 'status-badge live' : 'status-badge';
      if (status !== 'LIVE') {
        badgeEl.style.background = 'rgba(239,68,68,0.15)';
        badgeEl.style.color = 'var(--red-text)';
      }
    }
  };

  const updateProviderUI = (pName, isBackup) => {
    const text = (pName || 'OANDA') + (isBackup ? ' [BACKUP]' : '');
    const sourceEl = document.getElementById('researchDataSource');
    const statProvider = document.getElementById('resStatProvider');
    if (sourceEl) {
      sourceEl.textContent = text;
      sourceEl.style.color = isBackup ? 'var(--yellow-text)' : 'var(--accent-blue)';
    }
    if (statProvider) {
      statProvider.textContent = text;
      statProvider.style.color = isBackup ? 'var(--yellow-text)' : 'var(--accent-blue)';
    }
  };

  marketDataClient.on('tick', onTick);
  marketDataClient.on('candleUpdate', onTick);
  marketDataClient.on('statusChange', onStatus);
  marketDataClient.on('providerSwitch', (data) => updateProviderUI(data.newProvider, data.isBackup));
  marketDataClient.on('providerStatus', (data) => updateProviderUI(data.activeProvider, data.isBackup));
}

window.__navigate = navigate;
