// ============================================================
// ForFuture — News & Events Page
// ============================================================

import { icon } from '../icons.js';
import { getNewsData } from '../data.js';
import { renderAssetHeader } from '../main.js';

export function renderNews(state) {
  const d = state.assetData;
  const allNews = getNewsData(d.ticker);

  const categories = ['all', 'breaking', 'earnings', 'macro', 'analyst', 'product', 'regulatory', 'industry'];

  return `
    ${renderAssetHeader(d)}

    <div class="page-title">
      ${icon('news', 22)} News & Events
      <span class="page-subtitle">${d.ticker} · Latest developments</span>
    </div>

    <!-- Category Tabs -->
    <div class="tabs mb-4">
      ${categories.map(cat => `
        <div class="tab ${cat === 'all' ? 'active' : ''}">${cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}</div>
      `).join('')}
    </div>

    <div class="grid-research">
      <div>
        <!-- Important Developments -->
        <div class="widget mb-4">
          <div class="widget-header">
            <span class="widget-title" style="color:var(--amber-text)">${icon('zap', 14)} Important Developments</span>
          </div>
          <div class="widget-body no-pad">
            ${allNews.filter(n => n.relevance === 'high').slice(0, 3).map(n => `
              <div class="news-card" style="border-left:3px solid var(--amber);">
                <div class="news-time">${n.time}</div>
                <div class="news-content">
                  <div class="news-headline" style="font-size:var(--text-md)">${n.headline}</div>
                  <div style="display:flex;gap:8px;margin-top:4px;align-items:center;">
                    <span class="news-source">${n.source}</span>
                    <span class="news-category ${n.breaking ? 'breaking' : ''}">${n.breaking ? 'BREAKING' : n.category}</span>
                    <span class="signal-badge warning" style="font-size:9px;">HIGH RELEVANCE</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- All News -->
        <div class="widget">
          <div class="widget-header">
            <span class="widget-title">${icon('list', 14)} All News</span>
            <span class="text-xs text-muted">${allNews.length} articles</span>
          </div>
          <div class="widget-body no-pad">
            ${allNews.map(n => `
              <div class="news-card">
                <div class="news-time">${n.time}</div>
                <div class="news-content">
                  <div class="news-headline">${n.headline}</div>
                  <div style="display:flex;gap:8px;margin-top:4px;align-items:center;">
                    <span class="news-source">${n.source}</span>
                    <span class="news-category ${n.breaking ? 'breaking' : ''}">${n.breaking ? 'BREAKING' : n.category}</span>
                    <span style="font-size:10px;color:var(--text-muted)">${n.asset}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Right: Timeline -->
      <div>
        <div class="widget">
          <div class="widget-header">
            <span class="widget-title">${icon('timeline', 14)} Research Timeline</span>
          </div>
          <div class="widget-body">
            ${[
              { type: 'earnings', event: 'Q3 Earnings Beat', date: 'Sep 25, 2026', impact: 'Price +3.2%' },
              { type: 'analyst', event: 'Analyst Upgrade', date: 'Sep 22, 2026', impact: 'Target raised $280' },
              { type: 'product', event: 'Product Launch', date: 'Sep 15, 2026', impact: 'Revenue +12%' },
              { type: 'regulatory', event: 'Regulatory Approval', date: 'Sep 8, 2026', impact: 'New market access' },
              { type: 'macro', event: 'Fed Rate Hold', date: 'Sep 1, 2026', impact: 'Sector rally' },
              { type: 'earnings', event: 'Q2 Results', date: 'Jul 28, 2026', impact: 'EPS beat +8%' },
              { type: 'product', event: 'Partnership Announced', date: 'Jul 12, 2026', impact: 'Volume spike' },
            ].map((evt, i) => `
              <div style="display:flex;gap:12px;padding:8px 0;${i < 6 ? 'border-bottom:1px solid var(--border-subtle);' : ''}">
                <div style="display:flex;flex-direction:column;align-items:center;min-width:20px;">
                  <div style="width:8px;height:8px;border-radius:50%;background:var(--${evt.type === 'earnings' ? 'green' : evt.type === 'analyst' ? 'blue' : evt.type === 'macro' ? 'amber' : 'text-muted'});margin-top:4px;"></div>
                  ${i < 6 ? '<div style="width:1px;flex:1;background:var(--border-default);margin-top:4px;"></div>' : ''}
                </div>
                <div style="flex:1;">
                  <div style="font-size:var(--text-sm);font-weight:500;color:var(--text-primary)">${evt.event}</div>
                  <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:2px">${evt.date}</div>
                  <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:2px">${evt.impact}</div>
                </div>
                <span class="news-category">${evt.type}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}
