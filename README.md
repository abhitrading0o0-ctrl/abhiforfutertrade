# ForFuture — Financial Research & Trading Terminal

High-performance institutional-grade financial research and Next-Candle algorithmic prediction terminal featuring real-time data streaming, authoritative UTC/IST clock synchronization, and a fault-tolerant multi-provider market data failover architecture.

---

## Key Features

- **Next Candle Prediction Engine:** Data-driven binary direction ensemble (UP / DOWN) with real-time probability calibration, technical consensus, momentum indicators, and walk-forward precision evaluation.
- **Multi-Provider Failover Architecture:** Automatic failover and health tracking for Forex feeds with zero downtime across:
  1. **OANDA** (Primary)
  2. **FXCM** (Backup 1)
  3. **Twelve Data** (Backup 2)
  4. **FOREX.com** (Backup 3)
- **Authoritative Clock Synchronization:** Dynamic drift measurement and sub-second candle boundary countdown alignment independent of data providers.
- **Interactive Multi-Timeframe Charting:** High-fps canvas rendering via Lightweight Charts with overlay indicators (EMA 9/21, VWAP, SMA), drawing tools, and layout matrices.
- **Comprehensive Research Terminal:** Order flow, volatility indicators, multi-timeframe correlation, and economic news telemetry.

---

## Tech Stack

- **Frontend:** Vanilla JS / HTML5 / CSS3, Vite, Lightweight Charts
- **Backend:** Node.js, WebSocket Server (`ws`), Concurrently
- **Data Integrations:** OANDA v20 REST/Streaming, FXCM, Twelve Data, FOREX.com

---

## Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/abhitrading0o0-ctrl/abhiforfutertrade.git
cd abhiforfutertrade
npm install
```

### 2. Configure Environment
Copy the example configuration file:
```bash
cp .env.example .env
```
Add your API tokens to `.env`:
```env
PORT=3001
DATA_MODE=LIVE
FAILOVER_ENABLED=true

# OANDA (Primary)
OANDA_API_TOKEN=your_token_here
OANDA_ACCOUNT_ID=your_account_id_here
OANDA_ENV=practice

# FXCM (Backup 1)
FXCM_API_TOKEN=your_fxcm_token_here
FXCM_ENV=demo

# Twelve Data (Backup 2)
TWELVE_DATA_API_KEY=your_twelve_data_key_here

# FOREX.com (Backup 3)
FOREX_COM_USERNAME=your_username_here
FOREX_COM_PASSWORD=your_password_here
FOREX_COM_APP_KEY=your_app_key_here
FOREX_COM_ENV=demo
```

### 3. Run Development Server
```bash
npm start
```
- Web Application: [http://localhost:5173](http://localhost:5173)
- WebSocket & Market Data Engine: `ws://localhost:3001`
- Provider Status API: `http://localhost:3001/api/providers`

---

## Production Build

```bash
npm run build
npm run preview
```
