const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { analyzeSMC } = require('./smc');
const { analyzeLiquidity } = require('./liquidity');
const { deployWhaleSpies } = require('./whale_spies');
const { run1000Agents } = require('./quant_agents');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const VALID_INTERVALS = ['5m', '15m', '1h', '4h', '1d', '1w', '1M'];

app.get('/api/market-data', async (req, res) => {
    const symbol = (req.query.symbol || 'BTCUSDT').toUpperCase();
    const interval = req.query.interval || '15m';
    const limit = parseInt(req.query.limit) || 1000;

    // Input Validation
    if (!symbol.match(/^[A-Z0-9]{3,10}$/)) {
        return res.status(400).json({ error: 'Invalid symbol format' });
    }
    if (!VALID_INTERVALS.includes(interval)) {
        return res.status(400).json({ error: 'Invalid interval' });
    }
    if (isNaN(limit) || limit > 1000 || limit < 1) {
        return res.status(400).json({ error: 'Limit must be between 1 and 1000' });
    }

    try {
        const response = await axios.get(`https://api.binance.com/api/v3/klines`, {
            params: {
                symbol: symbol,
                interval: interval,
                limit: limit
            },
            timeout: 5000 // 5 seconds timeout
        });

        // Process data through SMC algorithm
        const analyzedData = analyzeSMC(response.data);
        
        // Process data through 1000 Quant Agents
        const quantConsensus = run1000Agents(response.data);
        analyzedData.quantConsensus = quantConsensus;
        
        res.json(analyzedData);

    } catch (error) {
        if (error.response) {
            // Binance API responded with an error
            console.error("Binance API Error:", error.response.status, error.response.data);
            res.status(error.response.status).json({ error: error.response.data.msg || 'Binance API Error' });
        } else if (error.code === 'ECONNABORTED') {
            console.error("Binance API Timeout");
            res.status(504).json({ error: 'Request to Binance timed out' });
        } else {
            console.error("Server Error:", error.message);
            res.status(500).json({ error: 'Failed to fetch market data' });
        }
    }
});

app.get('/api/liquidity', async (req, res) => {
    const symbol = (req.query.symbol || 'BTCUSDT').toUpperCase();
    const limit = parseInt(req.query.limit) || 1000; // Get up to 1000 levels of depth

    if (!symbol.match(/^[A-Z0-9]{3,10}$/)) {
        return res.status(400).json({ error: 'Invalid symbol format' });
    }

    try {
        const depthRes = await axios.get(`https://api.binance.com/api/v3/depth`, {
            params: { symbol: symbol, limit: limit },
            timeout: 5000
        });
        const depthData = depthRes.data;

        // Fetch recent trades to track real buy/sell volume
        const tradesRes = await axios.get(`https://api.binance.com/api/v3/trades`, {
            params: { symbol: symbol, limit: 500 },
            timeout: 5000
        });
        const tradesData = tradesRes.data;

        // Fetch 4H Klines for MTFA (Multi-Timeframe Analysis)
        const klinesRes = await axios.get(`https://api.binance.com/api/v3/klines`, {
            params: { symbol: symbol, interval: '4h', limit: 30 },
            timeout: 5000
        });
        const klinesData = klinesRes.data;

        // Fetch Funding Rate and Open Interest (Futures Data for Manipulation tracking)
        let fundingRate = "0.0000";
        let openInterest = "0";
        try {
            const fundingRes = await axios.get(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`, { timeout: 3000 });
            fundingRate = fundingRes.data.lastFundingRate || "0.0000";
        } catch (e) { console.error("Funding Rate Error:", e.message); }
        
        try {
            const oiRes = await axios.get(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`, { timeout: 3000 });
            openInterest = oiRes.data.openInterest || "0";
        } catch (e) { console.error("Open Interest Error:", e.message); }

        const analyzedLiquidity = analyzeLiquidity(depthData, symbol, tradesData, klinesData);
        analyzedLiquidity.fundingRate = fundingRate;
        analyzedLiquidity.openInterest = openInterest;
        
        res.json(analyzedLiquidity);
    } catch (error) {
        console.error("Liquidity API Error:", error.message);
        res.status(500).json({ error: 'Failed to fetch liquidity data' });
    }
});


// MTFA Roadmap Endpoint
app.get('/api/roadmap', async (req, res) => {
    const symbol = (req.query.symbol || 'BTCUSDT').toUpperCase();
    const intervals = ['1d', '4h', '1h', '15m', '5m'];
    
    try {
        const responses = [];
        for (let i=0; i<intervals.length; i++) {
            try {
                const res = await axios.get('https://api.binance.com/api/v3/klines', {
                    params: { symbol: symbol, interval: intervals[i], limit: 300 },
                    timeout: 5000
                });
                responses.push({ status: 'fulfilled', value: res });
            } catch(e) {
                responses.push({ status: 'rejected', reason: e });
            }
            await new Promise(r => setTimeout(r, 100)); // Stagger to prevent rate limit
        }
        
        let mtfaContext = "MULTITIMEFRAME SMC ALIGNMENT FOR " + symbol + ":\n";
        
        responses.forEach((responseObj, index) => {
            if (responseObj.status === 'rejected') return;
            const response = responseObj.value;
            const interval = intervals[index];
            const smcData = analyzeSMC(response.data);
            const setup = smcData.tradeSetups.length > 0 ? smcData.tradeSetups[0] : null;
            
            mtfaContext += `--- ${interval.toUpperCase()} TIMEFRAME ---\n`;
            if (setup) {
                mtfaContext += `Setup: ${setup.status} ${setup.direction}\n`;
                mtfaContext += `Entry: $${setup.entry.toFixed(2)}, SL: $${setup.sl.toFixed(2)}, TP: $${setup.tp.toFixed(2)}\n`;
            } else {
                mtfaContext += `Setup: NONE\n`;
            }
        });
        
        // Let's ask the LLM for the Roadmap
        const prompt = `You are the Mastermind Institutional MTFA (Multi-Timeframe Analysis) AI. 
        The user wants to take a trade entry on the 5-Minute (5m) chart. 
        
        Here is the current SMC structure across all timeframes:
        ${mtfaContext}
        
        Task: Give the user a clear "5m Perfect Setup Roadmap" in Bengali/Banglish.
        RULES (CRITICAL): 
        1. If 4H/1D is PENDING SHORT, the Macro Target is UP. So 5m MUST be LONG.
        2. If 4H/1D is PENDING LONG, the Macro Target is DOWN. So 5m MUST be SHORT.
        3. If 5m setup direction contradicts the Macro direction, you MUST explicitly output: "WARNING: 5m setup contradicts Macro trend. WAIT for alignment."
        4. Do not invent setups. Use ONLY the data provided above.
        5. Keep it under 5 lines, concise, and highly actionable.`;

        const FREE_API_KEY = 'freellmapi-b727194adc490f0b1f3479ec394b3e2852286b2b5c50d8dd';
        const FREE_BASE_URL = 'https://freellmapi-5ybc.onrender.com/v1';
        
        const aiResponse = await axios.post(`${FREE_BASE_URL}/chat/completions`, {
            model: "auto",
            messages: [
                { role: "system", content: "You are an elite trading algorithm." },
                { role: "user", content: prompt }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${FREE_API_KEY}`, 'Content-Type': 'application/json' }
        });
        
        res.json({ roadmap: aiResponse.data.choices[0].message.content.trim() });

    } catch (error) {
        console.error("Roadmap API Error:", error.message);
        res.status(500).json({ error: 'Failed to generate roadmap' });
    }
});

app.listen(PORT, () => {
    console.log(`SMC Dashboard running on port ${PORT}`);
    
    // Ping the server itself every 14 minutes to prevent Render from sleeping
    const url = process.env.RENDER_EXTERNAL_URL || "https://bes-cripto.onrender.com";
    setInterval(async () => {
        try {
            await axios.get(url);
            console.log(`Keep-alive ping to ${url} successful`);
        } catch (error) {
            console.error(`Keep-alive ping failed:`, error.message);
        }
    }, 14 * 60 * 1000); // 14 minutes
});

 app.post('/api/whale-spies', async (req, res) => {
    try {
        const marketContext = req.body; 
        const report = await deployWhaleSpies(marketContext);
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: 'Failed to deploy Whale Spies' });
    }
});
