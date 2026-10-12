// ============================================================
// Netlify Function Router: /api/next-candle/*
// Dispatches to health or market endpoint based on URL subpath
// ============================================================

import { getHealthStatus, getMarketState } from './next-candle-service.js';

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  const path = event.path || '';
  const params = event.queryStringParameters || {};
  const symbol = params.symbol || params.instrument || 'EUR/USD';

  let result;
  if (path.endsWith('/health') || path.includes('/health')) {
    result = await getHealthStatus(symbol);
  } else {
    const timeframe = params.timeframe || params.tf || '1M';
    const count = parseInt(params.count || '120', 10);
    result = await getMarketState({ symbol, timeframe, count });
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

export default async (req, context) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const symbol = url.searchParams.get('symbol') || url.searchParams.get('instrument') || 'EUR/USD';

  let result;
  if (path.endsWith('/health') || path.includes('/health')) {
    result = await getHealthStatus(symbol);
  } else {
    const timeframe = url.searchParams.get('timeframe') || url.searchParams.get('tf') || '1M';
    const count = parseInt(url.searchParams.get('count') || '120', 10);
    result = await getMarketState({ symbol, timeframe, count });
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
