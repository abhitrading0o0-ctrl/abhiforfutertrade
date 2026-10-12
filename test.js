import { getHealthStatus, getMarketState } from './netlify/functions/next-candle-service.js';

async function test() {
  console.log('Testing Health...');
  const health = await getHealthStatus('EUR/USD');
  console.log(JSON.stringify(health, null, 2));

  console.log('\nTesting Market State...');
  const state = await getMarketState({ symbol: 'EUR/USD', timeframe: '1M', count: 50 });
  console.log(`Success: ${state.success}`);
  if (!state.success) console.log(state.error);
  else console.log(`Prediction: ${state.prediction?.direction} with probability ${state.prediction?.probability?.up}`);
}

test();
