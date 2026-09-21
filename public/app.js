const chartContainer = document.getElementById('chart-container');
const loadingOverlay = document.getElementById('overlay');
const errorMsg = document.getElementById('error-msg');
const overlayCanvas = document.getElementById('draw-overlay');
const overlayCtx = overlayCanvas.getContext('2d');

let chart, candleSeries;
let smcData = null;


// Generate MTFA Roadmap
async function generateRoadmap() {
    const symbol = document.getElementById('symbol').value.toUpperCase();
    const btn = document.querySelector('button[onclick="generateRoadmap()"]');
    const box = document.getElementById('roadmap-box');
    
    btn.innerText = "⏳ Scanning 5 Timeframes...";
    btn.style.opacity = "0.7";
    box.style.display = "block";
    box.innerText = "Mastermind AI is calculating Macro Bias and 5m Entry... Please wait (10-15s).";
    
    try {
        const res = await fetch(`/api/roadmap?symbol=${symbol}`);
        if (!res.ok) throw new Error("Failed to fetch roadmap");
        const data = await res.json();
        
        box.innerText = data.roadmap;
    } catch (err) {
        box.innerText = "Error: " + err.message;
    } finally {
        btn.innerText = "🔥 Generate 5m MTFA Roadmap";
        btn.style.opacity = "1";
    }
}

// Initialize Lightweight Charts
function initChart() {
    chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: 600,
        layout: {
            background: { type: 'solid', color: '#131722' },
            textColor: '#d1d4dc',
        },
        grid: {
            vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
            horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
        },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: 'rgba(197, 203, 206, 0.8)' },
        timeScale: { borderColor: 'rgba(197, 203, 206, 0.8)' },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderDownColor: '#ef5350',
        borderUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        wickUpColor: '#26a69a',
    });

    chart.timeScale().subscribeVisibleTimeRangeChange(drawOverlay);
    chart.subscribeCrosshairMove(drawOverlay);
    window.addEventListener('resize', () => {
        chart.resize(chartContainer.clientWidth, 600);
        drawOverlay();
    });
}

function syncCanvasSize() {
    overlayCanvas.width = chartContainer.clientWidth;
    overlayCanvas.height = 600;
}

function drawOverlay() {
    if (!smcData || !chart || !candleSeries) return;
    syncCanvasSize();
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const getX = (time) => chart.timeScale().timeToCoordinate(time);
    const getY = (price) => candleSeries.priceToCoordinate(price);

    // ==========================================
    // TRADINGVIEW EXACT PINE SCRIPT COLORS
    // ==========================================
    const BULL_COLOR  = 'rgba(8, 153, 129, 1)';     // #089981
    const BULL_FILL   = 'rgba(8, 153, 129, 0.15)';  
    const BULL_BORDER = 'rgba(8, 153, 129, 0.40)';  
    
    const BEAR_COLOR  = 'rgba(242, 54, 69, 1)';     // #f23645
    const BEAR_FILL   = 'rgba(242, 54, 69, 0.15)';
    const BEAR_BORDER = 'rgba(242, 54, 69, 0.40)';
    
    const NEUT_FILL   = 'rgba(128, 128, 128, 0.10)'; // Neutral/Mitigated Fill
    const NEUT_BORDER = 'rgba(128, 128, 128, 0.30)'; // Neutral/Mitigated Border
    
    const FVG_BULL    = 'rgba(33, 150, 243, 0.15)'; // Blue 85 transp
    const FVG_BEAR    = 'rgba(255, 152, 0, 0.15)';  // Orange 85 transp

    // 1. Draw Order Blocks (Max 40 based on Pine script)
    const displayOBs = smcData.orderBlocks.slice(-40);
    
    displayOBs.forEach(ob => {
        const startX = getX(ob.time);
        
        // CRITICAL PINE SCRIPT LOGIC: Box stops extending once mitigated!
        const isMitigated = ob.mitigatedTime !== null && ob.isDead === true; // Treat as dead if it's hit
        const endX = isMitigated ? (getX(ob.mitigatedTime) ?? overlayCanvas.width) : overlayCanvas.width;
        
        const yTop = getY(ob.top);
        const yBottom = getY(ob.bottom);
        
        if(startX === null || yTop === null || yBottom === null || endX === null) return;
        
        const isBull = ob.type === 'bullish_ob';
        
        overlayCtx.fillStyle = isMitigated ? NEUT_FILL : (isBull ? BULL_FILL : BEAR_FILL);
        overlayCtx.fillRect(startX, yTop, endX - startX, yBottom - yTop);
        
        overlayCtx.strokeStyle = isMitigated ? NEUT_BORDER : (isBull ? BULL_BORDER : BEAR_BORDER);
        overlayCtx.lineWidth = 1;
        overlayCtx.setLineDash(isMitigated ? [] : [4, 4]); // Dashed active, solid mitigated
        
        overlayCtx.strokeRect(startX, yTop, endX - startX, yBottom - yTop);
        overlayCtx.setLineDash([]); // Reset
        
        if (!isMitigated) {
            const label = isBull ? "+OB" : "-OB";
            overlayCtx.font = "10px sans-serif";
            overlayCtx.fillStyle = isBull ? BULL_COLOR : BEAR_COLOR;
            overlayCtx.fillText(label, endX - 30, yTop + 14);
        }
    });

    // 2. Draw FVGs (Max 15)
    const displayFVGs = smcData.fvgs.slice(-15);
    displayFVGs.forEach(fvg => {
        const startX = getX(fvg.time);
        const isMitigated = fvg.mitigatedTime !== null;
        const endX = isMitigated ? (getX(fvg.mitigatedTime) ?? overlayCanvas.width) : overlayCanvas.width; 
        
        const yTop = getY(fvg.top);
        const yBottom = getY(fvg.bottom);
        
        if(startX === null || yTop === null || yBottom === null || endX === null) return;

        const isBull = fvg.type === 'bullish_fvg';
        overlayCtx.fillStyle = isMitigated ? NEUT_FILL : (isBull ? FVG_BULL : FVG_BEAR);
        overlayCtx.fillRect(startX, yTop, endX - startX, yBottom - yTop);
        // FVG in Pine Script has NO borders!
    });

    // 3. Draw True SMC Structure Lines (CHoCH / IDM)
    smcData.structure.forEach(st => {
        const startX = getX(st.startTime);
        const endX = getX(st.time);
        const y = getY(st.price);
        
        if (startX === null || endX === null || y === null) return;
        
        const isBull = st.type.includes('BULL');
        const isIdm = st.type.includes('IDM');
        const color = isIdm ? 'rgba(255, 165, 0, 1)' : (isBull ? BULL_COLOR : BEAR_COLOR);
        
        overlayCtx.beginPath();
        overlayCtx.strokeStyle = color;
        overlayCtx.setLineDash([]); // Solid lines in Pine Script
        overlayCtx.lineWidth = 1;
        
        overlayCtx.moveTo(startX, y);
        overlayCtx.lineTo(endX, y);
        overlayCtx.stroke();
        
        overlayCtx.fillStyle = color;
        overlayCtx.font = "10px sans-serif";
        const txtW = overlayCtx.measureText(st.text).width;
        // Placed center-top
        overlayCtx.fillText(st.text, startX + (endX - startX)/2 - (txtW/2), y - 4);
    });

    // 4. Draw Swing Points
    smcData.swings.forEach(swing => {
        const x = getX(swing.time);
        const y = getY(swing.price);
        if (x === null || y === null) return;

        overlayCtx.fillStyle = swing.type.includes('H') ? BULL_COLOR : BEAR_COLOR;
        overlayCtx.font = "bold 9px sans-serif";
        const offset = swing.type.includes('H') ? -8 : 14;
        overlayCtx.fillText(swing.type, x - 6, y + offset);
    });

    // 5. Pending Trade Setup Box logic removed per user request
}
// Fetch SMC Data from Backend

let autoRefreshInterval = null;

async function loadData(silent = false) {
    const symbol = document.getElementById('symbol').value;
    const interval = document.getElementById('interval').value;
    
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => loadData(true), 3000); // Auto-refresh every 3 seconds
    
    if (!silent) {
        loadingOverlay.style.display = 'flex';
        errorMsg.style.display = 'none';
    }

    try {
        const res = await fetch(`/api/market-data?symbol=${symbol}&interval=${interval}&limit=500`);
        if (!res.ok) throw new Error("Backend API Error");
        smcData = await res.json();
        
        const formattedCandles = smcData.candles.map(c => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close
        }));
        
        candleSeries.setData(formattedCandles);
        drawOverlay();

        document.getElementById('live-price').innerText = `${formattedCandles[formattedCandles.length-1].close.toFixed(2)}`;
        
        const bullishObsDiv = document.getElementById('bullish-obs');
        const bearishObsDiv = document.getElementById('bearish-obs');
        
        if (bullishObsDiv && bearishObsDiv) {
            const unmitigatedBullish = smcData.orderBlocks.filter(ob => ob.type === 'bullish_ob' && !ob.isDead).slice(-3);
            const unmitigatedBearish = smcData.orderBlocks.filter(ob => ob.type === 'bearish_ob' && !ob.isDead).slice(-3);
            
            const q = smcData.quantConsensus;
            if (q) {
                const qElem = document.getElementById('quant-consensus');
                if (qElem) {
                    let color = '#9aa0ac';
                    if (q.verdict === 'LONG') color = '#00e676';
                    if (q.verdict === 'SHORT') color = '#ff5252';
                    qElem.innerHTML = `<span style="color:${color}; font-weight:bold;">${q.confidencePct}% ${q.verdict}</span> <br>
                    <span style="font-size:9px; color:#555;">(L: ${q.long} | S: ${q.short} | N: ${q.neutral})</span>`;
                }
            }
            
            bearishObsDiv.innerHTML = unmitigatedBearish.length ? unmitigatedBearish.map(ob => 
                `<div style="display:flex; justify-content:space-between; margin-bottom:4px; padding:4px; background:rgba(255, 82, 82, 0.1); border-left:3px solid #ff5252;">
                    <span>${new Date(ob.time * 1000).toLocaleTimeString()}</span>
                    <span>${ob.bottom.toFixed(2)} - ${ob.top.toFixed(2)} ${ob.mitigatedTime ? '(ACTIVE)' : ''}</span>
                </div>`
            ).join('') : '<div style="color: gray; font-style: italic;">No unmitigated Supply</div>';

            bullishObsDiv.innerHTML = unmitigatedBullish.length ? unmitigatedBullish.map(ob => 
                `<div style="display:flex; justify-content:space-between; margin-bottom:4px; padding:4px; background:rgba(0, 150, 136, 0.1); border-left:3px solid #009688;">
                    <span>${new Date(ob.time * 1000).toLocaleTimeString()}</span>
                    <span>${ob.bottom.toFixed(2)} - ${ob.top.toFixed(2)} ${ob.mitigatedTime ? '(ACTIVE)' : ''}</span>
                </div>`
            ).join('') : '<div style="color: gray; font-style: italic;">No unmitigated Demand</div>';
        }
        
        if (document.getElementById('mtfa-trend')) document.getElementById('mtfa-trend').innerText = `Current Trend: ${smcData.swings.length > 0 ? (smcData.swings[smcData.swings.length-1].type.includes('H') ? 'BULLISH' : 'BEARISH') : 'NEUTRAL'}`;
        
        loadLiquidity(symbol, smcData);
    } catch (err) {
        if (!silent) {
            errorMsg.innerText = "Error loading data: " + err.message;
            errorMsg.style.display = 'block';
        }
    } finally {
        if (!silent) loadingOverlay.style.display = 'none';
    }
}
// Init
initChart();
document.getElementById('refreshBtn').addEventListener('click', () => loadData(false));
document.getElementById('symbol').addEventListener('change', () => loadData(false));
document.getElementById('interval').addEventListener('change', () => loadData(false));
// Load default
loadData(false);

// -------------------------------------------------------------
// Deploy 10 Whale Spies
// -------------------------------------------------------------
document.getElementById('deploy-spies-btn')?.addEventListener('click', async () => {
    const symbol = document.getElementById('symbol').value;
    const btn = document.getElementById('deploy-spies-btn');
    const modal = document.getElementById('mastermind-modal');
    const content = document.getElementById('mastermind-content');
    const spyReports = document.getElementById('spy-reports');

    btn.innerText = 'Deploying Spies... (Takes 15s)';
    btn.disabled = true;
    modal.style.display = 'block';
    content.innerText = '📡 Intercepting Whale Data... Sending to 9 Field Agents... \n🧠 Waiting for Mastermind synthesis...';
    spyReports.innerHTML = '';

    try {
        const context = {
            symbol: symbol,
            currentPrice: document.getElementById('live-price')?.innerText || 'Unknown',
            mtfaTrend: document.getElementById('mtfa-trend')?.innerText || 'Unknown',
            smcBias: document.getElementById('ai-signal')?.innerText || 'Unknown',
            netCoin: document.getElementById('net-coin')?.innerText || '0',
            buySpoofPct: document.getElementById('buy-spoof-pct')?.innerText || '0%',
            sellSpoofPct: document.getElementById('sell-spoof-pct')?.innerText || '0%',
            demandVolume: document.getElementById('volume-stats')?.children[0]?.innerText || '$0',
            quantConsensus: document.getElementById('quant-consensus')?.innerText || 'Unknown',
            fundingRate: document.getElementById('funding-rate')?.innerText || 'Unknown',
            openInterest: document.getElementById('open-interest')?.innerText || 'Unknown',
            supplyVolume: document.getElementById('volume-stats')?.children[1]?.innerText || '$0'
        };

        const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 15000);
        const res = await fetch('/api/whale-spies', { signal: controller.signal,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(context)
        });

        clearTimeout(timeoutId);
        const data = await res.json();
        
        content.innerText = data.mastermind;

        spyReports.innerHTML = data.individualReports.map(r => 
            '<div style="margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 5px;">' +
                '<strong style="color: #2196f3;">[' + r.agent + ']</strong>: <span style="color: #a0a0a0;">' + r.report + '</span>' +
            '</div>'
        ).join('');

    } catch (error) {
        content.innerText = 'Error: Failed to contact the Free LLM API or backend.';
    } finally {
        btn.innerText = '🕵️‍♂️ Deploy Whale Spies';
        btn.disabled = false;
    }
});

const triggerAutoAI = async (symbol, smcData, liquidityData) => {
    let alertBox = document.getElementById('auto-alert-box');
    if (!alertBox) {
        alertBox = document.createElement('div');
        alertBox.id = 'auto-alert-box';
        alertBox.style = 'position:fixed; bottom:20px; right:20px; width:350px; background:rgba(26, 30, 41, 0.95); border:2px solid #2196f3; padding:15px; border-radius:8px; color:#fff; z-index:9999; box-shadow: 0 0 20px rgba(33, 150, 243, 0.5); font-family:Inter, sans-serif;';
        document.body.appendChild(alertBox);
    }

    alertBox.innerHTML = '<h3 style="margin:0 0 10px 0; color:#2196f3;">🚨 Zone Approaching!</h3><p style="font-size:12px; margin:0;">Local AI is waking up 10 Online Agents to verify the trade...</p>';
    alertBox.style.display = 'block';

    try {
        const context = {
            symbol: symbol,
            currentPrice: document.getElementById('live-price')?.innerText || 'Unknown',
            mtfaTrend: document.getElementById('mtfa-trend')?.innerText || 'Unknown',
            smcBias: document.getElementById('ai-signal')?.innerText || 'Unknown',
            netCoin: document.getElementById('net-coin')?.innerText || '0',
            buySpoofPct: document.getElementById('buy-spoof-pct')?.innerText || '0%',
            sellSpoofPct: document.getElementById('sell-spoof-pct')?.innerText || '0%',
            demandVolume: document.getElementById('volume-stats')?.children[0]?.innerText || '$0',
            quantConsensus: document.getElementById('quant-consensus')?.innerText || 'Unknown',
            fundingRate: document.getElementById('funding-rate')?.innerText || 'Unknown',
            openInterest: document.getElementById('open-interest')?.innerText || 'Unknown',
            supplyVolume: document.getElementById('volume-stats')?.children[1]?.innerText || '$0',
            isAutoTrigger: true
        };

        const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 15000);
        const res = await fetch('/api/whale-spies', { signal: controller.signal,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(context)
        });

        clearTimeout(timeoutId);
        const data = await res.json();
        
        let verdict = data.mastermind;
        let color = verdict.includes('WARNING') || verdict.includes('FAKE') || verdict.includes('WAIT') ? '#ff5252' : '#00e676';

        alertBox.style.borderColor = color;
        alertBox.style.boxShadow = `0 0 20px ${color}80`;
        
        alertBox.innerHTML = `<h3 style="margin:0 0 10px 0; color:${color};">🤖 Online AI Verdict</h3>
                              <div style="font-size:12px; line-height:1.5; margin-bottom:10px; white-space:pre-wrap; max-height:200px; overflow-y:auto;">${verdict}</div>
                              <button onclick="document.getElementById('auto-alert-box').style.display='none'" style="background:#363c4e; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; width:100%; font-weight:bold;">Acknowledge</button>`;

        // Reset trigger lock after 15 minutes to allow new alerts
        setTimeout(() => { window.aiAlertTriggered = false; }, 15 * 60 * 1000);

    } catch (err) {
        alertBox.innerHTML = '<p style="color:red;">Failed to contact Online AI.</p>';
        setTimeout(() => { alertBox.style.display = 'none'; window.aiAlertTriggered = false; }, 5000);
    }
};