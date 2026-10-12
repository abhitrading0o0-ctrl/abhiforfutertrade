// ============================================================
// TICK ACTIVITY ENGINE (Stage 3)
// Tick volume relative context, spread assessment
// ============================================================

export function analyzeTickActivity(candles, currentSpread) {
  if (!candles || candles.length < 20) return null;

  const n = candles.length;
  const current = candles[n - 1];
  const currentTickVol = current.tickCount || current.volume || 1;

  const recentTicks = candles.slice(-20, -1).map(c => c.tickCount || c.volume || 1);
  const avgTicks = recentTicks.reduce((a, b) => a + b, 0) / recentTicks.length;
  
  const tickRatio = currentTickVol / avgTicks;
  
  let activityLevel = 'NORMAL';
  if (tickRatio > 2.0) activityLevel = 'EXTREME_HIGH';
  else if (tickRatio > 1.5) activityLevel = 'HIGH';
  else if (tickRatio < 0.5) activityLevel = 'LOW';
  
  let spreadQuality = 'NORMAL';
  if (currentSpread !== null && currentSpread !== undefined) {
    // Assuming typical EURUSD spread is 0.0001 (1 pip). Adjust if JPY.
    if (currentSpread > 0.00015) spreadQuality = 'WIDE';
    else if (currentSpread < 0.00005) spreadQuality = 'TIGHT';
  }

  return {
    currentTickVol,
    avgTicks,
    tickRatio,
    activityLevel,
    spreadQuality,
    currentSpread
  };
}
