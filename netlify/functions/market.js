// ============================================================
// Netlify Function Router: /api/market/*
// Dispatches to provider manager for market data state
// ============================================================

import { getHealthStatus, getMarketState } from './market-service.js';

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: '',
    };
  }

  const path = event.path || '';
  const params = event.queryStringParameters || {};
  const symbol = params.symbol || params.instrument || 'EUR/USD';
  const providerOverride = params.provider || null;

  let result;
  try {
    if (path.endsWith('/health') || path.includes('/health')) {
      result = await getHealthStatus(symbol, providerOverride);
    } else if (path.includes('/providers')) {
      // Return list of providers and their health
      result = { success: true, providers: ['OANDA', 'FXCM', 'Twelve Data', 'FOREX.com'] };
    } else {
      const timeframe = params.timeframe || params.tf || '1M';
      const count = parseInt(params.count || '120', 10);
      result = await getMarketState({ symbol, timeframe, count, providerOverride });
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    body: JSON.stringify(result),
  };
}

// Netlify v2 standard fetch export
export default async (req, context) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const symbol = url.searchParams.get('symbol') || url.searchParams.get('instrument') || 'EUR/USD';
  const providerOverride = url.searchParams.get('provider') || null;

  let result;
  try {
    if (path.endsWith('/health') || path.includes('/health')) {
      result = await getHealthStatus(symbol, providerOverride);
    } else if (path.includes('/providers')) {
      result = { success: true, providers: ['OANDA', 'FXCM', 'Twelve Data', 'FOREX.com'] };
    } else {
      const timeframe = url.searchParams.get('timeframe') || url.searchParams.get('tf') || '1M';
      const count = parseInt(url.searchParams.get('count') || '120', 10);
      result = await getMarketState({ symbol, timeframe, count, providerOverride });
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
