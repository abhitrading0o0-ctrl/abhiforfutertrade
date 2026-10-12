// ============================================================
// Netlify Function: /api/next-candle/health
// Tests real OANDA connection, authentication, and feed health
// ============================================================

import { getHealthStatus } from './next-candle-service.js';

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

  const health = await getHealthStatus(symbol);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    body: JSON.stringify(health),
  };
}

// Netlify v2 standard fetch export
export default async (req, context) => {
  const url = new URL(req.url);
  const symbol = url.searchParams.get('symbol') || url.searchParams.get('instrument') || 'EUR/USD';
  const health = await getHealthStatus(symbol);
  return new Response(JSON.stringify(health), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
