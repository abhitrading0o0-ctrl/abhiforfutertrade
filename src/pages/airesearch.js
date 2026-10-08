// ============================================================
// ForFuture — AI Research Page
// ============================================================

import { icon } from '../icons.js';
import { getAIResearchData } from '../data.js';
import { renderAssetHeader, signalClass } from '../main.js';

export function renderAIResearch(state) {
  const d = state.assetData;
  const ai = getAIResearchData(d.ticker);

  return `
    ${renderAssetHeader(d)}

    <div class="page-title">
      ${icon('aiResearch', 22)} AI Research
      <span class="page-subtitle">${d.ticker} · Evidence-based analysis</span>
    </div>

    <!-- Disclaimer -->
    <div style="background:var(--bg-secondary);border:1px solid var(--border-subtle);border-left:3px solid var(--blue);border-radius:var(--panel-radius);padding:10px 14px;margin-bottom:16px;font-size:var(--text-xs);color:var(--text-secondary);display:flex;align-items:flex-start;gap:8px;">
      ${icon('eye', 14)}
      <div>
        <strong>AI Research Disclaimer</strong> — AI analysis is an interpretive layer that synthesizes available data and indicators. It does not predict future market behavior. 
        All conclusions are traceable to underlying evidence. Always verify with primary sources and your own judgment.
      </div>
    </div>

    <!-- AI Sentiment Summary -->
    <div class="signal-summary mb-4">
      <div class="signal-summary-main">
        <div class="signal-summary-label">AI Assessment</div>
        <div class="signal-summary-value" style="font-size:var(--text-lg);color:var(--blue-text)">${ai.overallSentiment}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-left:16px;">
        <div class="text-xs text-muted">Confidence Score</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:120px;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
            <div style="width:${ai.confidence}%;height:100%;background:var(--blue);border-radius:3px;transition:width 0.5s ease;"></div>
          </div>
          <span class="text-mono text-sm fw-semibold">${ai.confidence}%</span>
        </div>
        <div class="text-xs text-muted">Based on ${state.timeframe} analysis</div>
      </div>
      <div style="margin-left:auto;">
        <div class="data-source fresh"><span class="data-source-dot"></span> Updated ${ai.lastUpdate}</div>
      </div>
    </div>

    <div class="grid-research">
      <div>
        <!-- Market Context -->
        <div class="ai-panel mb-4">
          <div class="ai-panel-header">
            <span class="ai-panel-icon">${icon('eye', 16)}</span>
            <span class="ai-panel-title">Current Market Context</span>
          </div>
          <div class="ai-section">
            <div class="ai-section-content" style="font-size:var(--text-sm);line-height:1.7;">${ai.sections.context}</div>
          </div>
        </div>

        <!-- What Changed -->
        <div class="ai-panel mb-4">
          <div class="ai-panel-header">
            <span class="ai-panel-icon">${icon('refresh', 16)}</span>
            <span class="ai-panel-title">What Is Changing</span>
          </div>
          <div class="ai-section">
            <div class="ai-section-content">
              <ul>${ai.sections.whatChanged.map(c => `<li>${c}</li>`).join('')}</ul>
            </div>
          </div>
        </div>

        <!-- Bullish Case -->
        <div class="ai-panel mb-4" style="border-left:3px solid var(--green);">
          <div class="ai-panel-header" style="background:linear-gradient(135deg, rgba(34,197,94,0.06), transparent);">
            <span class="ai-panel-icon" style="color:var(--green-text)">${icon('trendUp', 16)}</span>
            <span class="ai-panel-title">What Supports the Bullish Case</span>
          </div>
          <div class="ai-section">
            <div class="ai-section-content">
              <ul>${ai.sections.bullishCase.map(b => `<li>${b}</li>`).join('')}</ul>
            </div>
          </div>
        </div>

        <!-- Bearish Case -->
        <div class="ai-panel mb-4" style="border-left:3px solid var(--red);">
          <div class="ai-panel-header" style="background:linear-gradient(135deg, rgba(239,68,68,0.06), transparent);">
            <span class="ai-panel-icon" style="color:var(--red-text)">${icon('trendDown', 16)}</span>
            <span class="ai-panel-title">What Supports the Bearish Case</span>
          </div>
          <div class="ai-section">
            <div class="ai-section-content">
              <ul>${ai.sections.bearishCase.map(b => `<li>${b}</li>`).join('')}</ul>
            </div>
          </div>
        </div>

        <!-- Uncertainty -->
        <div class="ai-panel mb-4" style="border-left:3px solid var(--text-muted);">
          <div class="ai-panel-header">
            <span class="ai-panel-icon" style="color:var(--text-muted)">${icon('crosshair', 16)}</span>
            <span class="ai-panel-title">What Is Uncertain</span>
          </div>
          <div class="ai-section">
            <div class="ai-section-content">
              <ul>${ai.sections.uncertainty.map(u => `<li>${u}</li>`).join('')}</ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div>
        <!-- Key Risks -->
        <div class="ai-panel mb-4" style="border-left:3px solid var(--amber);">
          <div class="ai-panel-header" style="background:linear-gradient(135deg, rgba(245,158,11,0.06), transparent);">
            <span class="ai-panel-icon" style="color:var(--amber-text)">${icon('bell', 16)}</span>
            <span class="ai-panel-title">Key Risks</span>
          </div>
          <div class="ai-section">
            <div class="ai-section-content">
              <ul>${ai.sections.risks.map(r => `<li>${r}</li>`).join('')}</ul>
            </div>
          </div>
        </div>

        <!-- Upcoming Events -->
        <div class="widget mb-4">
          <div class="widget-header">
            <span class="widget-title">${icon('timeline', 14)} Important Upcoming Events</span>
          </div>
          <div class="widget-body">
            ${ai.sections.upcomingEvents.map(e => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-subtle);">
                <div>
                  <div style="font-size:var(--text-sm);font-weight:500;color:var(--text-primary)">${e.event}</div>
                  <div style="font-size:var(--text-xs);color:var(--text-muted)">${e.date}</div>
                </div>
                <span class="signal-badge ${e.impact === 'high' ? 'warning' : 'info'}">${e.impact} impact</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Data Sources -->
        <div class="widget">
          <div class="widget-header">
            <span class="widget-title">${icon('layers', 14)} Analysis Sources</span>
          </div>
          <div class="widget-body">
            ${[
              { source: 'Technical Indicators', count: '34 indicators', status: 'live' },
              { source: 'Strategy Engine', count: '10 strategies', status: 'live' },
              { source: 'News Analysis', count: '12 articles', status: 'live' },
              { source: 'Fundamental Data', count: 'FY 2025 TTM', status: 'delayed' },
              { source: 'Market Structure', count: '5 metrics', status: 'live' },
              { source: 'Sentiment Data', count: 'Aggregated', status: 'live' },
            ].map(s => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-subtle);font-size:var(--text-xs);">
                <span style="color:var(--text-secondary)">${s.source}</span>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span class="text-muted">${s.count}</span>
                  <span class="status-badge ${s.status}">${s.status}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}
