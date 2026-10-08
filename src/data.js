// ============================================================
// ForFuture — Mock Data & Data Architecture
// All data structures are designed for easy API replacement
// ============================================================

export const ASSET_DATABASE = [
  { ticker: 'AAPL', name: 'Apple Inc.', type: 'Stock', exchange: 'NASDAQ', sector: 'Technology', logo: 'A' },
  { ticker: 'MSFT', name: 'Microsoft Corp.', type: 'Stock', exchange: 'NASDAQ', sector: 'Technology', logo: 'M' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', type: 'Stock', exchange: 'NASDAQ', sector: 'Technology', logo: 'G' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', type: 'Stock', exchange: 'NASDAQ', sector: 'Consumer', logo: 'A' },
  { ticker: 'TSLA', name: 'Tesla Inc.', type: 'Stock', exchange: 'NASDAQ', sector: 'Automotive', logo: 'T' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', type: 'Stock', exchange: 'NASDAQ', sector: 'Semiconductors', logo: 'N' },
  { ticker: 'META', name: 'Meta Platforms Inc.', type: 'Stock', exchange: 'NASDAQ', sector: 'Technology', logo: 'M' },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', type: 'Stock', exchange: 'NYSE', sector: 'Financials', logo: 'J' },
  { ticker: 'V', name: 'Visa Inc.', type: 'Stock', exchange: 'NYSE', sector: 'Financials', logo: 'V' },
  { ticker: 'JNJ', name: 'Johnson & Johnson', type: 'Stock', exchange: 'NYSE', sector: 'Healthcare', logo: 'J' },
  { ticker: 'WMT', name: 'Walmart Inc.', type: 'Stock', exchange: 'NYSE', sector: 'Consumer', logo: 'W' },
  { ticker: 'BTC/USD', name: 'Bitcoin', type: 'Crypto', exchange: 'Global', sector: 'Cryptocurrency', logo: '₿' },
  { ticker: 'ETH/USD', name: 'Ethereum', type: 'Crypto', exchange: 'Global', sector: 'Cryptocurrency', logo: 'Ξ' },
  { ticker: 'SOL/USD', name: 'Solana', type: 'Crypto', exchange: 'Global', sector: 'Cryptocurrency', logo: 'S' },
  { ticker: 'EUR/USD', name: 'Euro/US Dollar', type: 'Forex', exchange: 'OANDA', sector: 'Currency', logo: '€' },
  { ticker: 'GBP/USD', name: 'British Pound/US Dollar', type: 'Forex', exchange: 'OANDA', sector: 'Currency', logo: '£' },
  { ticker: 'USD/JPY', name: 'US Dollar/Japanese Yen', type: 'Forex', exchange: 'OANDA', sector: 'Currency', logo: '¥' },
  { ticker: 'USD/CHF', name: 'US Dollar/Swiss Franc', type: 'Forex', exchange: 'OANDA', sector: 'Currency', logo: '₣' },
  { ticker: 'AUD/USD', name: 'Australian Dollar/US Dollar', type: 'Forex', exchange: 'OANDA', sector: 'Currency', logo: 'A$' },
  { ticker: 'USD/CAD', name: 'US Dollar/Canadian Dollar', type: 'Forex', exchange: 'OANDA', sector: 'Currency', logo: 'C$' },
  { ticker: 'NZD/USD', name: 'New Zealand Dollar/US Dollar', type: 'Forex', exchange: 'OANDA', sector: 'Currency', logo: 'NZ$' },
  { ticker: 'EUR/GBP', name: 'Euro/British Pound', type: 'Forex', exchange: 'OANDA', sector: 'Currency', logo: '€' },
  { ticker: 'EUR/JPY', name: 'Euro/Japanese Yen', type: 'Forex', exchange: 'OANDA', sector: 'Currency', logo: '€' },
  { ticker: 'GBP/JPY', name: 'British Pound/Japanese Yen', type: 'Forex', exchange: 'OANDA', sector: 'Currency', logo: '£' },
  { ticker: 'USD/INR', name: 'US Dollar/Indian Rupee', type: 'Forex', exchange: 'OANDA', sector: 'Currency', logo: '₹' },
  { ticker: 'EUR/CHF', name: 'Euro/Swiss Franc', type: 'Forex', exchange: 'OANDA', sector: 'Currency', logo: '€' },
  { ticker: 'AUD/JPY', name: 'Australian Dollar/Japanese Yen', type: 'Forex', exchange: 'OANDA', sector: 'Currency', logo: 'A$' },
  { ticker: 'CAD/JPY', name: 'Canadian Dollar/Japanese Yen', type: 'Forex', exchange: 'OANDA', sector: 'Currency', logo: 'C$' },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF', type: 'ETF', exchange: 'NYSE', sector: 'Index', logo: 'S' },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust', type: 'ETF', exchange: 'NASDAQ', sector: 'Index', logo: 'Q' },
  { ticker: 'GLD', name: 'SPDR Gold Shares', type: 'ETF', exchange: 'NYSE', sector: 'Commodity', logo: 'G' },
  { ticker: 'XAU/USD', name: 'Gold Spot', type: 'Commodity', exchange: 'Global', sector: 'Metal', logo: 'Au' },
  { ticker: 'CL', name: 'Crude Oil WTI', type: 'Commodity', exchange: 'NYMEX', sector: 'Energy', logo: '⛽' },
  { ticker: 'DX', name: 'US Dollar Index', type: 'Index', exchange: 'ICE', sector: 'Currency', logo: '$' },
  { ticker: '^GSPC', name: 'S&P 500', type: 'Index', exchange: 'NYSE', sector: 'Index', logo: 'SP' },
  { ticker: '^NDX', name: 'NASDAQ 100', type: 'Index', exchange: 'NASDAQ', sector: 'Index', logo: 'NQ' },
];

// Generate realistic-looking price data
function generatePrice(base, volatility = 0.02) {
  const change = (Math.random() - 0.48) * volatility * base;
  return base + change;
}

function rnd(min, max, dec = 2) {
  return +(min + Math.random() * (max - min)).toFixed(dec);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Timeframe to seconds mapping
export function getTimeframeSeconds(tf) {
  switch (tf) {
    case '1m': return 60;
    case '3m': return 3 * 60;
    case '5m': return 5 * 60;
    case '15m': return 15 * 60;
    case '30m': return 30 * 60;
    case '1H': return 3600;
    case '2H': return 2 * 3600;
    case '4H': return 4 * 3600;
    case '1D': return 86400;
    case '1W': return 7 * 86400;
    case '1M': return 30 * 86400;
    default: return 86400;
  }
}

// Generate OHLCV candlestick data with deep history
export function generateCandleData(count = 1000, basePrice = 180, timeframe = '1D', endTimeSeconds = Math.floor(Date.now() / 1000)) {
  const step = getTimeframeSeconds(timeframe);
  const data = [];

  // Generate random walk backward from basePrice to have realistic historical trajectory
  let currentClose = basePrice;
  const closes = new Array(count);
  closes[count - 1] = currentClose;

  for (let i = count - 2; i >= 0; i--) {
    // Volatility calibrated by timeframe
    const baseVol = step <= 3600 ? 0.003 : step <= 86400 ? 0.012 : 0.025;
    const shock = (Math.random() - 0.495) * baseVol;
    currentClose = currentClose / (1 + shock);
    // Boundary check so price doesn't go negative
    if (currentClose < 1) currentClose = 1;
    closes[i] = currentClose;
  }

  // Ensure timestamps are cleanly aligned to step
  const alignedEnd = Math.floor(endTimeSeconds / step) * step;
  const startTime = alignedEnd - (count - 1) * step;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * step;
    const c = closes[i];
    const prevC = i > 0 ? closes[i - 1] : c * (1 - 0.002);
    const o = prevC;
    const volatility = (step <= 3600 ? 0.003 : 0.01) + Math.random() * (step <= 3600 ? 0.005 : 0.015);
    const h = Math.max(o, c) * (1 + Math.random() * volatility);
    const l = Math.min(o, c) * (1 - Math.random() * volatility);
    const volume = Math.floor(50000 + Math.random() * 800000);

    data.push({
      time,
      open: +o.toFixed(2),
      high: +h.toFixed(2),
      low: +l.toFixed(2),
      close: +c.toFixed(2),
      volume,
    });
  }
  return data;
}

// Prepend earlier historical candles when scrolling back (infinite scroll)
export function prependEarlierCandles(firstCandle, count = 500, timeframe = '1D') {
  if (!firstCandle) return [];
  const step = getTimeframeSeconds(timeframe);
  const endTimeSeconds = firstCandle.time - step;
  const basePrice = firstCandle.open;
  return generateCandleData(count, basePrice, timeframe, endTimeSeconds);
}

export function generateLineData(count = 1000, basePrice = 180, timeframe = '1D') {
  const candles = generateCandleData(count, basePrice, timeframe);
  return candles.map(c => ({ time: c.time, value: c.close }));
}

export function generateVolumeData(candleData) {
  return candleData.map(c => ({
    time: c.time,
    value: c.volume,
    color: c.close >= c.open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
  }));
}

// Generate realistic simulated equity curve for backtesting
export function generateEquityCurveData(startCapital = 100000, endReturnPct = 0.74, startDate = '2024-01-02', endDate = '2026-09-28') {
  const start = Math.floor(new Date(startDate).getTime() / 1000);
  const end = Math.floor(new Date(endDate).getTime() / 1000);
  const totalDays = Math.max(10, Math.floor((end - start) / 86400));
  const data = [];

  const targetEndCapital = startCapital * (1 + endReturnPct);
  const dailyDrift = Math.pow(targetEndCapital / startCapital, 1 / totalDays) - 1;

  let currentVal = startCapital;

  for (let i = 0; i <= totalDays; i++) {
    const time = start + i * 86400;
    const d = new Date(time * 1000);
    const dayOfWeek = d.getUTCDay();
    // Skip weekends for realistic trading days
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const noise = (Math.random() - 0.48) * 0.01;
    currentVal = currentVal * (1 + dailyDrift + noise);

    data.push({
      time,
      value: Math.round(currentVal),
    });
  }

  if (data.length > 0) {
    data[data.length - 1].value = Math.round(targetEndCapital);
  }

  return data;
}

// Generate asset-specific mock data on demand
export function getAssetData(ticker) {
  const asset = ASSET_DATABASE.find(a => a.ticker === ticker) || ASSET_DATABASE[0];

  // Deterministic-ish base prices
  const basePrices = {
    'AAPL': 237.45, 'MSFT': 478.92, 'GOOGL': 192.33, 'AMZN': 218.76, 'TSLA': 312.54,
    'NVDA': 148.67, 'META': 632.18, 'JPM': 247.85, 'V': 312.45, 'JNJ': 158.23,
    'WMT': 92.45, 'BTC/USD': 97432.50, 'ETH/USD': 3847.25, 'SOL/USD': 198.43,
    'EUR/USD': 1.0847, 'GBP/USD': 1.2734, 'USD/JPY': 154.32,
    'USD/CHF': 0.8920, 'AUD/USD': 0.6540, 'USD/CAD': 1.3610,
    'NZD/USD': 0.5980, 'EUR/GBP': 0.8515, 'EUR/JPY': 167.35,
    'GBP/JPY': 196.50, 'USD/INR': 83.50, 'EUR/CHF': 0.9675,
    'AUD/JPY': 100.90, 'CAD/JPY': 113.35,
    'SPY': 592.87, 'QQQ': 518.43, 'GLD': 242.56,
    'XAU/USD': 2648.30, 'CL': 72.45, 'DX': 103.87,
    '^GSPC': 5937.24, '^NDX': 20842.56,
  };

  const base = basePrices[ticker] || 100;
  const price = generatePrice(base, 0.001);
  const change = price - base;
  const changePct = (change / base) * 100;

  return {
    ...asset,
    price: +price.toFixed(base > 1000 ? 2 : base > 10 ? 2 : 4),
    change: +change.toFixed(base > 1000 ? 2 : base > 10 ? 2 : 4),
    changePct: +changePct.toFixed(2),
    volume: Math.floor(Math.random() * 50000000) + 1000000,
    marketCap: base > 100 ? `${rnd(100, 3500, 0)}B` : null,
    high24h: +(price * (1 + rnd(0.005, 0.02))).toFixed(2),
    low24h: +(price * (1 - rnd(0.005, 0.02))).toFixed(2),
    open: +base.toFixed(2),
    prevClose: +base.toFixed(2),
    volatility: rnd(15, 55, 1),
    beta: rnd(0.6, 1.8, 2),
    pe: base > 50 ? rnd(12, 45, 1) : null,
    marketStatus: ticker.includes('/') && !ticker.startsWith('^') ? '24H' : 'OPEN',
    lastUpdate: Date.now(),
  };
}

// Technical indicator data
export function getTechnicalData(ticker) {
  const signals = ['BULLISH', 'BEARISH', 'NEUTRAL'];
  const strengths = ['Strong', 'Moderate', 'Weak'];

  const createIndicator = (name, params, category) => {
    const signal = pick(signals);
    return {
      name,
      params,
      category,
      value: rnd(10, 90, 2),
      signal,
      strength: pick(strengths),
      direction: signal === 'BULLISH' ? '↑' : signal === 'BEARISH' ? '↓' : '→',
      reason: signal === 'BULLISH'
        ? pick(['Above signal line', 'Trending upward', 'Momentum increasing', 'Cross above threshold', 'Positive divergence'])
        : signal === 'BEARISH'
          ? pick(['Below signal line', 'Trending downward', 'Momentum decreasing', 'Cross below threshold', 'Negative divergence'])
          : pick(['Near neutral zone', 'No clear direction', 'Consolidating', 'Mixed signals']),
      lastUpdate: `${rnd(1, 30, 0)}s ago`,
    };
  };

  return {
    trend: [
      createIndicator('SMA', '20, 50, 200', 'TREND'),
      createIndicator('EMA', '9, 21, 55', 'TREND'),
      createIndicator('WMA', '20', 'TREND'),
      createIndicator('VWMA', '20', 'TREND'),
      createIndicator('MACD', '12, 26, 9', 'TREND'),
      createIndicator('ADX', '14', 'TREND'),
      createIndicator('Parabolic SAR', '0.02, 0.2', 'TREND'),
      createIndicator('Ichimoku', '9, 26, 52', 'TREND'),
    ],
    momentum: [
      createIndicator('RSI', '14', 'MOMENTUM'),
      createIndicator('Stochastic', '14, 3, 3', 'MOMENTUM'),
      createIndicator('Williams %R', '14', 'MOMENTUM'),
      createIndicator('CCI', '20', 'MOMENTUM'),
      createIndicator('ROC', '12', 'MOMENTUM'),
      createIndicator('MFI', '14', 'MOMENTUM'),
    ],
    volatility: [
      createIndicator('Bollinger Bands', '20, 2', 'VOLATILITY'),
      createIndicator('ATR', '14', 'VOLATILITY'),
      createIndicator('Keltner Channels', '20, 1.5', 'VOLATILITY'),
      createIndicator('Donchian Channels', '20', 'VOLATILITY'),
      createIndicator('Standard Deviation', '20', 'VOLATILITY'),
    ],
    volume: [
      createIndicator('Volume', '—', 'VOLUME'),
      createIndicator('OBV', '—', 'VOLUME'),
      createIndicator('VWAP', '—', 'VOLUME'),
      createIndicator('CMF', '20', 'VOLUME'),
      createIndicator('A/D Line', '—', 'VOLUME'),
    ],
    structure: [
      createIndicator('Support/Resistance', 'Auto', 'STRUCTURE'),
      createIndicator('Pivot Points', 'Standard', 'STRUCTURE'),
      createIndicator('Fibonacci Retracement', '0.236–0.786', 'STRUCTURE'),
      createIndicator('Swing Points', 'Auto', 'STRUCTURE'),
      createIndicator('Trend Structure', 'HH/HL/LH/LL', 'STRUCTURE'),
    ],
    orderFlow: [
      createIndicator('Bid/Ask Ratio', '—', 'ORDER_FLOW'),
      createIndicator('Delta', '—', 'ORDER_FLOW'),
      createIndicator('CVD', '—', 'ORDER_FLOW'),
      createIndicator('Imbalance', '—', 'ORDER_FLOW'),
      createIndicator('Liquidity Zones', 'Auto', 'ORDER_FLOW'),
    ],
  };
}

// Strategy data
export function getStrategyData(ticker) {
  const strategies = [
    {
      name: 'EMA Crossover (9/21)',
      family: 'Moving Average',
      conditionsMet: ['EMA 9 above EMA 21', 'Price above both EMAs', 'Positive slope'],
      conditionsUnmet: ['Volume confirmation below threshold'],
    },
    {
      name: 'RSI Reversal',
      family: 'Momentum',
      conditionsMet: ['RSI above 30', 'RSI rising from oversold'],
      conditionsUnmet: ['Price confirmation pending', 'Volume spike not detected'],
    },
    {
      name: 'MACD Crossover',
      family: 'Trend',
      conditionsMet: ['MACD above signal', 'Histogram positive'],
      conditionsUnmet: ['Above zero line — partial'],
    },
    {
      name: 'Bollinger Band Squeeze',
      family: 'Volatility',
      conditionsMet: ['Bandwidth below 20-period average', 'Compression phase detected'],
      conditionsUnmet: ['Breakout direction undetermined', 'Volume confirmation pending'],
    },
    {
      name: 'VWAP Reclaim',
      family: 'Intraday',
      conditionsMet: ['Price reclaimed VWAP', 'Above VWAP for 3+ bars'],
      conditionsUnmet: ['Session volume below average'],
    },
    {
      name: 'EMA + RSI + MACD Confluence',
      family: 'Multi-Indicator',
      conditionsMet: ['EMA trend aligned', 'RSI above 50'],
      conditionsUnmet: ['MACD histogram declining', 'Divergence detected'],
    },
    {
      name: 'Breakout + Volume',
      family: 'Breakout',
      conditionsMet: ['Above resistance level', 'Volume 1.5x average'],
      conditionsUnmet: ['Follow-through pending'],
    },
    {
      name: 'Pullback to EMA 21',
      family: 'Pullback',
      conditionsMet: ['Uptrend intact', 'Price near EMA 21'],
      conditionsUnmet: ['Bullish candle confirmation needed', 'Support hold not confirmed'],
    },
    {
      name: 'ADX Trend Strength',
      family: 'Trend Following',
      conditionsMet: ['ADX above 25'],
      conditionsUnmet: ['+DI/-DI crossover not aligned', 'Momentum weakening'],
    },
    {
      name: 'Support/Resistance Bounce',
      family: 'S/R',
      conditionsMet: ['Near key support level', 'Multiple test confirmations'],
      conditionsUnmet: ['Volume confirmation below threshold', 'Candle pattern unclear'],
    },
  ];

  return strategies.map(s => {
    const signals = ['BULLISH', 'BEARISH', 'NEUTRAL'];
    const signal = pick(signals);
    const allConditions = [...s.conditionsMet, ...s.conditionsUnmet];
    const metCount = s.conditionsMet.length;
    const totalCount = allConditions.length;

    return {
      ...s,
      signal,
      strength: pick(['Strong', 'Moderate', 'Weak']),
      reasoning: signal === 'BULLISH'
        ? `${metCount}/${totalCount} conditions met. Primary conditions aligned for bullish entry.`
        : signal === 'BEARISH'
          ? `${metCount}/${totalCount} conditions met. Key bearish factors dominating.`
          : `${metCount}/${totalCount} conditions met. Insufficient confluence for directional bias.`,
      timestamp: `${rnd(1, 45, 0)}s ago`,
      indicators: ['EMA', 'RSI', 'MACD', 'Volume'].slice(0, rnd(2, 4, 0)),
    };
  });
}

// Multi-timeframe matrix data
export function getMultiTimeframeData() {
  const timeframes = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'];
  const categories = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Structure', 'Order Flow'];
  const signals = ['bullish', 'bearish', 'neutral', 'na'];

  const matrix = {};
  categories.forEach(cat => {
    matrix[cat] = {};
    timeframes.forEach(tf => {
      matrix[cat][tf] = pick(signals);
    });
  });

  return { timeframes, categories, matrix };
}

// News data
export function getNewsData(ticker) {
  const categories = ['earnings', 'macro', 'analyst', 'product', 'regulatory', 'industry'];
  const headlines = [
    { headline: 'Q3 earnings beat expectations with revenue up 12% YoY', category: 'earnings', source: 'Reuters' },
    { headline: 'Fed signals potential rate adjustment in upcoming meeting', category: 'macro', source: 'Bloomberg' },
    { headline: 'Analyst upgrades to Overweight, raises price target to $280', category: 'analyst', source: 'Barron\'s' },
    { headline: 'New product line announcement expected at upcoming conference', category: 'product', source: 'TechCrunch' },
    { headline: 'Regulatory review of acquisition enters final phase', category: 'regulatory', source: 'WSJ' },
    { headline: 'Sector-wide momentum continues amid positive economic data', category: 'industry', source: 'Financial Times' },
    { headline: 'Institutional buying detected across large-cap technology names', category: 'industry', source: 'MarketWatch' },
    { headline: 'Supply chain improvements reported across major technology firms', category: 'product', source: 'CNBC' },
    { headline: 'Dividend increase announced, yielding 1.2% forward', category: 'earnings', source: 'Seeking Alpha' },
    { headline: 'Options market shows elevated put-call ratio ahead of earnings', category: 'macro', source: 'The Street' },
    { headline: 'Global trade volumes rise, supporting export-oriented companies', category: 'macro', source: 'Reuters' },
    { headline: 'New AI partnership announced with major cloud provider', category: 'product', source: 'VentureBeat' },
  ];

  return headlines.map((h, i) => ({
    ...h,
    time: `${rnd(1, 60, 0)}m ago`,
    relevance: pick(['high', 'medium', 'low']),
    asset: ticker,
    breaking: i === 0 && Math.random() > 0.7,
  }));
}

// Fundamental data for stocks
export function getFundamentalData(ticker) {
  return {
    overview: {
      sector: 'Technology',
      industry: 'Consumer Electronics',
      employees: '164,000',
      founded: '1976',
      headquarters: 'Cupertino, CA',
      ceo: 'Tim Cook',
      description: 'Designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.',
    },
    income: {
      revenue: { current: '$394.3B', prev: '$383.3B', change: '+2.9%' },
      netIncome: { current: '$101.0B', prev: '$97.0B', change: '+4.1%' },
      eps: { current: '$6.57', prev: '$6.16', change: '+6.7%' },
      ebitda: { current: '$134.7B', prev: '$130.5B', change: '+3.2%' },
      grossMargin: { current: '46.2%', prev: '44.1%', change: '+2.1pp' },
      operatingMargin: { current: '30.7%', prev: '29.8%', change: '+0.9pp' },
      netMargin: { current: '25.6%', prev: '25.3%', change: '+0.3pp' },
    },
    balance: {
      totalCash: '$61.5B',
      totalDebt: '$108.0B',
      netDebt: '$46.5B',
      debtToEquity: '1.87',
      currentRatio: '0.99',
      bookValue: '$3.77',
    },
    valuation: {
      pe: '38.2',
      forwardPE: '34.5',
      peg: '2.87',
      priceToSales: '9.82',
      priceToBook: '62.7',
      evToEbitda: '28.9',
      evToRevenue: '9.6',
    },
    growth: {
      revenueGrowth: '+2.9%',
      earningsGrowth: '+6.7%',
      fcfGrowth: '+12.3%',
      quarterlyRevGrowth: '+4.8%',
      quarterlyEarningsGrowth: '+8.2%',
    },
    returns: {
      roe: '171.9%',
      roa: '28.3%',
      roic: '56.4%',
    },
    dividends: {
      yield: '0.44%',
      annualPayout: '$1.00',
      payoutRatio: '15.2%',
      exDate: '2026-11-08',
      payDate: '2026-11-14',
    },
    source: 'Simulated Financial Data',
    period: 'FY 2025 (TTM)',
    lastUpdate: 'Sep 28, 2026',
  };
}

// Statistics data
export function getStatisticsData(ticker) {
  return {
    returns: [
      { period: '1 Day', value: `${rnd(-3, 3)}%` },
      { period: '1 Week', value: `${rnd(-5, 5)}%` },
      { period: '1 Month', value: `${rnd(-8, 10)}%` },
      { period: '3 Months', value: `${rnd(-15, 20)}%` },
      { period: '6 Months', value: `${rnd(-10, 25)}%` },
      { period: 'YTD', value: `${rnd(-5, 35)}%` },
      { period: '1 Year', value: `${rnd(-10, 50)}%` },
      { period: '3 Years', value: `${rnd(-20, 80)}%` },
    ],
    risk: {
      volatility30d: `${rnd(15, 55, 1)}%`,
      volatility90d: `${rnd(18, 45, 1)}%`,
      beta: rnd(0.6, 1.8, 2),
      sharpe: rnd(-0.5, 3.0, 2),
      sortino: rnd(-0.3, 4.0, 2),
      maxDrawdown: `${rnd(-45, -5, 1)}%`,
      calmar: rnd(0.1, 3.0, 2),
      zScore: rnd(-2.5, 2.5, 2),
      var95: `${rnd(-5, -1, 2)}%`,
      cvar95: `${rnd(-8, -2, 2)}%`,
    },
    correlation: [
      { asset: 'S&P 500', value: rnd(0.3, 0.95, 2) },
      { asset: 'NASDAQ 100', value: rnd(0.5, 0.98, 2) },
      { asset: 'BTC/USD', value: rnd(-0.1, 0.5, 2) },
      { asset: 'Gold', value: rnd(-0.3, 0.3, 2) },
      { asset: '10Y Treasury', value: rnd(-0.5, 0.2, 2) },
    ],
  };
}

// AI Research data
export function getAIResearchData(ticker) {
  return {
    lastUpdate: '12s ago',
    overallSentiment: pick(['Moderately Bullish', 'Slightly Bearish', 'Neutral', 'Cautiously Bullish']),
    confidence: rnd(55, 85, 0),
    sections: {
      context: 'The asset is trading within an established uptrend channel on higher timeframes, with recent price action consolidating near resistance. Volume has been declining during consolidation, which is typical of healthy continuation patterns. The broader market environment remains supportive with risk-on sentiment.',
      whatChanged: [
        'RSI divergence detected on 4H timeframe, suggesting momentum may be slowing',
        'Institutional options flow showed elevated call buying over the past 48 hours',
        'Key moving averages are converging, indicating a potential breakout setup',
        'Sector rotation data shows continued inflows into technology names',
      ],
      bullishCase: [
        'Price holding above all major moving averages (20/50/200 EMA)',
        'Volume profile shows strong support at current levels',
        'Positive earnings revision trend over last 90 days',
        'Relative strength vs. benchmark is improving',
        'Institutional accumulation detected in recent sessions',
      ],
      bearishCase: [
        'RSI bearish divergence on 4H could lead to short-term pullback',
        'Approaching major resistance zone with decreasing volume',
        'Sector ETF showing signs of exhaustion',
        'Elevated valuations relative to historical averages',
      ],
      uncertainty: [
        'Upcoming Fed decision could significantly shift market dynamics',
        'Options expiration this week may cause elevated volatility',
        'Earnings revision trend may not sustain if macro conditions deteriorate',
      ],
      risks: [
        'Broad market correction would likely impact regardless of individual strength',
        'Regulatory developments in the sector remain a tail risk',
        'Currency headwinds could pressure international revenue streams',
      ],
      upcomingEvents: [
        { event: 'Earnings Report', date: 'Oct 24, 2026', impact: 'high' },
        { event: 'Fed Rate Decision', date: 'Nov 2, 2026', impact: 'high' },
        { event: 'Product Launch Event', date: 'Oct 15, 2026', impact: 'medium' },
        { event: 'Options Expiration', date: 'Oct 4, 2026', impact: 'medium' },
      ],
    },
  };
}

// Heatmap data
export function getHeatmapData() {
  const sectors = [
    { name: 'Technology', tickers: ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META', 'AVGO', 'CRM', 'ADBE', 'ORCL', 'INTC'] },
    { name: 'Healthcare', tickers: ['JNJ', 'UNH', 'PFE', 'ABT', 'LLY', 'TMO', 'MRK', 'ABBV'] },
    { name: 'Financials', tickers: ['JPM', 'BAC', 'V', 'MA', 'GS', 'MS', 'AXP', 'BLK'] },
    { name: 'Consumer', tickers: ['AMZN', 'TSLA', 'WMT', 'HD', 'NKE', 'COST', 'SBUX', 'MCD'] },
    { name: 'Energy', tickers: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'OXY'] },
    { name: 'Industrials', tickers: ['CAT', 'BA', 'UPS', 'HON', 'GE', 'RTX', 'LMT'] },
  ];

  return sectors.map(s => ({
    ...s,
    tiles: s.tickers.map(t => ({
      ticker: t,
      name: ASSET_DATABASE.find(a => a.ticker === t)?.name || t,
      change: rnd(-5, 5, 2),
      price: rnd(50, 500, 2),
      volume: `${rnd(1, 50, 1)}M`,
    })),
  }));
}

// Watchlist data
export function getWatchlistData() {
  return ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'BTC/USD', 'ETH/USD', 'SPY', 'EUR/USD', 'XAU/USD'].map(ticker => {
    const asset = getAssetData(ticker);
    return {
      ...asset,
      technicalSignal: pick(['BULLISH', 'BEARISH', 'NEUTRAL']),
      strategySignal: pick(['BULLISH', 'BEARISH', 'NEUTRAL']),
      hasNews: Math.random() > 0.5,
    };
  });
}

// Backtesting results
export function getBacktestResults() {
  return {
    strategy: 'EMA Crossover (9/21)',
    asset: 'AAPL',
    timeframe: '1D',
    period: 'Jan 2024 – Sep 2026',
    startingCapital: '$100,000',
    totalReturn: `${rnd(15, 85, 1)}%`,
    annualReturn: `${rnd(8, 35, 1)}%`,
    winRate: `${rnd(45, 68, 1)}%`,
    profitFactor: rnd(1.2, 2.8, 2),
    maxDrawdown: `${rnd(-25, -8, 1)}%`,
    sharpe: rnd(0.8, 2.5, 2),
    sortino: rnd(1.0, 3.5, 2),
    totalTrades: Math.floor(rnd(40, 200, 0)),
    avgTrade: `${rnd(0.2, 1.5, 2)}%`,
    avgWin: `${rnd(1.5, 4, 2)}%`,
    avgLoss: `${rnd(-3, -0.5, 2)}%`,
    fees: '$1,240',
    slippage: '$890',
    status: 'HISTORICAL',
    source: 'Simulated Backtest Engine',
    disclaimer: 'Past performance does not guarantee future results. This backtest uses simulated data.',
  };
}
