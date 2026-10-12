async function testBiquote() {
  try {
    console.log('Testing /health...');
    const health = await fetch('https://biquote.io/health').then(r => r.json());
    console.log('Health:', health);

    console.log('\nTesting /api/EURUSD?allowStale=false...');
    const quote = await fetch('https://biquote.io/api/EURUSD?allowStale=false').then(r => r.json());
    console.log('Quote:', quote);

    console.log('\nTesting /api/EURUSD/ohlc?interval=1m&limit=2...');
    const ohlc = await fetch('https://biquote.io/api/EURUSD/ohlc?interval=1m&limit=2').then(r => r.json());
    console.log('OHLC:', ohlc);
  } catch (err) {
    console.error('Test failed:', err.message);
  }
}
testBiquote();
