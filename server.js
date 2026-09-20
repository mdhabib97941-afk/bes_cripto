const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { analyzeSMC } = require('./smc');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static('public'));

const VALID_INTERVALS = ['5m', '15m', '1h', '4h', '1d'];

app.get('/api/market-data', async (req, res) => {
    const symbol = (req.query.symbol || 'BTCUSDT').toUpperCase();
    const interval = req.query.interval || '15m';
    const limit = parseInt(req.query.limit) || 500;

    // Input Validation
    if (!symbol.match(/^[A-Z0-9]{3,10}$/)) {
        return res.status(400).json({ error: 'Invalid symbol format' });
    }
    if (!VALID_INTERVALS.includes(interval)) {
        return res.status(400).json({ error: 'Invalid interval' });
    }
    if (limit > 1000 || limit < 1) {
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

app.listen(PORT, () => {
    console.log(`SMC Dashboard running on http://localhost:${PORT}`);
});
