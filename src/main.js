// ============================================================
// ForFuture — Main Application Entry Point
// Professional Financial Research Terminal
// ============================================================

import './styles.css';
import { icon } from './icons.js';
import { ASSET_DATABASE, getAssetData } from './data.js';
import { renderOverview } from './pages/overview.js';
import { renderResearch, setupResearchPage } from './pages/research.js';
import { renderChart } from './pages/chart.js';
import { renderTechnical } from './pages/technical.js';
import { renderStrategy } from './pages/strategy.js';
import { renderMarkets, setupMarketsControls } from './pages/markets.js';
import { renderNews } from './pages/news.js';
import { renderFundamentals } from './pages/fundamentals.js';
import { renderStatistics } from './pages/statistics.js';
import { renderAIResearch } from './pages/airesearch.js';
import { renderBacktesting } from './pages/backtesting.js';
import { renderWatchlist } from './pages/watchlist.js';
import { renderSettings } from './pages/settings.js';
import { initCharts } from './chartEngine.js';
import { renderNextCandle, initNextCandlePage } from './pages/nextcandle.js';
import { marketDataClient } from './marketDataClient.js';

// Connect market data client on load (server may not be running, but try)
try { marketDataClient.connect('ws://localhost:3001'); } catch(e) {}

// ---- Application State ----
export const state = {
  currentPage: 'overview',
  currentAsset: 'AAPL',
  assetData: null,
  sidebarCollapsed: false,
  timeframe: '1D',
  watchlist: ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'BTC/USD', 'ETH/USD', 'SPY', 'EUR/USD', 'XAU/USD'],
};

// Update asset data
export function refreshAssetData() {
  state.assetData = getAssetData(state.currentAsset);
}

// Set the active asset globally
export function setAsset(ticker) {
  state.currentAsset = ticker;
  refreshAssetData();
  renderPage();
  // Update header
  renderAssetMini();
}

// Navigate to a page
export function navigate(page) {
  state.currentPage = page;
  renderPage();
  updateActiveNav();
}
window.navigate = navigate;
window.setAsset = setAsset;
window.__navigate = navigate;
window.__setAsset = setAsset;

// ---- Navigation Items ----
const navItems = [
  { id: 'overview', label: 'Overview', icon: 'overview', section: 'MAIN' },
  { id: 'research', label: 'Research', icon: 'research', section: 'MAIN' },
  { id: 'markets', label: 'Markets', icon: 'markets', section: 'MAIN' },
  { id: 'chart', label: 'Chart', icon: 'chart', section: 'ANALYSIS' },
  { id: 'technical', label: 'Technical Analysis', icon: 'technical', section: 'ANALYSIS' },
  { id: 'strategy', label: 'Strategy Analysis', icon: 'strategy', section: 'ANALYSIS' },
  { id: 'nextcandle', label: 'Next Candle', icon: 'zap', section: 'ANALYSIS' },
  { id: 'news', label: 'News & Events', icon: 'news', section: 'RESEARCH' },
  { id: 'fundamentals', label: 'Fundamentals', icon: 'fundamentals', section: 'RESEARCH' },
  { id: 'statistics', label: 'Statistics', icon: 'statistics', section: 'RESEARCH' },
  { id: 'airesearch', label: 'AI Research', icon: 'aiResearch', section: 'RESEARCH' },
  { id: 'backtesting', label: 'Backtesting', icon: 'backtesting', section: 'TOOLS' },
  { id: 'watchlist', label: 'Watchlists', icon: 'watchlist', section: 'TOOLS' },
  { id: 'settings', label: 'Settings', icon: 'settings', section: 'SYSTEM' },
];

// ---- Build Application Shell ----
function buildApp() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-layout">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand" id="sidebarBrand">
          <div class="sidebar-brand-icon">
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="6" fill="#151720"/>
              <path d="M6 22 L10 14 L14 18 L20 8 L26 12" stroke="url(#bgrad)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="26" cy="12" r="2" fill="#3b82f6"/>
              <defs><linearGradient id="bgrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#3b82f6"/><stop offset="100%" style="stop-color:#60a5fa"/></linearGradient></defs>
            </svg>
          </div>
          <span class="sidebar-brand-name">ForFuture</span>
        </div>
        <nav class="sidebar-nav" id="sidebarNav"></nav>
        <div class="sidebar-toggle" id="sidebarToggle">
          <span id="sidebarToggleIcon">${icon('chevronLeft', 16)}</span>
        </div>
      </aside>
      <div class="app-main">
        <header class="app-header" id="appHeader">
          <div class="search-container" id="searchContainer">
            <div class="search-input-wrap">
              ${icon('search', 14)}
              <input type="text" class="search-input" id="searchInput" placeholder="Search stocks, crypto, forex, indices, ETFs, commodities..." autocomplete="off" />
              <span class="search-kbd">⌘K</span>
            </div>
            <div class="search-dropdown" id="searchDropdown"></div>
          </div>
          <div class="header-right" id="headerRight">
            <div class="provider-status-badge" id="appProviderBadge" title="Active Market Data Provider (Priority: OANDA -> FXCM -> Twelve Data -> FOREX.com)">
              <span class="provider-status-dot" id="appProviderDot"></span>
              <span id="appProviderText">OANDA</span>
              <span class="provider-backup-tag" id="appProviderBackupTag" style="display:none;">BACKUP</span>
            </div>
            <div class="market-status-badge" id="marketStatus">
              <span class="market-status-dot"></span>
              <span>Markets Open</span>
            </div>
            <button class="header-btn" title="Notifications">${icon('bell', 16)}</button>
            <button class="header-btn" title="Keyboard shortcuts">${icon('keyboard', 16)}</button>
          </div>
        </header>
        <main class="app-content" id="appContent"></main>
      </div>
      <div class="failover-toast-container" id="failoverToastContainer"></div>
    </div>
  `;

  buildNavigation();
  setupSearch();
  setupSidebar();
  setupKeyboard();
  setupProviderListeners();

  refreshAssetData();
  renderPage();
}

// ---- Build Navigation ----
function buildNavigation() {
  const nav = document.getElementById('sidebarNav');
  let currentSection = '';
  let html = '';

  navItems.forEach(item => {
    if (item.section !== currentSection) {
      currentSection = item.section;
      html += `<div class="sidebar-section-title">${currentSection}</div>`;
    }
    html += `
      <div class="sidebar-nav-item ${state.currentPage === item.id ? 'active' : ''}" data-page="${item.id}">
        <span class="sidebar-nav-icon">${icon(item.icon, 18)}</span>
        <span class="sidebar-nav-label">${item.label}</span>
      </div>
    `;
  });

  nav.innerHTML = html;

  // Event delegation
  nav.addEventListener('click', (e) => {
    const item = e.target.closest('.sidebar-nav-item');
    if (item) {
      const page = item.dataset.page;
      navigate(page);
    }
  });
}

function updateActiveNav() {
  document.querySelectorAll('.sidebar-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === state.currentPage);
  });
}

// ---- Sidebar Toggle ----
function setupSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');

  toggle.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
    document.getElementById('sidebarToggleIcon').innerHTML =
      icon(state.sidebarCollapsed ? 'chevronRight' : 'chevronLeft', 16);
  });
}

// ---- Search ----
function setupSearch() {
  const input = document.getElementById('searchInput');
  const dropdown = document.getElementById('searchDropdown');
  let highlightIndex = -1;

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    if (query.length < 1) {
      dropdown.classList.remove('open');
      return;
    }

    const results = ASSET_DATABASE.filter(a =>
      a.ticker.toLowerCase().includes(query) ||
      a.name.toLowerCase().includes(query) ||
      a.type.toLowerCase().includes(query)
    ).slice(0, 12);

    if (results.length === 0) {
      dropdown.innerHTML = '<div class="empty-state" style="padding:16px;"><span class="text-sm text-muted">No assets found</span></div>';
    } else {
      dropdown.innerHTML = results.map((r, i) => `
        <div class="search-result-item ${i === highlightIndex ? 'highlighted' : ''}" data-ticker="${r.ticker}">
          <span class="search-result-ticker">${r.ticker}</span>
          <span class="search-result-name">${r.name}</span>
          <span class="search-result-type">${r.type}</span>
          <span class="search-result-exchange">${r.exchange}</span>
        </div>
      `).join('');
    }

    dropdown.classList.add('open');
    highlightIndex = -1;
  });

  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.search-result-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightIndex = Math.min(highlightIndex + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightIndex = Math.max(highlightIndex - 1, 0);
      items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightIndex));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && items[highlightIndex]) {
        const ticker = items[highlightIndex].dataset.ticker;
        setAsset(ticker);
        input.value = '';
        dropdown.classList.remove('open');
        input.blur();
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('open');
      input.blur();
    }
  });

  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.search-result-item');
    if (item) {
      setAsset(item.dataset.ticker);
      input.value = '';
      dropdown.classList.remove('open');
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#searchContainer')) {
      dropdown.classList.remove('open');
    }
  });
}

// ---- Keyboard Shortcuts ----
function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl+K → focus search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
    // 1-9 for nav (when not in input)
    if (!e.target.closest('input, textarea, select')) {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9 && navItems[num - 1]) {
        navigate(navItems[num - 1].id);
      }
    }
  });
}

// ---- Mini asset display in header ----
function renderAssetMini() {
  const d = state.assetData;
  if (!d) return;

  const existing = document.getElementById('headerAssetMini');
  if (existing) existing.remove();

  const isPos = d.change >= 0;
  const el = document.createElement('div');
  el.id = 'headerAssetMini';
  el.style.cssText = 'display:flex;align-items:center;gap:8px;margin-right:8px;cursor:pointer;';
  el.innerHTML = `
    <span style="font-family:var(--font-mono);font-size:var(--text-sm);font-weight:600;color:var(--text-primary)">${d.ticker}</span>
    <span style="font-family:var(--font-mono);font-size:var(--text-sm);font-weight:600">${formatPrice(d.price)}</span>
    <span class="asset-change ${isPos ? 'positive' : 'negative'}" style="font-size:var(--text-xs)">
      ${isPos ? '+' : ''}${d.change.toFixed(2)} (${isPos ? '+' : ''}${d.changePct.toFixed(2)}%)
    </span>
  `;
  el.addEventListener('click', () => navigate('research'));

  const headerRight = document.getElementById('headerRight');
  headerRight.parentElement.insertBefore(el, headerRight);
}

// ---- Render Current Page ----
function renderPage() {
  const content = document.getElementById('appContent');
  content.scrollTop = 0;

  const renderers = {
    overview: renderOverview,
    research: renderResearch,
    markets: renderMarkets,
    chart: renderChart,
    technical: renderTechnical,
    strategy: renderStrategy,
    nextcandle: renderNextCandle,
    news: renderNews,
    fundamentals: renderFundamentals,
    statistics: renderStatistics,
    airesearch: renderAIResearch,
    backtesting: renderBacktesting,
    watchlist: renderWatchlist,
    settings: renderSettings,
  };

  const render = renderers[state.currentPage];
  if (render) {
    // Next Candle page manages its own full-height layout
    if (state.currentPage === 'nextcandle') {
      content.innerHTML = render(state);
      initNextCandlePage();
    } else {
      content.innerHTML = '<div class="page-enter">' + render(state) + '</div>';
      initPageScripts(state.currentPage);
    }
  }
}

function initPageScripts(page) {
  // Initialize lightweight-charts if any chart containers exist on the page
  if (document.querySelector('[data-chart]')) {
    initCharts(state);
  }

  // Initialize Research page controls & real-time telemetry
  if (page === 'research') {
    setupResearchPage(state);
  }

  // Initialize Markets page controls (Heatmap / Table / Performance views, Period & Sort)
  if (page === 'markets') {
    setupMarketsControls();
  }
}

// Make marketDataClient accessible globally for debugging
window._mdc = marketDataClient;

// ---- Utility: Format Price ----
export function formatPrice(price) {
  if (price >= 10000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
}

export function formatVolume(vol) {
  if (vol >= 1e9) return (vol / 1e9).toFixed(1) + 'B';
  if (vol >= 1e6) return (vol / 1e6).toFixed(1) + 'M';
  if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K';
  return vol.toString();
}

export function signalClass(signal) {
  if (!signal) return 'neutral';
  const s = signal.toUpperCase();
  if (s === 'BULLISH' || s === 'BUY') return 'bullish';
  if (s === 'BEARISH' || s === 'SELL') return 'bearish';
  return 'neutral';
}

// ---- Asset Header Component ----
export function renderAssetHeader(data) {
  if (!data) return '';
  const isPos = data.change >= 0;
  const isWatchlisted = state.watchlist.includes(data.ticker);

  return `
    <div class="asset-header">
      <div class="asset-identity">
        <div class="asset-logo">${data.logo}</div>
        <div class="asset-name-group">
          <div class="asset-name">${data.name}</div>
          <div class="asset-meta">
            <span class="asset-ticker">${data.ticker}</span>
            <span class="asset-type-badge">${data.type}</span>
            <span>${data.exchange}</span>
          </div>
        </div>
      </div>
      <div class="asset-divider"></div>
      <div class="asset-price-group">
        <span class="asset-price">${formatPrice(data.price)}</span>
        <span class="asset-change ${isPos ? 'positive' : 'negative'}">
          ${isPos ? '▲' : '▼'} ${isPos ? '+' : ''}${data.change.toFixed(2)} (${isPos ? '+' : ''}${data.changePct.toFixed(2)}%)
        </span>
      </div>
      <div class="asset-divider"></div>
      <div style="display:flex;flex-direction:column;gap:2px;">
        <div class="market-status-badge">
          <span class="market-status-dot ${data.marketStatus === 'CLOSED' ? 'closed' : ''}"></span>
          <span>${data.marketStatus}</span>
        </div>
        <div class="asset-update-info">Updated ${Math.floor((Date.now() - data.lastUpdate) / 1000)}s ago</div>
      </div>
      <div class="asset-header-actions">
        <button class="asset-header-btn ${isWatchlisted ? 'watchlisted' : ''}" id="watchlistBtn">
          ${icon(isWatchlisted ? 'starFilled' : 'star', 14)}
          ${isWatchlisted ? 'Watching' : 'Watch'}
        </button>
        <button class="asset-header-btn">
          ${icon('bell', 14)} Alert
        </button>
        <button class="asset-header-btn">
          ${icon('download', 14)} Export
        </button>
      </div>
    </div>
  `;
}

// ---- Provider & Failover Monitoring ----
function setupProviderListeners() {
  const badgeEl = document.getElementById('appProviderBadge');
  if (badgeEl) {
    badgeEl.addEventListener('click', () => {
      navigate('nextcandle');
      setTimeout(() => {
        const diagBtn = document.getElementById('ncBtnDiag');
        if (diagBtn) diagBtn.click();
      }, 150);
    });
  }

  marketDataClient.on('providerSwitch', (data) => {
    updateAppProviderBadge(data.to, data.isBackup);
    showFailoverToast(data);
  });

  marketDataClient.on('providerStatus', (data) => {
    updateAppProviderBadge(data.activeProvider, data.isBackup);
  });

  marketDataClient.on('connected', (data) => {
    if (data.activeProvider) updateAppProviderBadge(data.activeProvider, data.isBackup);
  });
}

export function updateAppProviderBadge(providerName, isBackup) {
  const textEl = document.getElementById('appProviderText');
  const badgeEl = document.getElementById('appProviderBadge');
  const backupEl = document.getElementById('appProviderBackupTag');
  if (textEl && providerName) textEl.textContent = providerName;
  if (badgeEl) badgeEl.classList.toggle('is-backup', Boolean(isBackup));
  if (backupEl) backupEl.style.display = isBackup ? 'inline-block' : 'none';
}

export function showFailoverToast(data) {
  const container = document.getElementById('failoverToastContainer');
  if (!container) return;

  const isFailback = Boolean(data.isFailback);
  const toast = document.createElement('div');
  toast.className = `failover-toast ${isFailback ? 'failback' : ''}`;

  const iconText = isFailback ? '🔄' : '⚠️';
  const titleText = isFailback
    ? `Failback: Resumed ${data.to} [PRIMARY]`
    : `Failover: Switched to ${data.to} [BACKUP]`;
  const reasonText = data.reason || (isFailback ? 'Higher-priority provider recovered' : 'Market data failover triggered');

  toast.innerHTML = `
    <div class="failover-toast-icon">${iconText}</div>
    <div class="failover-toast-content">
      <div class="failover-toast-title">
        <span>${titleText}</span>
      </div>
      <div class="failover-toast-msg">${reasonText}. Resynchronizing candles...</div>
    </div>
    <button class="failover-toast-close" title="Dismiss">✕</button>
  `;

  toast.querySelector('.failover-toast-close').addEventListener('click', () => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  });

  container.appendChild(toast);

  // Auto-dismiss after 4.5 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4500);
}

// ---- Boot ----
buildApp();

// Auto-refresh price data every 5 seconds
setInterval(() => {
  refreshAssetData();
  renderAssetMini();
}, 5000);
