import { defineConfig, loadEnv } from 'vite';
import { getHealthStatus, getMarketState } from './netlify/functions/market-service.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
  plugins: [
    {
      name: 'next-candle-api-dev-server',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url.startsWith('/api/market/') && !req.url.startsWith('/api/next-candle/')) {
            return next();
          }

          const parsedUrl = new URL(req.url, 'http://localhost:5173');
          const pathname = parsedUrl.pathname;
          const params = Object.fromEntries(parsedUrl.searchParams.entries());

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

          try {
            if (pathname.endsWith('/health')) {
              const symbol = params.symbol || params.instrument || 'EUR/USD';
              const provider = params.provider || null;
              const result = await getHealthStatus(symbol, provider);
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } else if (pathname.endsWith('/state') || pathname.endsWith('/market')) {
              const symbol = params.symbol || params.instrument || 'EUR/USD';
              const timeframe = params.timeframe || params.tf || '1M';
              const count = parseInt(params.count || '120', 10);
              const provider = params.provider || null;
              const result = await getMarketState({ symbol, timeframe, count, providerOverride: provider });
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } else if (pathname.endsWith('/providers')) {
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, providers: ['OANDA', 'FXCM', 'Twelve Data', 'FOREX.com'] }));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Endpoint not found' }));
            }
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      },
    },
  ],
  server: {
    port: 5173,
  },
  };
});
