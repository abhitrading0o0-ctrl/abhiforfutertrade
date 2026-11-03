// ============================================================
// ForFuture — Parallel Prediction Accuracy Monitor
// Canonical Timeframe & Asset Registry
// ============================================================

export const SUPPORTED_TIMEFRAMES = [
  { id: '1M',  label: '1 Minute',  seconds: 60,    interval: '1m',  multiplier: 1,  minCandles: 30, native: true },
  { id: '2M',  label: '2 Minutes', seconds: 120,   interval: '2m',  multiplier: 2,  minCandles: 25, native: false, sourceTimeframe: '1M' },
  { id: '3M',  label: '3 Minutes', seconds: 180,   interval: '3m',  multiplier: 3,  minCandles: 20, native: false, sourceTimeframe: '1M' },
  { id: '4M',  label: '4 Minutes', seconds: 240,   interval: '4m',  multiplier: 4,  minCandles: 18, native: false, sourceTimeframe: '1M' },
  { id: '5M',  label: '5 Minutes', seconds: 300,   interval: '5m',  multiplier: 5,  minCandles: 15, native: true },
  { id: '15M', label: '15 Minutes', seconds: 900,  interval: '15m', multiplier: 15, minCandles: 15, native: true },
  { id: '30M', label: '30 Minutes', seconds: 1800, interval: '30m', multiplier: 30, minCandles: 15, native: true },
];

export const TIMEFRAME_MAP = Object.fromEntries(
  SUPPORTED_TIMEFRAMES.map(tf => [tf.id, tf])
);

export const SUPPORTED_ASSETS = [
  { symbol: 'EUR/USD', canonical: 'EURUSD', type: 'FOREX',  digits: 5, pip: 0.0001, spreadPips: 0.8 },
  { symbol: 'GBP/USD', canonical: 'GBPUSD', type: 'FOREX',  digits: 5, pip: 0.0001, spreadPips: 1.0 },
  { symbol: 'USD/JPY', canonical: 'USDJPY', type: 'FOREX',  digits: 3, pip: 0.01,   spreadPips: 0.8 },
  { symbol: 'USD/CHF', canonical: 'USDCHF', type: 'FOREX',  digits: 5, pip: 0.0001, spreadPips: 1.0 },
  { symbol: 'AUD/USD', canonical: 'AUDUSD', type: 'FOREX',  digits: 5, pip: 0.0001, spreadPips: 1.2 },
  { symbol: 'USD/CAD', canonical: 'USDCAD', type: 'FOREX',  digits: 5, pip: 0.0001, spreadPips: 1.0 },
  { symbol: 'NZD/USD', canonical: 'NZDUSD', type: 'FOREX',  digits: 5, pip: 0.0001, spreadPips: 1.5 },
  { symbol: 'EUR/GBP', canonical: 'EURGBP', type: 'FOREX',  digits: 5, pip: 0.0001, spreadPips: 1.2 },
  { symbol: 'EUR/JPY', canonical: 'EURJPY', type: 'FOREX',  digits: 3, pip: 0.01,   spreadPips: 1.0 },
  { symbol: 'GBP/JPY', canonical: 'GBPJPY', type: 'FOREX',  digits: 3, pip: 0.01,   spreadPips: 1.5 },
  { symbol: 'BTC/USD', canonical: 'BTCUSD', type: 'CRYPTO', digits: 2, pip: 1,      spreadPips: 25.0 },
  { symbol: 'ETH/USD', canonical: 'ETHUSD', type: 'CRYPTO', digits: 2, pip: 1,      spreadPips: 3.0 },
];

export const ASSET_MAP = Object.fromEntries(
  SUPPORTED_ASSETS.map(a => [a.symbol, a])
);

export const WORKER_STATUSES = {
  NOT_CONFIGURED: 'NOT CONFIGURED',
  STARTING: 'STARTING',
  HEALTHY: 'HEALTHY',
  DELAYED: 'DELAYED',
  ERROR: 'ERROR',
  PAUSED: 'PAUSED',
  DISABLED: 'DISABLED',
};

export const DEFAULT_MONITOR_CONFIG = {
  enabledAssets: ['EUR/USD', 'GBP/USD'],
  enabledTimeframes: ['1M', '2M', '3M', '4M', '5M', '15M', '30M'],
  status: 'RUNNING', // RUNNING | PAUSED
  evaluationWindow: 'ALL', // '24H' | '7D' | '30D' | 'ALL' | 'LAST_50' | 'LAST_100'
  rankingMethod: 'accuracy', // 'accuracy' | 'recentAccuracy' | 'balancedAccuracy' | 'brierScore' | 'sampleCount'
  minSampleThreshold: 30, // Provisional threshold
  engineVersion: '4.0.0',
};
