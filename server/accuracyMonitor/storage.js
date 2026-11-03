// ============================================================
// ForFuture — Parallel Prediction Accuracy Monitor
// Durable Server Persistence Layer (Atomic JSON Store)
// Guarantees persistence across restarts, deployments, and reloads.
// Prevents duplicate predictions and double-scoring.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_MONITOR_CONFIG, WORKER_STATUSES } from '../../src/accuracyMonitor/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store database in project root /data directory
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'prediction_monitor_db.json');
const TMP_FILE = path.join(DATA_DIR, 'prediction_monitor_db.tmp');

export class AccuracyMonitorStorage {
  constructor(dbPath = DB_FILE) {
    this.dbPath = dbPath;
    this.tmpPath = `${dbPath}.tmp`;
    this.dataDir = path.dirname(dbPath);
    
    this.state = {
      version: '1.0',
      settings: {
        ...DEFAULT_MONITOR_CONFIG,
      },
      health: {
        workerStatus: WORKER_STATUSES.STARTING,
        heartbeat: Date.now(),
        lastAttemptedCycle: null,
        lastSuccessfulCycle: null,
        lastSuccessfulPrediction: null,
        lastSuccessfulOutcome: null,
        lastError: null,
        lastErrorTime: null,
        lastProviderResponse: null,
        dueContextsProcessed: 0,
        predictionsCreated: 0,
        predictionsResolved: 0,
        failedContexts: 0,
        missedCycles: 0,
        activeForexProvider: null,
        totalPredictions: 0,
        totalResolved: 0,
        pendingEvaluations: 0,
      },
      // Maps for O(1) idempotency lookup
      predictions: {}, // predictionId -> predictionSnapshot
      outcomes: {},    // predictionId -> outcomeRecord
    };

    this._saveScheduled = false;
    this._initDir();
    this.load();
  }

  _initDir() {
    if (!fs.existsSync(this.dataDir)) {
      try {
        fs.mkdirSync(this.dataDir, { recursive: true });
      } catch (err) {
        console.warn('[MonitorStorage] Could not create data dir:', err.message);
      }
    }
  }

  load() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version) {
          this.state.settings = { ...this.state.settings, ...(parsed.settings || {}) };
          // Reconcile timeframes if database was saved with older 5-TF config
          if (!this.state.settings.enabledTimeframes || this.state.settings.enabledTimeframes.length < DEFAULT_MONITOR_CONFIG.enabledTimeframes.length) {
            this.state.settings.enabledTimeframes = [...DEFAULT_MONITOR_CONFIG.enabledTimeframes];
          }
          this.state.health = { ...this.state.health, ...(parsed.health || {}) };
          this.state.predictions = parsed.predictions || {};
          this.state.outcomes = parsed.outcomes || {};
          this._auditIntegrity();
          this._updateHealthCounts();
          console.log(`[MonitorStorage] Loaded database with ${Object.keys(this.state.predictions).length} predictions and ${Object.keys(this.state.outcomes).length} outcomes.`);
          return true;
        }
      }
    } catch (e) {
      console.error('[MonitorStorage] Failed to read database, initializing fresh:', e.message);
    }
    this.saveImmediate();
    return false;
  }

  _auditIntegrity() {
    let auditedCount = 0;
    // Check outcomes for premature or timezone-shifted resolutions
    for (const id in this.state.outcomes) {
      const o = this.state.outcomes[id];
      const targetEndTime = o.targetEndTime || (o.targetStartTime + 60);
      const resolvedSec = Math.floor((o.resolvedAt || 0) / 1000);
      // Outcomes resolved before target close or affected by shifted timestamps
      if (o.targetStartTime > 1792180000 || (resolvedSec > 0 && resolvedSec < targetEndTime)) {
        if (!o.auditRequired) {
          o.auditRequired = true;
          o.auditReason = 'PREMATURE_EVALUATION_TIMEZONE_DISCREPANCY';
          o.status = 'AUDIT_REQUIRED';
          o.excludedFromMetrics = true;
          auditedCount++;
        }
      }
    }
    // Check predictions for timezone shifts, premature timing or boundary anomalies
    for (const id in this.state.predictions) {
      const p = this.state.predictions[id];
      const predSec = Math.floor((p.predictionTime || 0) / 1000);
      const step = p.stepSec || 60;
      const targetStart = p.targetCandle?.startTime || 0;
      
      // If target candle is more than 5 periods in future from prediction cutoff time,
      // it was created by an un-normalized timezone shift (e.g. Twelve Data +11h)
      const isShifted = targetStart > (predSec + step * 5) || p.cutoffCandleTime > (predSec + step * 5);
      const isLegacyStale = targetStart > 1792180000 || p.cutoffCandleTime > 1792180000;

      if (isShifted || isLegacyStale) {
        if (!p.auditRequired) {
          p.auditRequired = true;
          p.auditReason = 'PREMATURE_EVALUATION_TIMEZONE_DISCREPANCY';
          p.status = 'AUDIT_REQUIRED';
          p.excludedFromMetrics = true;
          auditedCount++;
        }
      }
    }
    if (auditedCount > 0) {
      console.log(`[MonitorStorage] Audited ${auditedCount} historical records flagged for timezone/premature discrepancy.`);
    }
  }

  saveImmediate() {
    try {
      this._initDir();
      this._updateHealthCounts();
      const payload = JSON.stringify(this.state, null, 2);
      fs.writeFileSync(this.tmpPath, payload, 'utf8');
      fs.renameSync(this.tmpPath, this.dbPath);
      return true;
    } catch (e) {
      console.error('[MonitorStorage] Atomic write failed:', e.message);
      return false;
    }
  }

  scheduleSave() {
    if (this._saveScheduled) return;
    this._saveScheduled = true;
    setTimeout(() => {
      this._saveScheduled = false;
      this.saveImmediate();
    }, 1000); // 1s write debouncing for high tick rates
  }

  _updateHealthCounts() {
    const totalP = Object.keys(this.state.predictions).length;
    const totalO = Object.keys(this.state.outcomes).length;
    this.state.health.totalPredictions = totalP;
    this.state.health.totalResolved = totalO;
    this.state.health.pendingEvaluations = Math.max(0, totalP - totalO);
  }

  // --- IDEMPOTENT PREDICTION SNAPSHOT RECORDING ---

  recordPrediction(snapshot) {
    if (!snapshot || !snapshot.predictionId) return false;
    const id = snapshot.predictionId;
    
    // Idempotency: if already recorded for this exact target candle & version, return existing
    if (this.state.predictions[id]) {
      return false; // Already recorded
    }

    this.state.predictions[id] = {
      ...snapshot,
      recordedAt: Date.now(),
      status: 'PENDING',
    };

    this.scheduleSave();
    return true;
  }

  getPrediction(id) {
    return this.state.predictions[id] || null;
  }

  // --- IDEMPOTENT OUTCOME RESOLUTION ---

  resolveOutcome(outcome) {
    if (!outcome || !outcome.predictionId) return false;
    const id = outcome.predictionId;

    // Idempotency: if already scored, do NOT score again
    if (this.state.outcomes[id]) {
      return false;
    }

    this.state.outcomes[id] = {
      ...outcome,
      resolvedAt: outcome.resolvedAt || Date.now(),
    };

    // Update prediction status
    if (this.state.predictions[id]) {
      this.state.predictions[id].status = outcome.evaluation; // 'WIN' | 'LOSS' | 'FLAT'
      this.state.predictions[id].evaluation = outcome;
    }

    this.scheduleSave();
    return true;
  }

  getOutcome(id) {
    return this.state.outcomes[id] || null;
  }

  // --- QUERIES ---

  getPendingPredictions(symbol = null, timeframe = null) {
    const list = [];
    for (const id in this.state.predictions) {
      if (!this.state.outcomes[id]) {
        const p = this.state.predictions[id];
        if (p.auditRequired || p.status === 'AUDIT_REQUIRED' || p.excludedFromMetrics) continue;
        if (symbol && p.symbol !== symbol) continue;
        if (timeframe && p.timeframe !== timeframe) continue;
        list.push(p);
      }
    }
    return list;
  }

  getAllEvaluations(symbol = null, timeframe = null) {
    const list = [];
    for (const id in this.state.outcomes) {
      const o = this.state.outcomes[id];
      if (symbol && o.symbol !== symbol) continue;
      if (timeframe && o.timeframe !== timeframe) continue;
      list.push(o);
    }
    return list;
  }

  getRecentPredictions(symbol = null, timeframe = null, limit = 50, includeAudit = false) {
    const all = Object.values(this.state.predictions)
      .filter(p => {
        if (!includeAudit && (p.auditRequired || p.status === 'AUDIT_REQUIRED' || p.excludedFromMetrics)) return false;
        if (symbol && p.symbol !== symbol) return false;
        if (timeframe && p.timeframe !== timeframe) return false;
        return true;
      })
      .sort((a, b) => (b.predictionTime || 0) - (a.predictionTime || 0));
    return all.slice(0, limit);
  }

  // --- SETTINGS & HEALTH ---

  getSettings() {
    return { ...this.state.settings };
  }

  updateSettings(partial = {}) {
    const sanitized = {};
    if (partial.status && ['RUNNING', 'PAUSED'].includes(partial.status)) {
      sanitized.status = partial.status;
    }
    if (partial.minSampleThreshold != null) {
      const parsed = parseInt(partial.minSampleThreshold, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 500) {
        sanitized.minSampleThreshold = parsed;
      }
    }
    if (partial.evaluationWindow && ['ALL', '24H', '7D', '30D', 'LAST_50', 'LAST_100'].includes(partial.evaluationWindow)) {
      sanitized.evaluationWindow = partial.evaluationWindow;
    }
    if (partial.rankingMethod && ['accuracy', 'recentAccuracy', 'balancedAccuracy', 'brierScore', 'sampleCount', 'timeframe'].includes(partial.rankingMethod)) {
      sanitized.rankingMethod = partial.rankingMethod;
    }
    if (Array.isArray(partial.enabledAssets) && partial.enabledAssets.length > 0) {
      sanitized.enabledAssets = [...partial.enabledAssets];
    }
    if (Array.isArray(partial.enabledTimeframes) && partial.enabledTimeframes.length > 0) {
      sanitized.enabledTimeframes = [...partial.enabledTimeframes];
    }

    this.state.settings = { ...this.state.settings, ...sanitized };
    this.scheduleSave();
    return this.getSettings();
  }

  computeWorkerStatus() {
    const s = this.state.settings.status;
    if (s === 'PAUSED') return WORKER_STATUSES.PAUSED;
    if (s === 'DISABLED') return WORKER_STATUSES.DISABLED;
    const now = Date.now();
    const h = this.state.health;
    if (h.lastError && (now - (h.lastErrorTime || 0)) < 20000) {
      return WORKER_STATUSES.ERROR;
    }
    if (!h.lastSuccessfulCycle) {
      return WORKER_STATUSES.STARTING;
    }
    if (now - (h.heartbeat || 0) > 30000) {
      return WORKER_STATUSES.DELAYED;
    }
    return WORKER_STATUSES.HEALTHY;
  }

  getHealth() {
    this._updateHealthCounts();
    this.state.health.workerStatus = this.computeWorkerStatus();
    return { ...this.state.health };
  }

  updateHealth(partial = {}) {
    this.state.health = { ...this.state.health, ...partial };
    this.state.health.workerStatus = this.computeWorkerStatus();
    return this.getHealth();
  }
}
