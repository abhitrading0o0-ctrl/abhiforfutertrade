// ============================================================
// ForFuture — Parallel Prediction Accuracy Monitor
// Client-side Communication & State Service
// Connects UI to background worker via REST and WebSocket.
// ============================================================

import { SUPPORTED_TIMEFRAMES, SUPPORTED_ASSETS, DEFAULT_MONITOR_CONFIG } from '../accuracyMonitor/registry.js';

class PredictionMonitorClient {
  constructor() {
    this.state = {
      isLoaded: false,
      health: {
        workerStatus: 'CONNECTING',
        heartbeat: null,
        totalPredictions: 0,
        totalResolved: 0,
        pendingEvaluations: 0,
        lastSuccessfulCycle: null,
      },
      settings: { ...DEFAULT_MONITOR_CONFIG },
      leaderboard: [],
      selectedSymbol: 'EUR/USD',
      evaluationWindow: 'ALL',
      rankingMethod: 'accuracy',
      minSampleThreshold: 30,
      activeModalRow: null,
      error: null,
    };

    this.listeners = new Map();
    this.ws = null;
    this.pollTimer = null;
    this.isPolling = false;
    this.activeTimeframeFilter = 'ALL';
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  _emit(event, data) {
    this.listeners.get(event)?.forEach(cb => {
      try { cb(data); } catch (e) { console.error(`[MonitorClient] Listener error for ${event}:`, e); }
    });
  }

  async init() {
    await this.fetchState();
    await this.fetchLeaderboard();
    this.connectWebSocket();

    // Start background fallback poll every 8 seconds
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => {
        this.fetchLeaderboard(true);
      }, 8000);
    }
  }

  destroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.listeners.clear();
  }

  connectWebSocket() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:3001`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Do not mark LIVE just because WebSocket connected. Fetch genuine server health:
        this.fetchState();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'accuracyMonitorUpdate') {
            if (msg.health) {
              this.state.health = { ...this.state.health, ...msg.health };
              this._emit('healthChanged', this.state.health);
            }
            this.handleMonitorUpdate(msg);
          } else if (msg.type === 'accuracyMonitorHeartbeat') {
            if (msg.health) {
              this.state.health = { ...this.state.health, ...msg.health };
              this._emit('healthChanged', this.state.health);
            }
          }
        } catch (e) {}
      };

      this.ws.onclose = () => {
        // Retry connection in 5s
        setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.ws.onerror = () => {
        // Fallback polling keeps dashboard 100% active
      };
    } catch (e) {
      console.warn('[MonitorClient] WebSocket connection failed, using REST polling fallback.');
    }
  }

  handleMonitorUpdate(update) {
    if (update.type === 'predictionRecorded' || update.type === 'outcomeResolved') {
      // Refresh leaderboard data seamlessly
      this.fetchLeaderboard(true);
    }
    this._emit('updateReceived', update);
  }

  async runDiagnostics(symbol = this.state.selectedSymbol) {
    try {
      const res = await fetch(`/api/monitor/diagnostics?symbol=${encodeURIComponent(symbol)}`);
      if (res.ok) {
        return await res.json();
      }
      throw new Error(`Diagnostics failed: HTTP ${res.status}`);
    } catch (err) {
      console.error('[MonitorClient] Diagnostics error:', err);
      return { overallStatus: 'FAIL', error: err.message, stages: [] };
    }
  }

  async fetchState() {
    try {
      const res = await fetch('/api/monitor/state');
      if (res.ok) {
        const data = await res.json();
        this.state.health = data.health || this.state.health;
        this.state.settings = { ...this.state.settings, ...(data.settings || {}) };
        this.state.isLoaded = true;
        this.state.error = null;
        this._emit('stateChanged', this.state);
        this._emit('healthChanged', this.state.health);
        return data;
      }
    } catch (err) {
      this.state.error = err.message;
      this._emit('error', err);
    }
  }

  async fetchLeaderboard(silent = false) {
    try {
      const params = new URLSearchParams({
        symbol: this.state.selectedSymbol,
        window: this.state.evaluationWindow,
        sortBy: this.state.rankingMethod,
        minSamples: this.state.minSampleThreshold.toString(),
      });

      const res = await fetch(`/api/monitor/leaderboard?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.health) this.state.health = { ...this.state.health, ...data.health };
        if (data.settings) this.state.settings = { ...this.state.settings, ...data.settings };
        this.state.leaderboard = data.leaderboard || [];
        this.state.isLoaded = true;
        this._emit('leaderboardUpdated', this.state.leaderboard);
        this._emit('healthChanged', this.state.health);
        return data;
      }
    } catch (err) {
      if (!silent) console.warn('[MonitorClient] Failed to fetch leaderboard:', err.message);
    }
  }

  async toggleMonitoring() {
    const newStatus = this.state.settings.status === 'RUNNING' ? 'PAUSED' : 'RUNNING';
    return this.updateSettings({ status: newStatus });
  }

  async updateSettings(partial = {}) {
    try {
      const res = await fetch('/api/monitor/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });

      if (res.ok) {
        const data = await res.json();
        this.state.settings = { ...this.state.settings, ...(data.settings || partial) };
        this.state.health.workerStatus = this.state.settings.status === 'RUNNING' ? 'LIVE' : 'PAUSED';
        this._emit('stateChanged', this.state);
        await this.fetchLeaderboard(true);
        return data;
      }
    } catch (err) {
      console.error('[MonitorClient] Error updating settings:', err);
    }
  }

  async fetchHistory(symbol = null, timeframe = null, limit = 50) {
    try {
      const params = new URLSearchParams({
        symbol: symbol || this.state.selectedSymbol,
        ...(timeframe ? { timeframe } : {}),
        limit: limit.toString(),
      });
      const res = await fetch(`/api/monitor/history?${params.toString()}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('[MonitorClient] Error fetching history:', e);
      return { success: false, history: [] };
    }
  }

  setSelectedSymbol(symbol) {
    this.state.selectedSymbol = symbol;
    this.fetchLeaderboard();
  }

  async setMinSampleThreshold(threshold) {
    const val = parseInt(threshold, 10);
    if (isNaN(val) || val < 1) return;
    this.state.minSampleThreshold = val;
    await this.updateSettings({ minSampleThreshold: val });
  }

  async setEvaluationWindow(window) {
    this.state.evaluationWindow = window;
    await this.updateSettings({ evaluationWindow: window });
  }

  async setRankingMethod(method) {
    this.state.rankingMethod = method;
    await this.updateSettings({ rankingMethod: method });
  }

  async toggleAssetMonitoring(symbol) {
    const current = new Set(this.state.settings.enabledAssets || ['EUR/USD', 'GBP/USD']);
    if (current.has(symbol)) {
      if (current.size > 1) {
        current.delete(symbol);
      }
    } else {
      current.add(symbol);
    }
    const updated = Array.from(current);
    await this.updateSettings({ enabledAssets: updated });
  }

  async publishOfficialPrediction(predictionData) {
    try {
      const res = await fetch('/api/monitor/publish-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(predictionData),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[MonitorClient] Failed to publish official prediction:', e.message);
    }
  }

  async publishOfficialOutcome(outcomeData) {
    try {
      const res = await fetch('/api/monitor/resolve-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outcomeData),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[MonitorClient] Failed to publish official outcome:', e.message);
    }
  }
}

export const predictionMonitorClient = new PredictionMonitorClient();
