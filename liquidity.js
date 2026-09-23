const { analyzeICT_MTFA } = require('./ict_agents');
function analyzeLiquidity(depthData, symbol, tradesData, klinesData) {
    let totalBids = 0;
    let totalAsks = 0;
    let maxBid = 0;
    let maxAsk = 0;

    // Analyze Order Book Depth
    depthData.bids.forEach(b => {
        let vol = parseFloat(b[1]);
        totalBids += vol;
        if (vol > maxBid) maxBid = vol;
    });

    depthData.asks.forEach(a => {
        let vol = parseFloat(a[1]);
        totalAsks += vol;
        if (vol > maxAsk) maxAsk = vol;
    });

    // Detect Spoofing (if a single level holds > 15% of entire book side, it's likely a spoof)
    const buySpoofPct = totalBids > 0 ? (maxBid / totalBids) * 100 : 0;
    const sellSpoofPct = totalAsks > 0 ? (maxAsk / totalAsks) * 100 : 0;

    // Analyze Recent Trades (Whale Tracking)
    let boughtCoin = 0;
    let soldCoin = 0;
    let largeBuys = 0;
    let largeSells = 0;

    // Calculate Average Trade Size
    let totalVolume = 0;
    tradesData.forEach(t => { totalVolume += parseFloat(t.qty); });
    let avgTradeSize = tradesData.length > 0 ? totalVolume / tradesData.length : 0;
    let whaleThreshold = avgTradeSize * 5; // 5x average is considered a whale

    tradesData.forEach(t => {
        let qty = parseFloat(t.qty);
        if (t.isBuyerMaker) { // Seller initiated (Market Sell)
            soldCoin += qty;
            if (qty > whaleThreshold) largeSells++;
        } else { // Buyer initiated (Market Buy)
            boughtCoin += qty;
            if (qty > whaleThreshold) largeBuys++;
        }
    });

    let netCoin = boughtCoin - soldCoin;
    
    let whaleActivity = "Neutral ⚖️";
    if (largeBuys > largeSells * 1.5) whaleActivity = "Whale Accumulating 🐋🟢";
    else if (largeSells > largeBuys * 1.5) whaleActivity = "Whale Distributing 🐋🔴";
    
        // Multi-Timeframe Analysis (4H Trend) powered by 100 ICT Agents
    let mtfaTrend = "NEUTRAL ⚖️";
    if (klinesData && klinesData.length >= 20) {
        const ictAnalysis = analyzeICT_MTFA(klinesData);
        mtfaTrend = ictAnalysis.trend; // e.g., "ICT: STRONG BULLISH 🟢"
    }

    return {
        buySpoofPct: buySpoofPct.toFixed(1),
        sellSpoofPct: sellSpoofPct.toFixed(1),
        boughtCoin: boughtCoin.toFixed(2),
        soldCoin: soldCoin.toFixed(2),
        netCoin: netCoin.toFixed(2),
        whaleActivity: whaleActivity,
        mtfaTrend: mtfaTrend,
        demandVolume: totalBids.toFixed(2),
        supplyVolume: totalAsks.toFixed(2)
    };
}

module.exports = { analyzeLiquidity };
