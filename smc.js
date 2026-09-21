// smc.js
function analyzeSMC(klines) {
    if (!klines || klines.length === 0) return null;

    let data = klines.map((k, index) => ({
        index: index,
        time: Math.floor(k[0] / 1000), 
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        isBullish: parseFloat(k[4]) >= parseFloat(k[1])
    }));

    let fvgs = [];
    let orderBlocks = [];
    let structure = [];
    let swings = [];

    // State Variables for True Market Structure
    let trend = 1; // 1 = Bullish, -1 = Bearish
    
    let legHigh = { price: -Infinity, time: 0, index: 0, candleLow: 0 };
    let legLow = { price: Infinity, time: 0, index: 0, candleHigh: 0 };
    
    let potentialIDM = null;
    let confirmedHigh = null;
    let confirmedLow = null;
    
    // Initialize first leg
    legHigh = { price: data[0].high, time: data[0].time, index: 0, candleLow: data[0].low };
    legLow = { price: data[0].low, time: data[0].time, index: 0, candleHigh: data[0].high };

    for (let i = 1; i < data.length; i++) {
        let c = data[i];

        // --- BULLISH TREND LOGIC ---
        if (trend === 1) {
            // 1. Update Leg High
            if (c.high > legHigh.price) {
                legHigh = { price: c.high, time: c.time, index: i, candleLow: c.low };
                // If it broke the high before taking IDM, the previous IDM is invalid (moved up)
                if (!confirmedHigh) potentialIDM = null;
            }

            // 2. Identify Valid Pullback (IDM Sweep)
            // A valid pullback occurs if price takes the low of the highest candle
            if (!confirmedHigh && c.low < legHigh.candleLow) {
                confirmedHigh = { ...legHigh, type: 'HH' };
                swings.push(confirmedHigh);
                structure.push({ type: 'IDM_SWEEP', time: c.time, startTime: legHigh.time, price: legHigh.candleLow, text: 'IDM' });
                
                legLow = { price: c.low, time: c.time, index: i, candleHigh: c.high };
            }

            // Track lowest point during pullback
            if (confirmedHigh && c.low < legLow.price) {
                legLow = { price: c.low, time: c.time, index: i, candleHigh: c.high };
            }

            // 4. BOS -> Confirm Swing Low & Continue Trend
            if (confirmedHigh && c.close > confirmedHigh.price) {
                confirmedLow = { ...legLow, type: 'HL' };
                swings.push(confirmedLow);
                structure.push({ type: 'BOS_BULL', time: c.time, startTime: confirmedHigh.time, price: confirmedHigh.price, text: 'BOS' });
                
                // Reset for next leg
                legHigh = { price: c.high, time: c.time, index: i, candleLow: c.low };
                confirmedHigh = null;
            }

            // 5. CHoCH -> Trend Reversal
            if (confirmedLow && c.close < confirmedLow.price) {
                trend = -1; // Switch to Bearish
                structure.push({ type: 'CHOCH_BEAR', time: c.time, startTime: confirmedLow.time, price: confirmedLow.price, text: 'CHoCH' });
                
                // Start tracking new bearish leg from the highest point before CHoCH
                legLow = { price: c.low, time: c.time, index: i, candleHigh: c.high };
                confirmedHigh = null;
                confirmedLow = null;
            }
        }
        
        // --- BEARISH TREND LOGIC ---
        else if (trend === -1) {
            // 1. Update Leg Low
            if (c.low < legLow.price) {
                legLow = { price: c.low, time: c.time, index: i, candleHigh: c.high };
                if (!confirmedLow) confirmedHigh = null;
            }

            // 2. Identify Valid Pullback (IDM Sweep)
            if (!confirmedLow && c.high > legLow.candleHigh) {
                confirmedLow = { ...legLow, type: 'LL' };
                swings.push(confirmedLow);
                structure.push({ type: 'IDM_SWEEP', time: c.time, startTime: legHigh.time, price: legLow.candleHigh, text: 'IDM' });
                
                legHigh = { price: c.high, time: c.time, index: i, candleLow: c.low };
            }

            // Track highest point during pullback
            if (confirmedLow && c.high > legHigh.price) {
                legHigh = { price: c.high, time: c.time, index: i, candleLow: c.low };
            }

            // 4. BOS -> Confirm Swing High & Continue Trend
            if (confirmedLow && c.close < confirmedLow.price) {
                confirmedHigh = { ...legHigh, type: 'LH' };
                swings.push(confirmedHigh);
                structure.push({ type: 'BOS_BEAR', time: c.time, startTime: confirmedLow.time, price: confirmedLow.price, text: 'BOS' });
                
                legLow = { price: c.low, time: c.time, index: i, candleHigh: c.high };
                confirmedLow = null;
            }

            // 5. CHoCH -> Trend Reversal
            if (confirmedHigh && c.close > confirmedHigh.price) {
                trend = 1; // Switch to Bullish
                structure.push({ type: 'CHOCH_BULL', time: c.time, startTime: confirmedHigh.time, price: confirmedHigh.price, text: 'CHoCH' });
                
                legHigh = { price: c.high, time: c.time, index: i, candleLow: c.low };
                confirmedHigh = null;
                confirmedLow = null;
                potentialIDM = null;
            }
        }
    }

    // 6. FVG & High Probability OB Logic
    for (let i = 2; i < data.length; i++) {
        const c0 = data[i - 2];
        const c1 = data[i - 1]; 
        const c2 = data[i];

        const c1BodySize = Math.abs(c1.close - c1.open);
        const candleRange = c1.high - c1.low;
        // Require strong displacement for true SMC
        const isDisplacement = (c1BodySize / candleRange > 0.5) && (c1BodySize / c1.open > 0.0003);

        // Bullish FVG
        if (c0.high < c2.low && c1.isBullish && isDisplacement) {
            fvgs.push({ type: 'bullish_fvg', index: c1.index, time: c1.time, top: c2.low, bottom: c0.high, mitigatedTime: null });

            // Find valid Order Block (last bearish candle before displacement)
            let obIndex = -1;
            for(let j = i-2; j >= Math.max(0, i-10); j--) {
                if(!data[j].isBullish) {
                    obIndex = j;
                    break;
                }
            }
            if(obIndex !== -1 && !orderBlocks.some(ob => ob.time === data[obIndex].time)) {
                orderBlocks.push({ type: 'bullish_ob', index: obIndex, time: data[obIndex].time, top: data[obIndex].high, bottom: data[obIndex].low, mitigatedTime: null });
            }
        }

        // Bearish FVG
        if (c0.low > c2.high && !c1.isBullish && isDisplacement) {
            fvgs.push({ type: 'bearish_fvg', index: c1.index, time: c1.time, top: c0.low, bottom: c2.high, mitigatedTime: null });

            let obIndex = -1;
            for(let j = i-2; j >= Math.max(0, i-10); j--) {
                if(data[j].isBullish) {
                    obIndex = j;
                    break;
                }
            }
            if(obIndex !== -1 && !orderBlocks.some(ob => ob.time === data[obIndex].time)) {
                orderBlocks.push({ type: 'bearish_ob', index: obIndex, time: data[obIndex].time, top: data[obIndex].high, bottom: data[obIndex].low, mitigatedTime: null });
            }
        }
    }

    // 7. Calculate Mitigation for FVG/OB
    fvgs.forEach(fvg => {
        for(let k = fvg.index + 2; k < data.length; k++) {
            let c = data[k];
            // Bullish FVG mitigated if price drops below its TOP
            if (fvg.type === 'bullish_fvg' && c.low <= fvg.top) { fvg.mitigatedTime = c.time; break; }
            // Bearish FVG mitigated if price rises above its BOTTOM
            if (fvg.type === 'bearish_fvg' && c.high >= fvg.bottom) { fvg.mitigatedTime = c.time; break; }
        }
    });

    orderBlocks.forEach(ob => {
        ob.isDead = false;
        let recentHigh = swings.slice().reverse().find(s => s.type === 'LH' || s.type === 'HH');
        let recentLow = swings.slice().reverse().find(s => s.type === 'LL' || s.type === 'HL');
        let tpBull = recentHigh ? recentHigh.price : ob.top + (ob.top - ob.bottom) * 3;
        let tpBear = recentLow ? recentLow.price : ob.bottom - (ob.top - ob.bottom) * 3;

        for(let k = ob.index + 2; k < data.length; k++) {
            let c = data[k];
            if (ob.type === 'bullish_ob') {
                if (!ob.mitigatedTime && c.low <= ob.top) { ob.mitigatedTime = c.time; }
                if (ob.mitigatedTime && (c.low < ob.bottom || c.high >= tpBull)) { ob.isDead = true; break; } // Hit SL or TP
            }
            if (ob.type === 'bearish_ob') {
                if (!ob.mitigatedTime && c.high >= ob.bottom) { ob.mitigatedTime = c.time; }
                if (ob.mitigatedTime && (c.high > ob.top || c.low <= tpBear)) { ob.isDead = true; break; } // Hit SL or TP
            }
        }
    });

    // 8. Generate Trade Setups (AI Signals)
    let tradeSetups = [];
    
    let currentPrice = data[data.length - 1].close;
    let currentTime = data[data.length - 1].time;

    // Generate Best LONG Setup
    let validBullOBs = orderBlocks.filter(ob => ob.type === 'bullish_ob' && !ob.isDead);
    if (validBullOBs.length > 0) {
        let targetOB = validBullOBs[validBullOBs.length - 1]; 
        let recentHighs = swings.filter(s => s.type.includes('H') && s.price > targetOB.top);
        let tp = recentHighs.length > 0 ? recentHighs[recentHighs.length - 1].price : targetOB.top + (targetOB.top - targetOB.bottom) * 3;
        let status = targetOB.mitigatedTime ? (currentPrice < targetOB.bottom ? 'STOPPED_OUT' : 'ACTIVE') : 'PENDING';
        
        tradeSetups.push({
            direction: 'LONG',
            entry: targetOB.top,
            sl: targetOB.bottom,
            tp: tp,
            rr: ((tp - targetOB.top) / (targetOB.top - targetOB.bottom)).toFixed(2),
            status: status,
            time: targetOB.time
        });
    }

    // Generate Best SHORT Setup
    let validBearOBs = orderBlocks.filter(ob => ob.type === 'bearish_ob' && !ob.isDead);
    if (validBearOBs.length > 0) {
        let targetOB = validBearOBs[validBearOBs.length - 1];
        let recentLows = swings.filter(s => s.type.includes('L') && s.price < targetOB.bottom);
        let tp = recentLows.length > 0 ? recentLows[recentLows.length - 1].price : targetOB.bottom - (targetOB.top - targetOB.bottom) * 3;
        let status = targetOB.mitigatedTime ? (currentPrice > targetOB.top ? 'STOPPED_OUT' : 'ACTIVE') : 'PENDING';

        tradeSetups.push({
            direction: 'SHORT',
            entry: targetOB.bottom,
            sl: targetOB.top,
            tp: tp,
            rr: ((targetOB.bottom - tp) / (targetOB.top - targetOB.bottom)).toFixed(2),
            status: status,
            time: targetOB.time
        });
    }

    return {
        candles: data,
        fvgs: fvgs,
        orderBlocks: orderBlocks,
        structure: structure,
        swings: swings,
        tradeSetups: tradeSetups
    };
}

module.exports = { analyzeSMC };
