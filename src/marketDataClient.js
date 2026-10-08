// ============================================================
// ForFuture — MarketDataService / MarketDataClient (v4.0)
// Centralized Market Data Service & Normalization Layer
// ============================================================

/**
 * Format timestamp in UTC+5:30 (Asia/Kolkata) for visual trading display
 * Never mutates the raw UTC epoch timestamp
 */
export function formatTradingTime(timestamp, includeSeconds = false) {
  if (!timestamp) return '—';
  const ms = typeof timestamp === 'number' && timestamp < 1e11 ? timestamp * 1000 : Number(timestamp);
  if (isNaN(ms)) return '—';
  const d = new Date(ms);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: false,
  }).format(d) + ' IST';
}

/**
 * Strict Market Data Normalizer
 * Enforces single schema across all providers (OANDA, Crypto Spot, Yahoo)
 */
export function normalizeCandle(c, defaults = {}) {
  const time = typeof c.time === 'number' ? c.time : typeof c.timestamp === 'number' ? c.timestamp : Math.floor(Date.now() / 1000);
  const open = Number(c.open || c.mid || c.close || 0);
  const high = Number(c.high || Math.max(open, Number(c.close || open)));
  const low = Number(c.low || Math.min(open, Number(c.close || open)));
  const close = Number(c.close || c.mid || open);
  const mid = Number(c.mid !== undefined ? c.mid : close);
  const volume = Number(c.volume || c.tickCount || 0);
  const isForex = (c.assetType === 'FOREX' || defaults.assetType === 'FOREX' || (c.symbol && c.symbol.includes('/')));

  const activeProv = c.activeProvider || defaults.activeProvider || c.provider || defaults.provider || (isForex ? 'OANDA' : 'Market Data');
  const isBackup = c.isBackup !== undefined ? c.isBackup : (defaults.isBackup !== undefined ? defaults.isBackup : (activeProv !== 'OANDA' && isForex));

  return {
    symbol: c.symbol || defaults.symbol || 'EUR/USD',
    canonicalSymbol: c.canonicalSymbol || defaults.canonicalSymbol || (c.symbol ? c.symbol.replace(/[/_]/g, '') : 'EURUSD'),
    providerSymbol: c.providerSymbol || defaults.providerSymbol || c.symbol,
    provider: c.provider || defaults.provider || activeProv,
    activeProvider: activeProv,
    isBackup: Boolean(isBackup),
    assetType: c.assetType || defaults.assetType || (isForex ? 'FOREX' : 'STOCK'),
    time,
    timestamp: time,
    open,
    high: Math.max(open, close, high),
    low: Math.min(open, close, low),
    close,
    mid,
    bid: c.bid !== undefined ? Number(c.bid) : close,
    ask: c.ask !== undefined ? Number(c.ask) : close,
    volume,
    volumeType: c.volumeType || defaults.volumeType || (isForex ? 'TICK' : 'REAL'),
    complete: Boolean(c.complete || c.status === 'CLOSED'),
    marketStatus: c.marketStatus || defaults.marketStatus || 'LIVE',
    timeframe: c.timeframe || defaults.timeframe || '1M',
    priceBasis: c.priceBasis || 'MID',
  };
}

/**
 * Validates, sorts ascending, and deduplicates candles
 */
export function validateCandles(candles, meta = {}) {
  if (!Array.isArray(candles) || candles.length === 0) return [];

  const valid = [];
  for (const raw of candles) {
    if (!raw) continue;
    const c = normalizeCandle(raw, meta);
    if (!c.time || isNaN(c.time) || c.time <= 0) continue;
    if (isNaN(c.open) || isNaN(c.high) || isNaN(c.low) || isNaN(c.close)) continue;
    if (c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0) continue;

    // Enforce high >= max(open, close) and low <= min(open, close)
    c.high = Math.max(c.high, c.open, c.close);
    c.low = Math.min(c.low, c.open, c.close);

    valid.push(c);
  }

  // Sort ascending by time
  valid.sort((a, b) => a.time - b.time);

  // Remove duplicates
  const deduplicated = [];
  for (const candle of valid) {
    if (deduplicated.length === 0) {
      deduplicated.push(candle);
    } else {
      const prev = deduplicated[deduplicated.length - 1];
      if (prev.time === candle.time) {
        // Overwrite earlier duplicate with latest update
        deduplicated[deduplicated.length - 1] = candle;
      } else if (candle.time > prev.time) {
        deduplicated.push(candle);
      }
    }
  }

  return deduplicated;
}

class MarketDataService {
  constructor() {
    this.ws = null;
    this.url = 'ws://localhost:3001';
    this.isConnected = false;
    this.status = 'DISCONNECTED'; // 'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'RESYNCING' | 'DISCONNECTED'
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 30;
    this.reconnectDelay = 1000;
    this.heartbeatTimeout = null;
    this.requestIdCounter = 0;
    this.pendingRequests = new Map();
    this.listeners = new Map();

    // Cache by symbol and timeframe
    this.latestQuotes = new Map(); // symbol -> normalized quote
    this.candleCache = new Map();  // `${symbol}_${tf}` -> candle[]
    this.activeSubscriptions = new Map(); // symbol -> Set<tf>
    this.serverConfig = {
      oandaConfigured: false,
      oandaEnv: 'practice',
      dataMode: 'LIVE',
    };

    // Time synchronization
    this.currentOffset = 0;
    this.syncLatency = 0;
    this.lastSync = 0;
    this.serverTime = Date.now();
    this.providerTime = Date.now();
    this.lastTickTimestamp = 0;
    this.timeSyncTimer = null;
    this.syncIdCounter = 0;

    // Failover & Multi-Provider State
    this.activeProvider = 'OANDA';
    this.isBackup = false;
    this.priorityChain = ['OANDA', 'FXCM', 'Twelve Data', 'FOREX.com'];
    this.providerHealth = {};
    this.switchHistory = [];
  }

  connect(url = 'ws://localhost:3001') {
    this.url = url;
    this._connect();
  }

  _connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    const isReconnecting = this.reconnectAttempts > 0;
    this._setStatus(isReconnecting ? 'RECONNECTING' : 'CONNECTING');

    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this._handleDisconnect();
      return;
    }

    this.ws.onopen = () => {
      this._startTimeSync();
      this.requestTimeSync();

      if (isReconnecting) {
        this._setStatus('RESYNCING');
        this._resyncActiveSubscriptions();
        setTimeout(() => {
          this._setStatus('LIVE');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this._startHeartbeatCheck();
          this._emit('connection', { status: 'LIVE' });
        }, 300);
      } else {
        this._setStatus('LIVE');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this._startHeartbeatCheck();
        this._emit('connection', { status: 'LIVE' });
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this._handleMessage(data);
      } catch (e) {
        console.error('[MDS] JSON Parse error:', e);
      }
    };

    this.ws.onclose = () => {
      this._stopTimeSync();
      this._setStatus('DISCONNECTED');
      this._handleDisconnect();
    };

    this.ws.onerror = () => {
      this._stopTimeSync();
      this._setStatus('DISCONNECTED');
      this._handleDisconnect();
    };
  }

  _setStatus(status) {
    this.status = status;
    this.isConnected = status === 'LIVE' || status === 'RESYNCING';
    this._emit('statusChange', { status });
  }

  _handleDisconnect() {
    this._stopHeartbeatCheck();
    this.isConnected = false;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this._setStatus('DISCONNECTED');
      this._emit('connection', { status: 'DISCONNECTED' });
      return;
    }

    this._setStatus('RECONNECTING');
    this._emit('connection', { status: 'RECONNECTING', attempt: this.reconnectAttempts + 1 });

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.reconnectDelay = Math.min(15000, this.reconnectDelay * 1.4);
      this._connect();
    }, this.reconnectDelay);
  }

  _startHeartbeatCheck() {
    this._stopHeartbeatCheck();
    this.heartbeatTimeout = setTimeout(() => {
      if (this.ws) { try { this.ws.close(); } catch (e) { } }
      this._handleDisconnect();
    }, 15000);
  }

  _resetHeartbeatCheck() {
    this._startHeartbeatCheck();
  }

  _stopHeartbeatCheck() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  _startTimeSync() {
    this._stopTimeSync();
    this.timeSyncTimer = setInterval(() => {
      if (this.isConnected) this.requestTimeSync();
    }, 2500);
  }

  _stopTimeSync() {
    if (this.timeSyncTimer) {
      clearInterval(this.timeSyncTimer);
      this.timeSyncTimer = null;
    }
  }

  requestTimeSync() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const syncId = ++this.syncIdCounter;
    this.send({ type: 'timeSync', syncId, clientSendTime: Date.now() });
  }

  _resyncActiveSubscriptions() {
    for (const [sym, tfs] of this.activeSubscriptions.entries()) {
      const tfArray = Array.from(tfs);
      this.send({ type: 'subscribe', symbol: sym, timeframes: tfArray });
      for (const tf of tfArray) {
        const cached = this.candleCache.get(`${sym}_${tf}`);
        const lastTime = cached && cached.length > 0 ? cached[cached.length - 1].time : 0;
        this.send({ type: 'sync', symbol: sym, timeframe: tf, lastCandleTime: lastTime });
      }
    }
  }

  _handleMessage(data) {
    const now = Date.now();

    if (data.providerTime) {
      this.providerTime = data.providerTime;
    }

    if (data.activeProvider) {
      this.activeProvider = data.activeProvider;
    }
    if (data.isBackup !== undefined) {
      this.isBackup = data.isBackup;
    }
    if (data.providers) {
      this.providerHealth = data.providers;
    }
    if (data.priorityChain) {
      this.priorityChain = data.priorityChain;
    }
    if (data.switchHistory) {
      this.switchHistory = data.switchHistory;
    }

    if (data.type === 'providerSwitch') {
      this.activeProvider = data.to || data.activeProvider;
      this.isBackup = data.isBackup ?? (this.activeProvider !== 'OANDA');
      if (data.providers) this.providerHealth = data.providers;
      this.switchHistory.push(data);
      this._emit('providerSwitch', data);
      this._emit('providerStatus', {
        activeProvider: this.activeProvider,
        isBackup: this.isBackup,
        providers: this.providerHealth,
        switchHistory: this.switchHistory,
      });
    }

    if (data.type === 'providerStatus') {
      this.activeProvider = data.activeProvider || this.activeProvider;
      this.isBackup = data.isBackup ?? (this.activeProvider !== 'OANDA');
      if (data.providers) this.providerHealth = data.providers;
      if (data.switchHistory) this.switchHistory = data.switchHistory;
      if (data.priorityChain) this.priorityChain = data.priorityChain;
      this._emit('providerStatus', data);
    }

    if (data.type === 'connected') {
      if (data.oandaConfigured !== undefined) this.serverConfig.oandaConfigured = data.oandaConfigured;
      if (data.oandaEnv) this.serverConfig.oandaEnv = data.oandaEnv;
      if (data.dataMode) this.serverConfig.dataMode = data.dataMode;
      this._emit('config', this.serverConfig);
    }

    if (data.type === 'heartbeat') {
      this._resetHeartbeatCheck();
    }

    if (data.type === 'tick') {
      this.lastTickTimestamp = now;
      const tick = normalizeCandle(data);
      this.latestQuotes.set(tick.symbol, tick);
      this._emit('tick', tick);
    }

    if (data.type === 'historicalCandles') {
      if (data.candles) {
        data.candles = validateCandles(data.candles, data);
        const key = `${data.symbol}_${data.timeframe}`;
        this.candleCache.set(key, data.candles);
      }
      if (data.activeCandle) {
        data.activeCandle = normalizeCandle(data.activeCandle, data);
      }
      this._emit('historicalCandles', data);
    }

    if (data.type === 'candleUpdate') {
      if (data.candle) {
        data.candle = normalizeCandle(data.candle, data);
        const key = `${data.symbol}_${data.timeframe}`;
        const hist = this.candleCache.get(key);
        if (hist && hist.length > 0) {
          const last = hist[hist.length - 1];
          if (last.time === data.candle.time) {
            hist[hist.length - 1] = data.candle;
          } else if (data.candle.time > last.time) {
            hist.push(data.candle);
          }
        }
      }
      this._emit('candleUpdate', data);
    }

    if (data.type === 'candleClose') {
      if (data.candle) {
        data.candle = normalizeCandle(data.candle, data);
        const key = `${data.symbol}_${data.timeframe}`;
        const hist = this.candleCache.get(key);
        if (hist) {
          if (hist.length === 0 || hist[hist.length - 1].time < data.candle.time) {
            hist.push(data.candle);
          } else if (hist[hist.length - 1].time === data.candle.time) {
            hist[hist.length - 1] = data.candle;
          }
        }
      }
      this._emit('candleClose', data);
    }

    if (data.type === 'syncResponse') {
      if (data.missingCandles && data.missingCandles.length > 0) {
        const key = `${data.symbol}_${data.timeframe}`;
        const hist = this.candleCache.get(key) || [];
        const merged = validateCandles([...hist, ...data.missingCandles]);
        this.candleCache.set(key, merged);
        data.missingCandles = merged;
      }
      this._emit('syncResponse', data);
    }

    if (data.type === 'timeSyncResponse') {
      const clientRecvTime = Date.now();
      const sendTime = data.clientSendTime || clientRecvTime;
      const roundTrip = Math.max(0, clientRecvTime - sendTime);
      const syncLatency = Math.round(roundTrip / 2);
      const serverSendTime = data.serverSendTime || clientRecvTime;
      const serverTimeAtRecv = serverSendTime + syncLatency;
      const measuredOffset = serverTimeAtRecv - clientRecvTime;

      this.currentOffset = Math.abs(measuredOffset - this.currentOffset) > 300
        ? measuredOffset
        : Math.round(this.currentOffset * 0.6 + measuredOffset * 0.4);

      this.syncLatency = syncLatency;
      this.lastSync = clientRecvTime;
      this.serverTime = clientRecvTime + this.currentOffset;
      if (data.providerTime) this.providerTime = data.providerTime;

      this._emit('timeSync', {
        currentOffset: this.currentOffset,
        syncLatency: this.syncLatency,
        serverTime: this.serverTime,
        providerTime: this.providerTime,
      });
    }

    // Generic emit by type
    this._emit(data.type, data);
    this._emit('*', data);

    // Pending promise RPC handler
    if (data.requestId && this.pendingRequests.has(data.requestId)) {
      const { resolve } = this.pendingRequests.get(data.requestId);
      this.pendingRequests.delete(data.requestId);
      resolve(data);
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  sendRequest(data) {
    const requestId = `req_${++this.requestIdCounter}`;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 10000);
      this.send({ ...data, requestId });
    });
  }

  // ---- Subscription API ----
  subscribe(symbol, timeframes = ['1M']) {
    const tfs = Array.isArray(timeframes) ? timeframes.map(t => t.toUpperCase()) : [timeframes.toUpperCase()];
    if (!this.activeSubscriptions.has(symbol)) {
      this.activeSubscriptions.set(symbol, new Set());
    }
    tfs.forEach(tf => this.activeSubscriptions.get(symbol).add(tf));
    return this.send({ type: 'subscribe', symbol, timeframes: tfs });
  }

  unsubscribe(symbol) {
    this.activeSubscriptions.delete(symbol);
    return this.send({ type: 'unsubscribe', symbol });
  }

  async getHistorical(symbol, timeframe) {
    return this.sendRequest({ type: 'getHistorical', symbol, timeframe: timeframe.toUpperCase() });
  }

  async getPrediction(symbol, timeframe) {
    return this.sendRequest({ type: 'getPrediction', symbol, timeframe: timeframe.toUpperCase() });
  }

  async getDiagnostics(symbol, timeframe) {
    return this.sendRequest({ type: 'getDiagnostics', symbol, timeframe: timeframe.toUpperCase() });
  }

  getLatestQuote(symbol) {
    return this.latestQuotes.get(symbol) || null;
  }

  getSynchronizedTime() {
    return Date.now() + this.currentOffset;
  }

  getSynchronizedTimeSec() {
    return (Date.now() + this.currentOffset) / 1000;
  }

  getServerTime() {
    return Date.now() + this.currentOffset;
  }

  getSyncDiagnostics() {
    const clientNow = Date.now();
    const serverNow = clientNow + this.currentOffset;
    return {
      serverTime: serverNow,
      clientTime: clientNow,
      providerTime: this.providerTime || serverNow,
      currentOffset: this.currentOffset,
      lastSync: this.lastSync,
      syncLatency: this.syncLatency,
      syncCount: this.syncIdCounter,
    };
  }

  getDataAge() {
    return this.lastTickTimestamp ? Date.now() - this.lastTickTimestamp : null;
  }

  // ---- Failover & Provider Status API ----
  getActiveProvider() {
    return this.activeProvider || 'OANDA';
  }

  isBackupActive() {
    return Boolean(this.isBackup);
  }

  getProviderHealth() {
    return this.providerHealth;
  }

  getSwitchHistory() {
    return this.switchHistory;
  }

  getPriorityChain() {
    return this.priorityChain;
  }

  async requestProviderStatus() {
    return this.sendRequest({ type: 'getProviderStatus' });
  }

  async simulateProviderFailure(provider) {
    return this.sendRequest({ type: 'simulateProviderFailure', provider: provider || this.activeProvider });
  }

  async resetProviderHealth(provider) {
    return this.sendRequest({ type: 'resetProviderHealth', provider: provider || 'OANDA' });
  }

  // ---- Event System ----
  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }

  _emit(type, data) {
    this.listeners.get(type)?.forEach(fn => { try { fn(data); } catch (e) { } });
  }

  disconnect() {
    this._stopTimeSync();
    this._stopHeartbeatCheck();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) { try { this.ws.close(); } catch (e) { } this.ws = null; }
  }
}

// Singleton export
export const marketDataClient = new MarketDataService();
export const MarketDataServiceInstance = marketDataClient;
