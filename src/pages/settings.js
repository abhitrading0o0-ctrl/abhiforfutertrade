// ============================================================
// ForFuture — Settings Page
// ============================================================

import { icon } from '../icons.js';

export function renderSettings(state) {
  const settingSections = [
    {
      title: 'General',
      settings: [
        { label: 'Dark Mode', desc: 'Use dark theme for the interface', type: 'toggle', active: true },
        { label: 'Compact Mode', desc: 'Reduce spacing for more information density', type: 'toggle', active: false },
        { label: 'Auto-refresh Data', desc: 'Automatically refresh market data every 5 seconds', type: 'toggle', active: true },
        { label: 'Sound Notifications', desc: 'Play sounds for price alerts and important events', type: 'toggle', active: false },
      ],
    },
    {
      title: 'Chart Settings',
      settings: [
        { label: 'Default Chart Type', desc: 'Default chart visualization', type: 'select', options: ['Candlestick', 'Line', 'Area'] },
        { label: 'Default Timeframe', desc: 'Default timeframe for new charts', type: 'select', options: ['1m', '5m', '15m', '1H', '4H', '1D'] },
        { label: 'Show Volume', desc: 'Display volume bars on charts by default', type: 'toggle', active: true },
        { label: 'Show Crosshair', desc: 'Display crosshair cursor on charts', type: 'toggle', active: true },
        { label: 'Auto-scale', desc: 'Automatically adjust price scale', type: 'toggle', active: true },
      ],
    },
    {
      title: 'Analysis Settings',
      settings: [
        { label: 'Adaptive Parameters', desc: 'Allow the engine to adjust indicator parameters based on asset characteristics', type: 'toggle', active: true },
        { label: 'Default Parameter Set', desc: 'Baseline parameter configuration', type: 'select', options: ['Default', 'Aggressive', 'Conservative', 'Custom'] },
        { label: 'Show Confidence Scores', desc: 'Display confidence/quality scores alongside signals', type: 'toggle', active: true },
        { label: 'Include Order Flow', desc: 'Include order flow analysis when data is available', type: 'toggle', active: true },
      ],
    },
    {
      title: 'AI Research',
      settings: [
        { label: 'AI Auto-analysis', desc: 'Automatically generate AI analysis when switching assets', type: 'toggle', active: true },
        { label: 'AI Model', desc: 'Select AI model for research analysis', type: 'select', options: ['Standard', 'Advanced', 'Custom'] },
        { label: 'Show Sources', desc: 'Always display data sources in AI analysis', type: 'toggle', active: true },
      ],
    },
    {
      title: 'Data & Privacy',
      settings: [
        { label: 'Data Provider', desc: 'Primary market data source', type: 'select', options: ['Default (Simulated)', 'Custom API'] },
        { label: 'Cache Duration', desc: 'How long to cache market data locally', type: 'select', options: ['30 seconds', '1 minute', '5 minutes', 'No cache'] },
        { label: 'Analytics', desc: 'Share anonymous usage analytics to improve the platform', type: 'toggle', active: false },
      ],
    },
    {
      title: 'Workspace',
      settings: [
        { label: 'Default Layout', desc: 'Default workspace layout on startup', type: 'select', options: ['Research', 'Technical', 'Chart', 'Overview'] },
        { label: 'Remember Last Asset', desc: 'Restore last viewed asset on startup', type: 'toggle', active: true },
        { label: 'Sidebar Collapsed', desc: 'Start with sidebar in collapsed mode', type: 'toggle', active: false },
      ],
    },
  ];

  return `
    <div class="page-title">
      ${icon('settings', 22)} Settings
      <span class="page-subtitle">Configure your research terminal</span>
    </div>

    <div style="max-width:720px;">
      ${settingSections.map(section => `
        <div class="settings-section">
          <div class="settings-title">${section.title}</div>
          ${section.settings.map(s => `
            <div class="settings-row">
              <div>
                <div class="settings-row-label">${s.label}</div>
                <div class="settings-row-desc">${s.desc}</div>
              </div>
              ${s.type === 'toggle' ? `
                <div class="toggle-switch ${s.active ? 'active' : ''}" onclick="this.classList.toggle('active')"></div>
              ` : `
                <select class="control-select">
                  ${s.options.map(o => `<option>${o}</option>`).join('')}
                </select>
              `}
            </div>
          `).join('')}
        </div>
      `).join('')}

      <!-- Keyboard Shortcuts -->
      <div class="settings-section">
        <div class="settings-title">Keyboard Shortcuts</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:var(--text-sm);">
          ${[
            ['⌘/Ctrl + K', 'Open search'],
            ['1–9', 'Navigate sections'],
            ['Escape', 'Close search/dropdown'],
            ['↑/↓', 'Navigate search results'],
            ['Enter', 'Select search result'],
          ].map(([key, desc]) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
              <span class="text-secondary">${desc}</span>
              <span class="search-kbd">${key}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- About -->
      <div class="settings-section">
        <div class="settings-title">About</div>
        <div style="font-size:var(--text-sm);color:var(--text-secondary);line-height:var(--leading-relaxed);">
          <p><strong style="color:var(--text-primary)">ForFuture</strong> — Professional Financial Research Terminal</p>
          <p style="margin-top:8px;">Version 0.1.0 (Development Preview)</p>
          <p style="margin-top:4px;font-size:var(--text-xs);color:var(--text-muted);">
            This is a development preview. Market data shown is simulated. 
            Do not use for actual trading decisions. All analysis is for educational and research purposes only.
          </p>
        </div>
      </div>
    </div>
  `;
}
