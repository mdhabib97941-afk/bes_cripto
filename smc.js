// smc.js
function analyzeSMC(klines) {
    let processedData = klines.map(k => ({
        time: Math.floor(k[0] / 1000), 
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        isBullish: parseFloat(k[4]) > parseFloat(k[1])
    }));

    let fvgs = [];
    let orderBlocks = [];

    for (let i = 2; i < processedData.length; i++) {
        const c0 = processedData[i - 2];
        const c1 = processedData[i - 1]; 
        const c2 = processedData[i];

        // Ensure displacement candle is relatively significant (e.g. at least 0.05% body size)
        const c1BodySize = Math.abs(c1.close - c1.open);
        const isDisplacement = (c1BodySize / c1.open) > 0.0005;

        // Bullish FVG: c0 high < c2 low AND c1 must be Bullish AND c1 is a displacement
        if (c0.high < c2.low && c1.isBullish && isDisplacement) {
            // Gap size threshold (prevent microscopic gaps)
            if ((c2.low - c0.high) / c0.high > 0.0001) {
                fvgs.push({
                    type: 'bullish_fvg',
                    time: c1.time,
                    top: c2.low,
                    bottom: c0.high
                });

                // Find Bullish Order Block
                let obIndex = i - 2;
                let foundOB = false;
                for(let j = 0; j < 5; j++) {
                    if(i - 2 - j >= 0) {
                        if(!processedData[i - 2 - j].isBullish) {
                            obIndex = i - 2 - j;
                            foundOB = true;
                            break;
                        }
                    }
                }
                if(foundOB && !orderBlocks.some(ob => ob.time === processedData[obIndex].time)) {
                    orderBlocks.push({
                        type: 'bullish_ob',
                        time: processedData[obIndex].time,
                        top: processedData[obIndex].high,
                        bottom: processedData[obIndex].low
                    });
                }
            }
        }

        // Bearish FVG: c0 low > c2 high AND c1 must be Bearish AND c1 is a displacement
        if (c0.low > c2.high && !c1.isBullish && isDisplacement) {
            if ((c0.low - c2.high) / c2.high > 0.0001) {
                fvgs.push({
                    type: 'bearish_fvg',
                    time: c1.time,
                    top: c0.low,
                    bottom: c2.high
                });

                // Find Bearish Order Block
                let obIndex = i - 2;
                let foundOB = false;
                for(let j = 0; j < 5; j++) {
                    if(i - 2 - j >= 0) {
                        if(processedData[i - 2 - j].isBullish) {
                            obIndex = i - 2 - j;
                            foundOB = true;
                            break;
                        }
                    }
                }
                if(foundOB && !orderBlocks.some(ob => ob.time === processedData[obIndex].time)) {
                    orderBlocks.push({
                        type: 'bearish_ob',
                        time: processedData[obIndex].time,
                        top: processedData[obIndex].high,
                        bottom: processedData[obIndex].low
                    });
                }
            }
        }
    }

    return {
        candles: processedData,
        fvgs: fvgs,
        orderBlocks: orderBlocks
    };
}

module.exports = { analyzeSMC };
