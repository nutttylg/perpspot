// Binance Spot vs Perpetual Futures Price Monitor

interface TickerData {
  symbol: string;
  price: number;
  priceChangePercent: number;
}

const spotPrices = new Map<string, TickerData>();
const perpPrices = new Map<string, TickerData>();

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m',
};

// Throttle mechanism for display updates
let lastUpdateTime = 0;
const UPDATE_THROTTLE_MS = 200; // Update at most every 200ms for real-time feel
let updateScheduled = false;

// Throttled update function
function scheduleUpdate() {
  if (updateScheduled) return;

  const now = Date.now();
  const timeSinceLastUpdate = now - lastUpdateTime;

  if (timeSinceLastUpdate >= UPDATE_THROTTLE_MS) {
    // Update immediately
    displayDifferences();
    lastUpdateTime = now;
  } else {
    // Schedule update for later
    updateScheduled = true;
    setTimeout(() => {
      updateScheduled = false;
      displayDifferences();
      lastUpdateTime = Date.now();
    }, UPDATE_THROTTLE_MS - timeSinceLastUpdate);
  }
}

// Connect to Binance Spot WebSocket
function connectSpotWebSocket() {
  const ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');

  ws.onopen = () => {
    console.log(`${colors.cyan}Connected to Binance Spot WebSocket${colors.reset}`);
  };

  ws.onmessage = (event) => {
    try {
      const tickers = JSON.parse(event.data as string);
      for (const ticker of tickers) {
        if (ticker.s.endsWith('USDT')) {
          spotPrices.set(ticker.s, {
            symbol: ticker.s,
            price: parseFloat(ticker.c),
            priceChangePercent: parseFloat(ticker.P),
          });
        }
      }
      // Trigger real-time update
      scheduleUpdate();
    } catch (error) {
      console.error('Error parsing spot data:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('Spot WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('Spot WebSocket closed. Reconnecting...');
    setTimeout(connectSpotWebSocket, 5000);
  };
}

// Connect to Binance USDM Perpetual Futures WebSocket
function connectPerpWebSocket() {
  const ws = new WebSocket('wss://fstream.binance.com/ws/!ticker@arr');

  ws.onopen = () => {
    console.log(`${colors.cyan}Connected to Binance USDM Futures WebSocket${colors.reset}`);
  };

  ws.onmessage = (event) => {
    try {
      const tickers = JSON.parse(event.data as string);
      for (const ticker of tickers) {
        if (ticker.s.endsWith('USDT')) {
          perpPrices.set(ticker.s, {
            symbol: ticker.s,
            price: parseFloat(ticker.c),
            priceChangePercent: parseFloat(ticker.P),
          });
        }
      }
      // Trigger real-time update
      scheduleUpdate();
    } catch (error) {
      console.error('Error parsing perp data:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('Perp WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('Perp WebSocket closed. Reconnecting...');
    setTimeout(connectPerpWebSocket, 5000);
  };
}

// Calculate and display the differences
function displayDifferences() {
  const differences: Array<{
    symbol: string;
    spotPrice: number;
    perpPrice: number;
    difference: number;
    percentDiff: number;
  }> = [];

  // Find common symbols
  for (const [symbol, spotData] of spotPrices) {
    if (perpPrices.has(symbol)) {
      const perpData = perpPrices.get(symbol)!;
      const diff = spotData.price - perpData.price;
      const percentDiff = (diff / perpData.price) * 100;

      differences.push({
        symbol,
        spotPrice: spotData.price,
        perpPrice: perpData.price,
        difference: diff,
        percentDiff,
      });
    }
  }

  // Separate positive and negative spreads
  const positiveSpreads = differences.filter(d => d.percentDiff > 0).sort((a, b) => b.percentDiff - a.percentDiff).slice(0, 10);
  const negativeSpreads = differences.filter(d => d.percentDiff < 0).sort((a, b) => a.percentDiff - b.percentDiff).slice(0, 10);

  // Clear console
  console.clear();

  // Display header
  console.log(`\n${colors.bold}${colors.cyan}=== Binance Spot vs Perpetual Futures - Real-Time Spreads ===${colors.reset}\n`);
  console.log(`${colors.yellow}Total pairs tracked: ${differences.length}${colors.reset}\n`);

  // Positive spreads table (Spot > Perp)
  console.log(`${colors.bold}${colors.green}TOP 10 POSITIVE SPREADS (Spot > Perp)${colors.reset}`);
  console.log(`${colors.bold}${'Symbol'.padEnd(15)} | ${'Spread %'.padStart(12)}${colors.reset}`);
  console.log('-'.repeat(30));

  for (const item of positiveSpreads) {
    const symbolCol = item.symbol.padEnd(15);
    const percentCol = `${colors.green}+${item.percentDiff.toFixed(4)}%${colors.reset}`.padStart(25);
    console.log(`${symbolCol} | ${percentCol}`);
  }

  console.log('\n');

  // Negative spreads table (Perp > Spot)
  console.log(`${colors.bold}${colors.red}TOP 10 NEGATIVE SPREADS (Perp > Spot)${colors.reset}`);
  console.log(`${colors.bold}${'Symbol'.padEnd(15)} | ${'Spread %'.padStart(12)}${colors.reset}`);
  console.log('-'.repeat(30));

  for (const item of negativeSpreads) {
    const symbolCol = item.symbol.padEnd(15);
    const percentCol = `${colors.red}${item.percentDiff.toFixed(4)}%${colors.reset}`.padStart(24);
    console.log(`${symbolCol} | ${percentCol}`);
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`${colors.cyan}Real-time updates (refreshing as data arrives)${colors.reset}\n`);
}

// Main execution
console.log(`${colors.bold}${colors.yellow}Starting Binance Spot vs Perpetual Futures Monitor...${colors.reset}\n`);

connectSpotWebSocket();
connectPerpWebSocket();
