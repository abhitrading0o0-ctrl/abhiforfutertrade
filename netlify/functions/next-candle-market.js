// ============================================================
// Netlify Function: /api/next-candle/market
// Short-lived server-side OANDA request returning live quote,
// active forming candle, indicators, and binary prediction
// ============================================================

import { getMarketState } from './next-candle-service.js';

export async function handler(event, context) {
  // Handle CORS Preflight
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

  const params = event.queryStringParameters || {};
  const symbol = params.symbol || params.instrument || 'EUR/USD';
  const timeframe = params.timeframe || params.tf || '1M';
  const count = parseInt(params.count || '120', 10);

  const marketData = await getMarketState({ symbol, timeframe, count });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    body: JSON.stringify(marketData),
  };
}

// Netlify v2 standard fetch export
export default async (req, context) => {
  const url = new URL(req.url);
  const symbol = url.searchParams.get('symbol') || url.searchParams.get('instrument') || 'EUR/USD';
  const timeframe = url.searchParams.get('timeframe') || url.searchParams.get('tf') || '1M';
  const count = parseInt(url.searchParams.get('count') || '120', 10);

  const marketData = await getMarketState({ symbol, timeframe, count });

  return new Response(JSON.stringify(marketData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
