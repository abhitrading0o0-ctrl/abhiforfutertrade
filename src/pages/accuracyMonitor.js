// ============================================================
// ForFuture — Parallel Prediction Accuracy Monitor Page
// Real-time Multi-Timeframe Background Accuracy Leaderboard
// Completely independent subsystem — ZERO interference with Next Candle
// ============================================================

import { icon } from '../icons.js';
import { predictionMonitorClient } from '../services/predictionMonitorClient.js';
import { SUPPORTED_TIMEFRAMES, SUPPORTED_ASSETS, WORKER_STATUSES } from '../accuracyMonitor/registry.js';
import { formatTradingTime } from '../nextCandleClient.js';

let activeClientUnsub = [];
let selectedDetailRow = null;

export function renderAccuracyMonitor() {
  const client = predictionMonitorClient;
  const health = client.state.health || {};
  const settings = client.state.settings || {};
  const workerStatus = health.workerStatus || WORKER_STATUSES.STARTING;
  const isHealthy = workerStatus === WORKER_STATUSES.HEALTHY || workerStatus === 'LIVE';

  return `
    <div class="accuracy-monitor-page">
      <!-- HEADER & TOP METRICS PANEL -->
      <div class="am-header">
        <div class="am-header-left">
          <div class="am-title-row">
            <h1 class="am-title">
              <span class="am-title-icon">${icon('layers', 24)}</span>
              Parallel Prediction Accuracy Monitor
            </h1>
            <span class="am-status-badge ${isHealthy ? 'live' : 'paused'}" id="amWorkerStatusBadge">
              <span class="am-status-dot ${isHealthy ? 'pulse' : ''}"></span>
              <span id="amWorkerStatusText">${isHealthy ? 'LIVE BACKGROUND WORKER' : workerStatus}</span>
            </span>
          </div>
          <p class="am-subtitle">
            Continuous parallel evaluation of next-candle UP/DOWN directional accuracy across all supported timeframes.
            Evaluates official snapshots before candle close with zero UI dependencies.
          </p>
        </div>

        <div class="am-header-actions">
          <button class="am-btn ${settings.status === 'RUNNING' ? 'am-btn-pause' : 'am-btn-play'}" id="amToggleBtn">
            ${settings.status === 'RUNNING' ? icon('close', 14) : icon('zap', 14)}
            <span>${settings.status === 'RUNNING' ? 'Pause Monitor' : 'Resume Monitor'}</span>
          </button>
          <button class="am-btn am-btn-secondary" id="amDiagnosticsBtn" title="Run 13-Stage Pipeline Diagnostics Dry-Run">
            ${icon('activity', 14)}
            <span>Run Diagnostics</span>
          </button>
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="am-btn am-btn-secondary" id="amRefreshBtn" title="Force Refresh Leaderboard">
              ${icon('refresh', 14)}
              <span>Refresh</span>
            </button>
            <span id="amLastRefreshText" style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);"></span>
          </div>
        </div>
      </div>

      <!-- TELEMETRY & HEALTH CARDS -->
      <div class="am-telemetry-grid">
        <div class="am-telemetry-card">
          <div class="am-tc-header">
            <span class="am-tc-label">Total Predictions</span>
            <span class="am-tc-icon">${icon('timeline', 16)}</span>
          </div>
          <div class="am-tc-value" id="amTotalPreds">${health.totalPredictions || 0}</div>
          <div class="am-tc-sub">Immutable snapshots created</div>
        </div>

        <div class="am-telemetry-card">
          <div class="am-tc-header">
            <span class="am-tc-label">Resolved Outcomes</span>
            <span class="am-tc-icon text-success">${icon('trendUp', 16)}</span>
          </div>
          <div class="am-tc-value text-success" id="amTotalResolved">${health.totalResolved || 0}</div>
          <div class="am-tc-sub">Completed target candle evaluations</div>
        </div>

        <div class="am-telemetry-card">
          <div class="am-tc-header">
            <span class="am-tc-label">Pending Evaluation</span>
            <span class="am-tc-icon text-warning">${icon('candlestick', 16)}</span>
          </div>
          <div class="am-tc-value text-warning" id="amPendingCount">${health.pendingEvaluations || 0}</div>
          <div class="am-tc-sub">Awaiting target candle closure</div>
        </div>

        <div class="am-telemetry-card">
          <div class="am-tc-header">
            <span class="am-tc-label">Monitored Matrix</span>
            <span class="am-tc-icon">${icon('grid', 16)}</span>
          </div>
          <div class="am-tc-value">
            <span id="amActiveAssetsCount">${(settings.enabledAssets || []).length}</span> Assets
            <span id="amActiveTfsCount" style="font-size:0.65em;color:var(--text-muted);font-weight:normal;">× ${(settings.enabledTimeframes || []).length} TFs</span>
          </div>
          <div class="am-tc-sub" id="amTotalContextsSub">${((settings.enabledAssets || []).length) * ((settings.enabledTimeframes || []).length)} active parallel contexts</div>
        </div>
      </div>

      <!-- CONTROLS & FILTER TOOLBAR -->
      <div class="am-toolbar">
        <!-- Asset Selector & Monitoring Toggle -->
        <div class="am-control-group">
          <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:4px;">
            <span class="am-control-label">Monitored Asset Filter:</span>
            <div id="amAssetMonitoringBadgeWrap" style="font-size:0.75rem;">
              <span id="amAssetMonitoredBadge" class="am-badge ${settings.enabledAssets?.includes(client.state.selectedSymbol) ? 'live' : 'disabled'}" style="font-size:0.7rem;padding:2px 6px;">
                ${settings.enabledAssets?.includes(client.state.selectedSymbol) ? 'WORKER MONITORING ACTIVE' : 'WORKER MONITORING OFF'}
              </span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div class="am-asset-pills" id="amAssetPills">
              ${SUPPORTED_ASSETS.slice(0, 6).map(a => `
                <button class="am-asset-pill ${client.state.selectedSymbol === a.symbol ? 'active' : ''}" data-symbol="${a.symbol}">
                  ${a.symbol}
                </button>
              `).join('')}
            </div>
            <button class="am-btn am-btn-xs" id="amToggleAssetMonitorBtn" style="font-size:0.75rem;padding:4px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);" title="Toggle background worker monitoring for this asset">
              ${icon('activity', 12)} <span id="amToggleAssetMonitorText">${settings.enabledAssets?.includes(client.state.selectedSymbol) ? 'Disable in Worker' : 'Enable in Worker'}</span>
            </button>
          </div>
        </div>

        <!-- Evaluation Window Filter -->
        <div class="am-control-group">
          <span class="am-control-label">Evaluation Window:</span>
          <div class="am-select-wrap">
            <select class="am-select" id="amWindowSelect">
              <option value="ALL" ${client.state.evaluationWindow === 'ALL' ? 'selected' : ''}>All Monitored History</option>
              <option value="24H" ${client.state.evaluationWindow === '24H' ? 'selected' : ''}>Last 24 Hours</option>
              <option value="7D" ${client.state.evaluationWindow === '7D' ? 'selected' : ''}>Last 7 Days</option>
              <option value="30D" ${client.state.evaluationWindow === '30D' ? 'selected' : ''}>Last 30 Days</option>
              <option value="LAST_50" ${client.state.evaluationWindow === 'LAST_50' ? 'selected' : ''}>Last 50 Scored (N=50)</option>
              <option value="LAST_100" ${client.state.evaluationWindow === 'LAST_100' ? 'selected' : ''}>Last 100 Scored (N=100)</option>
            </select>
          </div>
        </div>

        <!-- Ranking Criterion -->
        <div class="am-control-group">
          <span class="am-control-label">Rank Leaderboard By:</span>
          <div class="am-select-wrap">
            <select class="am-select" id="amRankingSelect">
              <option value="accuracy" ${client.state.rankingMethod === 'accuracy' ? 'selected' : ''}>Directional Accuracy (%)</option>
              <option value="recentAccuracy" ${client.state.rankingMethod === 'recentAccuracy' ? 'selected' : ''}>Recent 24h Accuracy (%)</option>
              <option value="balancedAccuracy" ${client.state.rankingMethod === 'balancedAccuracy' ? 'selected' : ''}>Balanced Accuracy (Recall avg)</option>
              <option value="brierScore" ${client.state.rankingMethod === 'brierScore' ? 'selected' : ''}>Brier Score (Prob calibration - lower is better)</option>
              <option value="sampleCount" ${client.state.rankingMethod === 'sampleCount' ? 'selected' : ''}>Evaluated Sample Count (N)</option>
              <option value="timeframe" ${client.state.rankingMethod === 'timeframe' ? 'selected' : ''}>Timeframe Duration (M1 - M30)</option>
            </select>
          </div>
        </div>

        <!-- Min Sample Threshold -->
        <div class="am-control-group">
          <span class="am-control-label" title="Sample sizes below this are marked PROVISIONAL to prevent small-sample bias">Min Sample Threshold:</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="number" id="amMinSampleInput" class="am-number-input" min="1" max="500" value="${client.state.minSampleThreshold || 30}" style="width:64px;padding:3px 6px;border-radius:4px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:var(--text-primary);font-family:var(--font-mono);font-size:0.8rem;text-align:center;" />
            <span style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);">N</span>
          </div>
        </div>
      </div>

      <!-- MAIN LEADERBOARD TABLE CARD -->
      <div class="am-table-card">
        <div class="am-table-header-bar">
          <div class="am-th-title">
            <span>Accuracy Leaderboard — ${client.state.selectedSymbol}</span>
            <span class="am-th-tag">Model Version: v4.0.0</span>
          </div>
          <div class="am-th-legend">
            <span class="am-legend-item"><span class="am-dot win"></span> Correct (Win)</span>
            <span class="am-legend-item"><span class="am-dot loss"></span> Incorrect (Loss)</span>
            <span class="am-legend-item"><span class="am-dot flat"></span> Flat / Doji (Unscorable)</span>
            <span class="am-legend-item"><span class="am-dot prov"></span> Provisional (&lt;30)</span>
          </div>
        </div>

        <div class="am-table-responsive">
          <table class="am-table" id="amLeaderboardTable">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Timeframe</th>
                <th>Live Prediction</th>
                <th>Prediction Cutoff</th>
                <th>Target Candle</th>
                <th>Latest Resolved</th>
                <th>Outcome</th>
                <th>Score (W / L)</th>
                <th>Samples</th>
                <th>Accuracy</th>
                <th>Recent (24h)</th>
                <th>95% Conf. Interval</th>
                <th>Baseline Diff</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="amTableBody">
              <tr>
                <td colspan="15" class="am-loading-cell">
                  <div class="am-spinner"></div>
                  <span>Loading background prediction data...</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- STATISTICAL DEEP-DIVE MODAL / DRAWER -->
      <div class="am-modal-overlay" id="amModalOverlay" style="display:none;">
        <div class="am-modal-dialog" id="amModalDialog">
          <div class="am-modal-header">
            <div class="am-mh-left">
              <h2 class="am-mh-title" id="amModalTitle">Timeframe Analysis Deep-Dive</h2>
              <span class="am-mh-sub" id="amModalSubtitle">Detailed Statistical Audit Trail</span>
            </div>
            <button class="am-modal-close" id="amModalCloseBtn">${icon('close', 18)}</button>
          </div>
          <div class="am-modal-body" id="amModalBody"></div>
        </div>
      </div>

      <!-- PIPELINE DIAGNOSTICS MODAL -->
      <div class="am-modal-overlay" id="amDiagModalOverlay" style="display:none;">
        <div class="am-modal-dialog" id="amDiagModalDialog" style="max-width: 720px;">
          <div class="am-modal-header">
            <div class="am-mh-left">
              <h2 class="am-mh-title">System Pipeline Diagnostics</h2>
              <span class="am-mh-sub">Real-Time 10-Stage End-to-End Pipeline Dry-Run</span>
            </div>
            <button class="am-modal-close" id="amDiagModalCloseBtn">${icon('close', 18)}</button>
          </div>
          <div class="am-modal-body" id="amDiagModalBody">
            <div class="am-spinner"></div>
            <span>Running diagnostics...</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initAccuracyMonitor() {
  const client = predictionMonitorClient;

  // Cleanup old listeners
  activeClientUnsub.forEach(unsub => unsub());
  activeClientUnsub = [];

  // Register UI updates
  activeClientUnsub.push(
    client.on('stateChanged', () => updateTelemetryUI()),
    client.on('healthChanged', () => updateTelemetryUI()),
    client.on('leaderboardUpdated', (rows) => renderLeaderboardRows(rows))
  );

  // Initialize client service
  client.init();

  // Bind Buttons & Controls
  setupEventListeners();

  // Initial render if already loaded
  if (client.state.leaderboard.length > 0) {
    renderLeaderboardRows(client.state.leaderboard);
  }
}

function setupEventListeners() {
  const client = predictionMonitorClient;

  // 1. Toggle Monitoring Start/Pause
  const toggleBtn = document.getElementById('amToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      toggleBtn.disabled = true;
      await client.toggleMonitoring();
      toggleBtn.disabled = false;
      updateTelemetryUI();
    });
  }

  // 2. Refresh Button
  const refreshBtn = document.getElementById('amRefreshBtn');
  const refreshText = document.getElementById('amLastRefreshText');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.classList.add('spinning');
      await client.fetchLeaderboard(false);
      const nowStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
      if (refreshText) refreshText.textContent = `Synced: ${nowStr} IST`;
      setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
    });
  }

  // 3. Diagnostics Button
  const diagBtn = document.getElementById('amDiagnosticsBtn');
  if (diagBtn) {
    diagBtn.addEventListener('click', async () => {
      openDiagnosticsModal();
    });
  }

  // 4. Asset Pills & Toggle Monitoring
  const assetPills = document.querySelectorAll('.am-asset-pill');
  assetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      assetPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      client.setSelectedSymbol(pill.dataset.symbol);
      updateTelemetryUI();
    });
  });

  const toggleAssetBtn = document.getElementById('amToggleAssetMonitorBtn');
  if (toggleAssetBtn) {
    toggleAssetBtn.addEventListener('click', async () => {
      toggleAssetBtn.disabled = true;
      await client.toggleAssetMonitoring(client.state.selectedSymbol);
      toggleAssetBtn.disabled = false;
      updateTelemetryUI();
    });
  }

  // 5. Window Select
  const windowSelect = document.getElementById('amWindowSelect');
  if (windowSelect) {
    windowSelect.addEventListener('change', (e) => {
      client.setEvaluationWindow(e.target.value);
    });
  }

  // 6. Ranking Select
  const rankingSelect = document.getElementById('amRankingSelect');
  if (rankingSelect) {
    rankingSelect.addEventListener('change', (e) => {
      client.setRankingMethod(e.target.value);
    });
  }

  // 7. Min Sample Threshold Input
  const minSampleInput = document.getElementById('amMinSampleInput');
  if (minSampleInput) {
    minSampleInput.addEventListener('change', async (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val >= 1 && val <= 500) {
        await client.setMinSampleThreshold(val);
      } else {
        e.target.value = client.state.minSampleThreshold || 30;
      }
    });
  }

  // 8. Detail Modal Close
  const closeBtn = document.getElementById('amModalCloseBtn');
  const overlay = document.getElementById('amModalOverlay');
  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', () => { overlay.style.display = 'none'; });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  }

  // 9. Diagnostics Modal Close
  const diagCloseBtn = document.getElementById('amDiagModalCloseBtn');
  const diagOverlay = document.getElementById('amDiagModalOverlay');
  if (diagCloseBtn && diagOverlay) {
    diagCloseBtn.addEventListener('click', () => { diagOverlay.style.display = 'none'; });
    diagOverlay.addEventListener('click', (e) => {
      if (e.target === diagOverlay) diagOverlay.style.display = 'none';
    });
  }
}

function updateTelemetryUI() {
  const client = predictionMonitorClient;
  const health = client.state.health || {};
  const settings = client.state.settings || {};
  const workerStatus = health.workerStatus || WORKER_STATUSES.STARTING;
  const isHealthy = workerStatus === WORKER_STATUSES.HEALTHY || workerStatus === 'LIVE';

  const badge = document.getElementById('amWorkerStatusBadge');
  const badgeText = document.getElementById('amWorkerStatusText');
  const toggleBtn = document.getElementById('amToggleBtn');

  if (badge && badgeText) {
    if (isHealthy) {
      badge.className = 'am-status-badge live';
      badgeText.textContent = 'LIVE BACKGROUND WORKER';
    } else if (workerStatus === WORKER_STATUSES.STARTING) {
      badge.className = 'am-status-badge starting';
      badgeText.textContent = 'WORKER INITIALIZING';
    } else if (workerStatus === WORKER_STATUSES.DELAYED) {
      badge.className = 'am-status-badge delayed';
      badgeText.textContent = 'WORKER DELAYED';
    } else if (workerStatus === WORKER_STATUSES.ERROR) {
      badge.className = 'am-status-badge error';
      badgeText.textContent = health.lastError ? `WORKER ERROR` : 'WORKER ERROR';
    } else if (workerStatus === WORKER_STATUSES.PAUSED) {
      badge.className = 'am-status-badge paused';
      badgeText.textContent = 'MONITORING PAUSED';
    } else {
      badge.className = 'am-status-badge paused';
      badgeText.textContent = workerStatus;
    }
  }

  if (toggleBtn) {
    const isPaused = settings.status === 'PAUSED';
    toggleBtn.className = `am-btn ${isPaused ? 'am-btn-play' : 'am-btn-pause'}`;
    toggleBtn.innerHTML = `
      ${isPaused ? icon('zap', 14) : icon('close', 14)}
      <span>${isPaused ? 'Resume Monitor' : 'Pause Monitor'}</span>
    `;
  }

  const elPreds = document.getElementById('amTotalPreds');
  if (elPreds) elPreds.textContent = health.totalPredictions || 0;

  const elResolved = document.getElementById('amTotalResolved');
  if (elResolved) elResolved.textContent = health.totalResolved || 0;

  const elPending = document.getElementById('amPendingCount');
  if (elPending) elPending.textContent = health.pendingEvaluations || 0;

  const enabledAssets = settings.enabledAssets || [];
  const enabledTfs = settings.enabledTimeframes || [];
  const elAssets = document.getElementById('amActiveAssetsCount');
  if (elAssets) elAssets.textContent = enabledAssets.length;

  const elMatrixTfs = document.getElementById('amActiveTfsCount');
  if (elMatrixTfs) elMatrixTfs.textContent = `× ${enabledTfs.length} TFs`;

  const elTotalContextsSub = document.getElementById('amTotalContextsSub');
  if (elTotalContextsSub) elTotalContextsSub.textContent = `${enabledAssets.length * enabledTfs.length} active parallel contexts`;

  // Update Asset Monitoring Badge & Toggle Button
  const isSelectedMonitored = enabledAssets.includes(client.state.selectedSymbol);
  const assetBadge = document.getElementById('amAssetMonitoredBadge');
  if (assetBadge) {
    assetBadge.className = `am-badge ${isSelectedMonitored ? 'live' : 'disabled'}`;
    assetBadge.textContent = isSelectedMonitored ? 'WORKER MONITORING ACTIVE' : 'WORKER MONITORING OFF';
  }

  const toggleAssetBtnText = document.getElementById('amToggleAssetMonitorText');
  if (toggleAssetBtnText) {
    toggleAssetBtnText.textContent = isSelectedMonitored ? 'Disable in Worker' : 'Enable in Worker';
  }
}

function renderLeaderboardRows(rows = []) {
  const tbody = document.getElementById('amTableBody');
  if (!tbody) return;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="15" class="am-empty-cell">
          <div class="am-empty-state">
            <span class="am-empty-icon">${icon('layers', 32)}</span>
            <h3>No predictions recorded yet for this asset</h3>
            <p>The background worker evaluates candle closes at every timeframe boundary. Official predictions will automatically appear here.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  rows.forEach((row, idx) => {
    const samples = row.evaluatedSamples || 0;

    // Rank Badge: zero-sample rows must NOT be ranked #1
    let rankBadge = `<span class="am-unranked-badge" title="No samples evaluated yet">—</span>`;
    if (samples >= 10 && !row.isProvisional) {
      rankBadge = idx === 0 ? `<span class="am-rank-badge top">#1</span>` : `<span class="am-rank-badge">#${idx + 1}</span>`;
    } else if (samples > 0) {
      rankBadge = `<span class="am-rank-badge prov">#${idx + 1}</span>`;
    }

    // Latest Prediction Pill
    let predPill = '<span class="text-muted">—</span>';
    if (row.latestPrediction) {
      const dir = row.latestPrediction.direction;
      const prob = row.latestPrediction.probability ? +(row.latestPrediction.probability[dir.toLowerCase()] * 100).toFixed(1) : 50;
      predPill = `
        <span class="am-pred-pill ${dir.toLowerCase()}">
          ${dir === 'UP' ? '▲ UP' : '▼ DOWN'}
          <span class="am-pred-prob">${prob}%</span>
        </span>
      `;
    }

    // Prediction Cutoff Time
    const predTimeStr = row.latestPrediction ? formatTradingTime(row.latestPrediction.predictionTime, true) : '—';

    // Target Candle Info
    const targetCandleStr = row.latestPrediction?.targetStartTime 
      ? formatTradingTime(row.latestPrediction.targetStartTime * 1000) 
      : '—';

    // Check if the displayed latest prediction is still awaiting its target candle close
    const isPending = row.latestPrediction && (
      row.latestPrediction.status === 'AWAITING_TARGET_CLOSE' ||
      !row.latestResolved ||
      row.latestResolved.predictionId !== row.latestPrediction.id
    );

    // Latest Resolved Result
    let resolvedStr = '<span class="text-muted">—</span>';
    if (!isPending && row.latestResolved) {
      const actDir = row.latestResolved.actualDirection;
      resolvedStr = `<span class="am-res-pill ${actDir.toLowerCase()}">${actDir}</span>`;
    } else if (row.latestResolved) {
      const actDir = row.latestResolved.actualDirection;
      resolvedStr = `<span class="am-res-pill ${actDir.toLowerCase()}" style="opacity:0.6;" title="Prior resolved candle outcome: ${actDir}">${actDir} <span class="text-xs" style="font-size:0.65rem;">(Prev)</span></span>`;
    }

    // Outcome Pill (WIN / LOSS / FLAT / PENDING / WAITING FOR FIRST SNAPSHOT)
    let outcomePill = '<span class="am-eval-pill waiting" title="Awaiting candle close to produce first snapshot">WAITING FOR FIRST SNAPSHOT</span>';
    if (isPending) {
      if (row.latestPrediction.isLate) {
        outcomePill = '<span class="am-eval-pill late" title="Decision snapshot was delayed">LATE</span>';
      } else {
        outcomePill = '<span class="am-eval-pill pending" title="Snapshot recorded, awaiting target candle close">PENDING</span>';
      }
    } else if (row.latestResolved) {
      const evalStatus = row.latestResolved.evaluation;
      outcomePill = `<span class="am-eval-pill ${evalStatus.toLowerCase()}">${evalStatus}</span>`;
    }

    // Accuracy Display & Progress
    let accuracyHtml = '<span class="text-muted">— <span class="text-xs" style="opacity:0.6;">Collecting Data</span></span>';
    if (row.accuracy !== null && samples > 0) {
      const accVal = row.accuracy;
      const accColor = accVal >= 55 ? 'var(--color-bullish)' : accVal <= 45 ? 'var(--color-bearish)' : 'var(--text-primary)';
      accuracyHtml = `
        <div class="am-acc-wrap">
          <div class="am-acc-num" style="color:${accColor}">${accVal.toFixed(1)}%</div>
          <div class="am-acc-bar-bg">
            <div class="am-acc-bar-fill" style="width:${Math.min(100, Math.max(0, accVal))}%;background:${accColor}"></div>
          </div>
        </div>
      `;
    }

    // Recent 24h Accuracy
    const recentAccStr = (row.recentAccuracy !== null && samples > 0) ? `${row.recentAccuracy.toFixed(1)}%` : '<span class="text-muted">—</span>';

    // Baseline Diff
    let baselineStr = '<span class="text-muted">—</span>';
    if (row.baselines?.baselineDiff !== null && samples > 0) {
      const diff = row.baselines.baselineDiff;
      const diffColor = diff > 0 ? 'var(--color-bullish)' : diff < 0 ? 'var(--color-bearish)' : 'var(--text-muted)';
      baselineStr = `<span style="color:${diffColor};font-weight:600;">${diff > 0 ? '+' : ''}${diff.toFixed(1)}%</span>`;
    }

    // Confidence Interval
    const ciStr = (row.confidenceInterval?.formatted && samples > 0) ? row.confidenceInterval.formatted : '—';

    // Status Badge
    let statusBadge = `<span class="am-badge live">LIVE</span>`;
    if (row.status === 'COLLECTING DATA') {
      statusBadge = `<span class="am-badge collecting" title="Gathering initial background candle data">COLLECTING DATA</span>`;
    } else if (row.isProvisional) {
      statusBadge = `<span class="am-badge prov" title="Sample count is below the minimum threshold (30) to establish statistical validity">PROVISIONAL</span>`;
    } else if (row.status === 'PAUSED') {
      statusBadge = `<span class="am-badge paused">PAUSED</span>`;
    } else if (row.status === 'DISABLED') {
      statusBadge = `<span class="am-badge disabled">DISABLED</span>`;
    }

    html += `
      <tr class="am-row" data-timeframe="${row.timeframe}" data-symbol="${row.symbol}">
        <td>${rankBadge}</td>
        <td>
          <div class="am-tf-cell">
            <div style="display:flex;align-items:center;gap:4px;">
              <span class="am-tf-tag">${row.timeframe}</span>
              ${row.isDerived ? `<span style="font-size:0.6rem;padding:1px 3px;border-radius:3px;background:rgba(255,255,255,0.08);color:var(--text-muted);" title="Aggregated from 1M constituent candles">M1-Derived</span>` : ''}
            </div>
            <span class="am-tf-sub">${row.timeframeLabel}</span>
          </div>
        </td>
        <td>${predPill}</td>
        <td class="font-mono text-xs">${predTimeStr}</td>
        <td class="font-mono text-xs">${targetCandleStr}</td>
        <td>${resolvedStr}</td>
        <td>${outcomePill}</td>
        <td class="font-mono">
          <span class="text-success font-semibold">${row.wins || 0}</span>
          <span class="text-muted"> / </span>
          <span class="text-danger font-semibold">${row.losses || 0}</span>
        </td>
        <td class="font-mono">${samples}</td>
        <td>${accuracyHtml}</td>
        <td class="font-mono">${recentAccStr}</td>
        <td class="font-mono text-xs text-muted">${ciStr}</td>
        <td class="font-mono text-xs">${baselineStr}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="am-table-btn am-inspect-btn" data-timeframe="${row.timeframe}" title="View Deep-Dive Statistics & Provenance">
            ${icon('eye', 14)}
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  // Bind inspect buttons
  const inspectBtns = tbody.querySelectorAll('.am-inspect-btn');
  inspectBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tf = btn.dataset.timeframe;
      const targetRow = rows.find(r => r.timeframe === tf);
      if (targetRow) openDetailModal(targetRow);
    });
  });

  // Bind row clicks
  const tableRows = tbody.querySelectorAll('.am-row');
  tableRows.forEach(rowEl => {
    rowEl.addEventListener('click', () => {
      const tf = rowEl.dataset.timeframe;
      const targetRow = rows.find(r => r.timeframe === tf);
      if (targetRow) openDetailModal(targetRow);
    });
  });
}

async function openDiagnosticsModal() {
  const overlay = document.getElementById('amDiagModalOverlay');
  const body = document.getElementById('amDiagModalBody');
  if (!overlay || !body) return;

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;padding:24px;gap:12px;">
      <div class="am-spinner"></div>
      <div style="font-weight:600;font-size:0.95rem;">Executing 10-Stage System Pipeline Diagnostics...</div>
      <div style="color:var(--text-muted);font-size:0.8rem;">Testing provider connectivity, OHLC validation, M1 custom aggregation, isolated prediction engine, and storage integrity.</div>
    </div>
  `;
  overlay.style.display = 'flex';

  const report = await predictionMonitorClient.runDiagnostics();

  let stagesHtml = '';
  (report.stages || []).forEach(st => {
    const isPass = st.status === 'PASS';
    const isWarn = st.status === 'WARN';
    const badgeColor = isPass ? 'var(--color-bullish)' : isWarn ? '#f59e0b' : 'var(--color-bearish)';
    const badgeBg = isPass ? 'rgba(34, 197, 94, 0.15)' : isWarn ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)';

    stagesHtml += `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:10px 14px;border-radius:6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);margin-bottom:8px;">
        <div style="display:flex;flex-direction:column;gap:3px;">
          <div style="font-weight:600;font-size:0.85rem;color:var(--text-primary);">
            Stage ${st.stage}: ${st.name}
          </div>
          <div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted);">
            ${JSON.stringify(st.details).replace(/[{}"]/g, ' ').trim()}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);">${st.durationMs}ms</span>
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-weight:700;font-size:0.75rem;font-family:var(--font-mono);background:${badgeBg};color:${badgeColor};border:1px solid ${badgeColor};">
            ${st.status}
          </span>
        </div>
      </div>
    `;
  });

  const overallBadge = report.overallStatus === 'PASS' 
    ? `<span style="padding:4px 10px;border-radius:6px;background:rgba(34, 197, 94, 0.15);color:var(--color-bullish);font-weight:700;">PASSED</span>`
    : `<span style="padding:4px 10px;border-radius:6px;background:rgba(239, 68, 68, 0.15);color:var(--color-bearish);font-weight:700;">FAILED</span>`;

  body.innerHTML = `
    <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);">
      <div>
        <div style="font-size:0.9rem;font-weight:700;">Active Provider: <span class="text-primary">${report.activeProvider}</span></div>
        <div style="font-size:0.75rem;color:var(--text-muted);">Target Context: ${report.symbol} · Zero UI dependencies · Dry-run isolated</div>
      </div>
      <div>${overallBadge}</div>
    </div>
    <div style="max-height: 420px; overflow-y: auto; padding-right: 4px;">
      ${stagesHtml}
    </div>
  `;
}

async function openDetailModal(row) {
  selectedDetailRow = row;
  const overlay = document.getElementById('amModalOverlay');
  const modalTitle = document.getElementById('amModalTitle');
  const modalSub = document.getElementById('amModalSubtitle');
  const modalBody = document.getElementById('amModalBody');

  if (!overlay || !modalBody) return;

  modalTitle.textContent = `${row.symbol} · ${row.timeframe} (${row.timeframeLabel}) Detailed Audit`;
  modalSub.textContent = `Comprehensive Evaluation Metrics, Confusion Matrix, and Provenance Trail`;

  const cm = row.confusionMatrix || { tp: 0, fp: 0, tn: 0, fn: 0 };
  const prob = row.probabilistic || {};
  const base = row.baselines || {};
  const diag = row.diagnostics || {};

  modalBody.innerHTML = `
    <!-- Timeframe Diagnostic Status Banner -->
    <div style="margin-bottom:16px;padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:0.8rem;color:var(--text-muted);">
        Provider: <strong style="color:var(--text-primary);">${diag.provider || 'Twelve Data'}</strong> · 
        Candles: <strong style="color:var(--text-primary);">${diag.candleCount || 0} bars</strong> · 
        Type: <strong style="color:var(--text-primary);">${diag.sourceData || 'Native API'}</strong>
      </div>
      <div style="font-size:0.8rem;color:var(--text-secondary);font-weight:600;">
        ${diag.statusText || 'Normal operation'}
      </div>
    </div>

    <div class="am-modal-grid">
      <!-- 1. Key Metrics Summary -->
      <div class="am-metric-box">
        <div class="am-mb-title">Directional Accuracy</div>
        <div class="am-mb-val ${row.accuracy >= 50 ? 'text-success' : 'text-danger'}">
          ${row.accuracy !== null ? `${row.accuracy.toFixed(2)}%` : '—'}
        </div>
        <div class="am-mb-sub">Wins: ${row.wins} / Evaluated: ${row.evaluatedSamples}</div>
        <div class="am-mb-ci">95% Wilson CI: ${row.confidenceInterval?.formatted || '—'}</div>
      </div>

      <div class="am-metric-box">
        <div class="am-mb-title">Balanced Accuracy</div>
        <div class="am-mb-val">
          ${row.balancedAccuracy !== null ? `${row.balancedAccuracy.toFixed(2)}%` : '<span class="text-muted text-sm">Need samples</span>'}
        </div>
        <div class="am-mb-sub">UP Recall: ${row.directionalBreakdown?.up?.accuracy ? `${row.directionalBreakdown.up.accuracy}%` : '—'} | DOWN Recall: ${row.directionalBreakdown?.down?.accuracy ? `${row.directionalBreakdown.down.accuracy}%` : '—'}</div>
        <div class="am-mb-ci">Prevents market imbalance distortion</div>
      </div>

      <div class="am-metric-box">
        <div class="am-mb-title">Brier Score</div>
        <div class="am-mb-val font-mono">
          ${prob.brierScore !== null ? prob.brierScore.toFixed(4) : '—'}
        </div>
        <div class="am-mb-sub">Log Loss: ${prob.logLoss !== null ? prob.logLoss.toFixed(4) : '—'}</div>
        <div class="am-mb-ci">Lower indicates sharper probability calibration</div>
      </div>

      <div class="am-metric-box">
        <div class="am-mb-title">Baseline Comparison</div>
        <div class="am-mb-val ${base.baselineDiff > 0 ? 'text-success' : 'text-danger'}">
          ${base.baselineDiff !== null ? `${base.baselineDiff > 0 ? '+' : ''}${base.baselineDiff.toFixed(2)}%` : '—'}
        </div>
        <div class="am-mb-sub">vs Random 50% Baseline (${base.randomBaseline}%)</div>
        <div class="am-mb-ci">Majority Class: ${base.majorityClassBaseline}% (${base.majorityClass})</div>
      </div>
    </div>

    <!-- 2. Confusion Matrix & Directional Breakdown -->
    <div class="am-matrix-container">
      <div class="am-sec-heading">Confusion Matrix (Classification Breakdown)</div>
      <div class="am-cm-grid">
        <div class="am-cm-cell header"></div>
        <div class="am-cm-cell header">Actual UP (Bullish)</div>
        <div class="am-cm-cell header">Actual DOWN (Bearish)</div>

        <div class="am-cm-cell header">Predicted UP</div>
        <div class="am-cm-cell tp">
          <div class="am-cm-val">${cm.tp}</div>
          <div class="am-cm-tag">True Bullish (TP)</div>
        </div>
        <div class="am-cm-cell fp">
          <div class="am-cm-val">${cm.fp}</div>
          <div class="am-cm-tag">False Bullish (FP)</div>
        </div>

        <div class="am-cm-cell header">Predicted DOWN</div>
        <div class="am-cm-cell fn">
          <div class="am-cm-val">${cm.fn}</div>
          <div class="am-cm-tag">False Bearish (FN)</div>
        </div>
        <div class="am-cm-cell tn">
          <div class="am-cm-val">${cm.tn}</div>
          <div class="am-cm-tag">True Bearish (TN)</div>
        </div>
      </div>
    </div>

    <!-- 3. Paginated Historical Predictions Audit Trail -->
    <div class="am-audit-container">
      <div class="am-sec-heading">Recent Official Snapshots & Resolved Target Outcomes</div>
      <div id="amAuditList" class="am-audit-list">
        <div class="am-loading-cell"><div class="am-spinner"></div> Loading historical predictions...</div>
      </div>
    </div>
  `;

  overlay.style.display = 'flex';

  // Fetch paginated history from client service
  const historyData = await predictionMonitorClient.fetchHistory(row.symbol, row.timeframe, 20);
  const auditList = document.getElementById('amAuditList');
  if (auditList) {
    if (!historyData?.history || historyData.history.length === 0) {
      auditList.innerHTML = `<div class="am-empty-sub">No resolved historical predictions recorded yet for this timeframe.</div>`;
    } else {
      auditList.innerHTML = `
        <table class="am-mini-table">
          <thead>
            <tr>
              <th>Cutoff Time</th>
              <th>Target Candle</th>
              <th>Predicted</th>
              <th>Probability</th>
              <th>Actual Outcome</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${historyData.history.map(h => {
              const evalRes = h.evaluation;
              const outcomeDir = evalRes?.actualDirection || (h.status === 'PENDING' ? 'PENDING' : '—');
              return `
                <tr>
                  <td class="font-mono text-xs">${formatTradingTime(h.predictionTime, true)}</td>
                  <td class="font-mono text-xs">${h.targetCandle?.startTime ? formatTradingTime(h.targetCandle.startTime * 1000) : '—'}</td>
                  <td><span class="am-pred-pill ${h.direction.toLowerCase()}">${h.direction}</span></td>
                  <td class="font-mono text-xs">${h.probability ? `${+(h.probability.up * 100).toFixed(1)}% UP` : '—'}</td>
                  <td><span class="am-res-pill ${outcomeDir.toLowerCase()}">${outcomeDir}</span></td>
                  <td><span class="am-eval-pill ${h.status.toLowerCase()}">${h.status}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }
  }
}
