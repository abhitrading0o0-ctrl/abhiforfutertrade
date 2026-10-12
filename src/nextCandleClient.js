import { HubConnectionBuilder, LogLevel, HttpTransportType } from '@microsoft/signalr';

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

function parseBiquoteDate(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    // some browsers fail to parse ISO strings with 7 fractional digits.
    // e.g. "2026-10-09T05:41:25.8687418Z" -> "2026-10-09T05:41:25.868Z"
    let clean = ts;
    if (clean.includes('.') && clean.endsWith('Z')) {
      const parts = clean.split('.');
      if (parts.length === 2 && parts[1].length > 4) {
        clean = parts[0] + '.' + parts[1].substring(0, 3) + 'Z';
      }
    }
    const ms = new Date(clean).getTime();
    return isNaN(ms) ? 0 : ms;
  }
  return 0;
}

class MarketDataService {
  constructor() {
    this.isConnected = false;
    this.status = 'DISCONNECTED'; // CONNECTING, LIVE, REST / PERIODIC, RECONNECTING, ERROR
    this.listeners = new Map();
    
    this.activeSymbol = 'EUR/USD';
    this.activeCanonical = 'EURUSD';
    this.activeTimeframe = '1M';
    
    // Connections & Timers
    this.hubConnection = null;
    this.pollTimer = null;
    this.isPolling = false;
    this.abortController = null;
    this.pollIntervalMs = 5000;
    
    // Time & Sync
    this.currentOffset = 0;
    this.syncLatency = 0;
    this.lastSync = 0;
    this.serverTime = Date.now();
    this.providerTime = Date.now();
    this.lastTickTimestamp = 0;
    this.lastQuoteAge = 0;
    
    this.generationId = 0;
    
    this.activeProvider = 'Biquote';
    this.isBackup = false;
  }

  // Event System
  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }

  _emit(type, data) {
    this.listeners.get(type)?.forEach(fn => { try { fn(data); } catch (e) { console.error('Emit Error:', e); } });
  }

  _setStatus(status, isBackup = false, errorMsg = null) {
    this.status = status;
    this.isConnected = ['LIVE', 'REST / PERIODIC'].includes(status);
    this._emit('connection', { status: status.toLowerCase() });
    
    // Provide explicit state updates for UI
    this._emit('providerStatus', {
      activeProvider: 'Biquote',
      isBackup: isBackup,
      error: errorMsg,
      providers: [{ name: 'Biquote', state: errorMsg ? 'FAILED' : 'HEALTHY' }]
    });
  }

  // --- API ---
  
  subscribe(symbol, timeframes = ['1M']) {
    this.activeSymbol = symbol;
    this.activeCanonical = symbol.replace('/', '').replace('-', '').toUpperCase();
    this.activeTimeframe = timeframes[0] || '1M';
    this.generationId++; // invalidate old requests
    
    this.connect();
  }

  unsubscribe(symbol) {
    if (symbol === this.activeSymbol) {
      this.disconnect();
    }
  }

  disconnect() {
    this.generationId++;
    this._stopPolling();
    this._stopSignalR();
    this._setStatus('DISCONNECTED');
  }

  async connect() {
    this._setStatus('CONNECTING');
    this._stopPolling();
    this._stopSignalR();
    
    const genId = this.generationId;
    
    try {
      // 1. Health check
      try {
        const startTime = Date.now();
        const healthRes = await fetch('https://biquote.io/health');
        if (healthRes.ok) {
          const health = await healthRes.json();
          this.syncLatency = Date.now() - startTime;
          this.lastSync = Date.now();
          if (health.timestamp) {
            const ms = parseBiquoteDate(health.timestamp);
            if (ms > 0) {
              const st = (ms < 1e11) ? ms * 1000 : ms;
              this.serverTime = st;
              this.currentOffset = st - Date.now();
            }
          }
        }
      } catch (he) {
        console.warn('[MDS] Health check warn:', he.message);
      }
      
      this._emit('timeSync', {
        currentOffset: this.currentOffset,
        syncLatency: this.syncLatency,
        serverTime: this.serverTime,
        providerTime: this.serverTime
      });

      if (this.generationId !== genId) return;

      // 2. Fetch Latest Quote
      try {
        await this._fetchLatestQuote(genId);
      } catch (qe) {
        console.warn('[MDS] Quote fetch warning:', qe.message);
      }
      
      // 3. Fetch OHLC & Normalize
      await this._fetchOHLC(genId);

      // 4. Connect SignalR
      try {
        await this._startSignalR(genId);
      } catch (se) {
        console.warn('[MDS] SignalR connection warning, falling back to REST polling:', se.message);
        this._startRESTFallback();
      }

    } catch (err) {
      console.error('[MDS] Connection error:', err);
      if (this.generationId === genId) {
        this._setStatus('ERROR', false, err.message);
        this._startRESTFallback();
      }
    }
  }
  
  async refreshData() {
    // Explicit refresh data action
    this.generationId++;
    await this.connect();
  }
  
  async reconnectLiveFeed() {
    this._stopSignalR();
    if (this.status !== 'CONNECTING') {
      this._setStatus('CONNECTING');
    }
    await this._startSignalR(this.generationId);
  }

  // --- REST Data ---

  async _fetchLatestQuote(genId) {
    const res = await fetch(`https://biquote.io/api/${this.activeCanonical}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch latest quote`);
    const quote = await res.json();
    
    if (this.generationId !== genId) return;
    
    // Verify quote
    if (quote && quote.mid) {
      this.lastTickTimestamp = Date.now();
      this.lastQuoteAge = quote.quoteAgeSeconds || 0;
      
      const ms = parseBiquoteDate(quote.timestamp);
      
      this._emit('tick', {
        symbol: this.activeSymbol,
        provider: 'Biquote',
        canonicalSymbol: this.activeCanonical,
        bid: quote.bid,
        ask: quote.ask,
        mid: quote.mid,
        spread: quote.spread || ((quote.ask - quote.bid) * 10000), // simplistic spread
        timestamp: (ms < 1e11 ? ms * 1000 : ms),
        quoteAgeSeconds: quote.quoteAgeSeconds,
        stale: quote.stale,
        marketState: quote.marketState
      });
      
      if (quote.marketState === 'CLOSED') {
        this._setStatus('MARKET CLOSED');
      }
    }
  }

  async _fetchOHLC(genId) {
    const tf = this.activeTimeframe;
    let biquoteInterval = '1m';
    let limit = 500;
    
    if (tf === '5M') {
      biquoteInterval = '5m';
      limit = 200;
    }
    
    const res = await fetch(`https://biquote.io/api/${this.activeCanonical}/ohlc?interval=${biquoteInterval}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch OHLC data');
    const data = await res.json();
    
    if (this.generationId !== genId) return;
    
    if (!data.bars || !Array.isArray(data.bars)) throw new Error('Invalid OHLC schema');
    
    // Normalize and aggregate
    let candles = this._normalizeBiquoteBars(data.bars);
    
    if (tf === '2M' || tf === '3M' || tf === '4M') {
      candles = this._aggregateCandles(candles, parseInt(tf.replace('M', '')));
    }
    
    // Separate historical (completed) vs active (forming)
    // The Biquote schema says the latest forming bar is identified with `isOpen: true`
    
    const completed = [];
    let active = null;
    
    for (const c of candles) {
      if (c.isOpen) {
        active = c;
      } else {
        completed.push(c);
      }
    }
    
    // If no explicit isOpen, take the last as active depending on current time
    if (!active && completed.length > 0) {
        active = completed.pop();
        active.isOpen = true; // Assume forming if not explicitly closed by Biquote (fallback)
    }

    this._emit('historicalCandles', {
      symbol: this.activeSymbol,
      timeframe: this.activeTimeframe,
      provider: 'Biquote',
      candles: completed,
      activeCandle: active
    });
  }
  
  _normalizeBiquoteBars(bars) {
    const seen = new Set();
    const normalized = [];
    
    for (const b of bars) {
      const ms = parseBiquoteDate(b.openTime);
                 
      const sec = Math.floor(ms / 1000);
      
      if (seen.has(sec)) continue;
      seen.add(sec);
      
      normalized.push({
        time: sec, // lightweight charts expects Unix timestamp in seconds
        timestamp: ms,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.tickVolume || b.volume || 0, // Prefer tickVolume for FX
        tickCount: b.tickVolume || 0,
        isOpen: !!b.isOpen
      });
    }
    
    return normalized.sort((a, b) => a.time - b.time);
  }
  
  _aggregateCandles(candles1m, multiplier) {
    const aggregated = [];
    const stepSec = multiplier * 60;
    
    let currentAgg = null;
    
    for (const c of candles1m) {
      const aggStartSec = Math.floor(c.time / stepSec) * stepSec;
      
      if (!currentAgg || currentAgg.time !== aggStartSec) {
        if (currentAgg) aggregated.push(currentAgg);
        currentAgg = {
          time: aggStartSec,
          timestamp: aggStartSec * 1000,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          tickCount: c.tickCount,
          isOpen: c.isOpen
        };
      } else {
        currentAgg.high = Math.max(currentAgg.high, c.high);
        currentAgg.low = Math.min(currentAgg.low, c.low);
        currentAgg.close = c.close;
        currentAgg.volume += c.volume;
        currentAgg.tickCount += c.tickCount;
        currentAgg.isOpen = currentAgg.isOpen || c.isOpen; // if any is open, the agg is open
      }
    }
    
    if (currentAgg) aggregated.push(currentAgg);
    
    return aggregated;
  }

  // --- SignalR ---

  async _startSignalR(genId) {
    this._stopSignalR();
    
    const connection = new HubConnectionBuilder()
      .withUrl("https://biquote.io/hubs/tick", {
        skipNegotiation: true,
        transport: HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
      
    this.hubConnection = connection;
    
    connection.on('ReceiveTick', (tick) => {
      if (this.generationId !== genId) return;
      if (tick.symbol !== this.activeCanonical) return;
      
      this.lastTickTimestamp = Date.now();
      
      const ms = parseBiquoteDate(tick.timestamp);
      
      this._emit('tick', {
        symbol: this.activeSymbol,
        provider: 'Biquote',
        canonicalSymbol: this.activeCanonical,
        bid: tick.bid,
        ask: tick.ask,
        mid: tick.mid !== undefined ? tick.mid : ((tick.bid + tick.ask) / 2),
        spread: tick.spread !== undefined ? tick.spread : ((tick.ask - tick.bid) * 10000),
        timestamp: (ms < 1e11 ? ms * 1000 : ms),
        quoteAgeSeconds: 0,
        stale: false,
        marketState: 'OPEN'
      });
    });
    
    connection.onreconnecting((error) => {
      if (this.generationId === genId) {
        this._setStatus('RECONNECTING');
        this._startRESTFallback(); // Use REST while reconnecting
      }
    });
    
    connection.onreconnected(async (connectionId) => {
      if (this.generationId === genId) {
        this._stopPolling(); // Stop fallback
        this._setStatus('LIVE');
        try {
          await this.hubConnection.invoke('Subscribe', [this.activeCanonical]);
        } catch (e) {
          console.error('Re-subscribe failed:', e);
        }
      }
    });
    
    connection.onclose((error) => {
      if (this.generationId === genId) {
        this._setStatus('ERROR', false, 'SignalR disconnected');
        this._startRESTFallback();
      }
    });
    
    await connection.start();
    
    if (this.generationId === genId) {
      await connection.invoke('Subscribe', [this.activeCanonical]);
      this._stopPolling(); // Disable REST polling
      this._setStatus('LIVE');
    }
  }
  
  _stopSignalR() {
    if (this.hubConnection) {
      this.hubConnection.stop().catch(() => {});
      this.hubConnection = null;
    }
  }

  // --- REST Fallback Polling ---
  
  _startRESTFallback() {
    if (this.isPolling) return;
    this.isPolling = true;
    this._setStatus('REST / PERIODIC');
    this._pollCycle(this.generationId);
  }
  
  _stopPolling() {
    this.isPolling = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    if (this.abortController) this.abortController.abort();
  }
  
  async _pollCycle(genId) {
    if (!this.isPolling || this.generationId !== genId) return;
    
    this.abortController = new AbortController();
    
    try {
      await this._fetchLatestQuote(genId);
      // To keep candles forming, we fetch OHLC occasionally or just latest quote
      // Since it's fallback, fetching OHLC every few seconds is ok, but we don't want to spam
      // We can fetch OHLC every 3rd poll
      if (!this._pollCount) this._pollCount = 0;
      this._pollCount++;
      
      if (this._pollCount % 3 === 0) {
        await this._fetchOHLC(genId);
      }
      
    } catch (e) {
      console.warn('REST fallback poll failed:', e);
    } finally {
      if (this.isPolling && this.generationId === genId) {
        this.pollTimer = setTimeout(() => this._pollCycle(genId), this.pollIntervalMs);
      }
    }
  }

  // --- Helpers used by UI ---
  
  getSynchronizedTime() {
    return Date.now() + (this.currentOffset || 0);
  }

  getSynchronizedTimeSec() {
    return (Date.now() + (this.currentOffset || 0)) / 1000;
  }

  getServerTime() {
    return Date.now() + (this.currentOffset || 0);
  }
  
  getDataAge() {
    return this.lastTickTimestamp ? Date.now() - this.lastTickTimestamp : null;
  }
  
  getSyncDiagnostics() {
    const clientNow = Date.now();
    const serverNow = clientNow + (this.currentOffset || 0);
    return {
      serverTime: serverNow,
      clientTime: clientNow,
      providerTime: this.providerTime || serverNow,
      currentOffset: this.currentOffset,
      lastSync: this.lastSync,
      syncLatency: this.syncLatency,
      syncCount: 1,
    };
  }
  
  getActiveProvider() {
    return this.activeProvider;
  }

  isBackupActive() {
    return this.isBackup;
  }

  getProviderHealth() {
    return [{ name: 'Biquote', state: this.isConnected ? 'HEALTHY' : 'FAILED' }];
  }

  getSwitchHistory() {
    return [];
  }
  
  async getDiagnostics(symbol, timeframe) {
     return {};
  }
  
  async requestProviderStatus() {}
  simulateProviderFailure() {}
  resetProviderHealth() {}
}

export const marketDataClient = new MarketDataService();
export const MarketDataServiceInstance = marketDataClient;

export function normalizeCandle(c) {
  if (!c) return null;
  return {
    time: c.time || c.timestamp || Math.floor(Date.now() / 1000),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close
  };
}

export function validateCandles(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeCandle).filter(c => c && c.time && !isNaN(c.close));
}
