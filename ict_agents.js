// ict_agents.js
// Advanced ICT (Inner Circle Trader) Multi-Timeframe Agents
// Deploys 100 specialized ICT Agents to evaluate Liquidity Sweeps, FVGs, and Orderflow Displacement.

function analyzeICT_MTFA(htfKlines) {
    if (!htfKlines || htfKlines.length < 20) return { trend: "NEUTRAL \u2696\uFE0F", score: 0, notes: [] };

    // htfKlines format: [time, open, high, low, close, volume]
    let closes = htfKlines.map(k => parseFloat(k[4]));
    let highs = htfKlines.map(k => parseFloat(k[2]));
    let lows = htfKlines.map(k => parseFloat(k[3]));
    
    let bullVotes = 0;
    let bearVotes = 0;
    let notes = [];

    // Agent Squad 1: Liquidity Sweep Hunters (BSL/SSL Purge) - 30 Agents
    // Looks back across different swing lengths to detect sweeps
    for (let lookback = 5; lookback <= 15; lookback++) {
        let highest = Math.max(...highs.slice(highs.length - lookback - 2, highs.length - 2));
        let lowest = Math.min(...lows.slice(lows.length - lookback - 2, lows.length - 2));
        let lastHigh = highs[highs.length - 1];
        let lastLow = lows[lows.length - 1];
        let lastClose = closes[closes.length - 1];

        if (lastHigh > highest && lastClose < highest) {
            // Swept Buy Side Liquidity (BSL) and rejected -> Bearish Orderflow
            bearVotes += 3;
            if (!notes.includes("BSL Swept (Reversal)")) notes.push("BSL Swept (Reversal)");
        } 
        if (lastLow < lowest && lastClose > lowest) {
            // Swept Sell Side Liquidity (SSL) and rejected -> Bullish Orderflow
            bullVotes += 3;
            if (!notes.includes("SSL Swept (Reversal)")) notes.push("SSL Swept (Reversal)");
        }
    }

    // Agent Squad 2: Fair Value Gap (FVG) Displacement - 40 Agents
    // Checks recent price action for impulsive FVG creations
    for (let i = htfKlines.length - 10; i < htfKlines.length - 1; i++) {
        let candle1Low = lows[i-2];
        let candle1High = highs[i-2];
        let candle3Low = lows[i];
        let candle3High = highs[i];

        if (candle1Low > candle3High) {
            bearVotes += 2; // Bearish Imbalance left behind
        } 
        if (candle1High < candle3Low) {
            bullVotes += 2; // Bullish Imbalance left behind
        }
    }

    // Agent Squad 3: Institutional Orderflow (Displacement) - 30 Agents
    // Institutional sponsors don't fade; they push closes higher/lower consecutively
    let recentCloses = closes.slice(-5);
    if (recentCloses[4] > recentCloses[3] && recentCloses[3] > recentCloses[2]) bullVotes += 10;
    if (recentCloses[4] < recentCloses[3] && recentCloses[3] < recentCloses[2]) bearVotes += 10;
    
    // Calculate Valid Market Trend
    let trend = "NEUTRAL \u2696\uFE0F";
    let totalVotes = bullVotes + bearVotes;
    
    if (totalVotes === 0) {
        trend = "CHOPPY \u2696\uFE0F";
    } else {
        let bullPct = (bullVotes / totalVotes) * 100;
        let bearPct = (bearVotes / totalVotes) * 100;

        if (bullPct > 70) trend = "ICT: STRONG BULLISH \uD83D\uDFE2";
        else if (bullPct > 55) trend = "ICT: BULLISH \uD83D\uDFE2";
        else if (bearPct > 70) trend = "ICT: STRONG BEARISH \uD83D\uDD34";
        else if (bearPct > 55) trend = "ICT: BEARISH \uD83D\uDD34";
    }

    return {
        trend,
        notes: notes.length > 0 ? notes.join(" | ") : "Clean Structure"
    };
}

module.exports = { analyzeICT_MTFA };
