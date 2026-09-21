// Procedurally generates 1000 local algorithmic agents (Institutional Quant approach)
// Evaluates Market Regimes, Trends, Mean Reversion, and Momentum

function calculateSMA(data, period) {
    if (data.length < period) return null;
    let sum = 0;
    for (let i = data.length - period; i < data.length; i++) {
        sum += data[i];
    }
    return sum / period;
}

function calculateRSI(data, period) {
    if (data.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = data.length - period; i < data.length; i++) {
        let diff = data[i] - data[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    let rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function run1000Agents(klines) {
    // klines format: [time, open, high, low, close, volume]
    const closes = klines.map(k => parseFloat(k[4]));
    
    // Adjusted minimum candle requirement for 1M timeframe support (Binance has ~110 monthly candles)
    // Max slowMA is 37, so 40 is a safe minimum.
    if (closes.length < 40) {
        return { long: 0, short: 0, neutral: 1000, confidence: 'NEUTRAL' };
    }

    let longVotes = 0;
    let shortVotes = 0;
    let neutralVotes = 0;

    const currentClose = closes[closes.length - 1];
    const prevClose = closes[closes.length - 2];

    // 1. Trend Following Agents (250 models)
    // Varied fast and slow moving averages
    for (let fast = 3; fast <= 27; fast++) {
        for (let slow = 28; slow <= 37; slow++) {
            let fastMA = calculateSMA(closes, fast);
            let slowMA = calculateSMA(closes, slow);
            
            if (fastMA > slowMA && currentClose > fastMA) longVotes++;
            else if (fastMA < slowMA && currentClose < fastMA) shortVotes++;
            else neutralVotes++;
        }
    }

    // 2. Mean Reversion Agents (250 models)
    // Varied RSI periods and Overbought/Oversold thresholds
    let mrCount = 0;
    for (let period = 7; period <= 31; period++) {
        for (let ob = 65; ob <= 74; ob++) {
            let rsi = calculateRSI(closes, period);
            let os = 100 - ob; // e.g. 70/30, 80/20
            
            if (rsi < os) longVotes++; // Oversold, expect bounce
            else if (rsi > ob) shortVotes++; // Overbought, expect drop
            else neutralVotes++;
            mrCount++;
        }
    }

    // 3. Momentum Agents (250 models)
    // Rate of change over different lookbacks
    for (let lookback = 5; lookback <= 254; lookback++) {
        let pastClose = closes[closes.length - lookback];
        if (!pastClose) {
            neutralVotes++;
            continue;
        }
        let roc = ((currentClose - pastClose) / pastClose) * 100;
        
        if (roc > 0.5) longVotes++;
        else if (roc < -0.5) shortVotes++;
        else neutralVotes++;
    }

    // 4. Volatility/Breakout Agents (250 models)
    // Checking if current price is breaking highest/lowest of N periods
    for (let lookback = 10; lookback <= 259; lookback++) {
        let startIndex = Math.max(0, closes.length - lookback);
            let slice = closes.slice(startIndex, closes.length - 1); // exclude current
        if (slice.length === 0) {
            neutralVotes++;
            continue;
        }
        let highest = Math.max(...slice);
        let lowest = Math.min(...slice);
        
        if (currentClose > highest) longVotes++;
        else if (currentClose < lowest) shortVotes++;
        else neutralVotes++;
    }

    // Total should be around 1000, normalize it to exactly 1000 for strict reporting
    const totalRaw = longVotes + shortVotes + neutralVotes;
    const factor = 1000 / totalRaw;
    
    longVotes = Math.round(longVotes * factor);
    shortVotes = Math.round(shortVotes * factor);
    neutralVotes = 1000 - longVotes - shortVotes;

    // Calculate percentage dominance
    const dominant = Math.max(longVotes, shortVotes);
    const confidencePct = ((dominant / 1000) * 100).toFixed(1);
    
    let verdict = 'NEUTRAL';
    if (longVotes > shortVotes * 1.5) verdict = 'LONG';
    else if (shortVotes > longVotes * 1.5) verdict = 'SHORT';
    
    return {
        long: longVotes,
        short: shortVotes,
        neutral: neutralVotes,
        verdict: verdict,
        confidencePct: confidencePct
    };
}

module.exports = { run1000Agents };
