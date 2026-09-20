let chart, candleSeries;
let markers = [];

// Create chart
function initChart() {
    const container = document.getElementById('chart-container');
    
    // Set local timezone
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    chart = LightweightCharts.createChart(container, {
        layout: {
            background: { type: 'solid', color: '#131722' },
            textColor: '#d1d4dc',
        },
        grid: {
            vertLines: { color: '#2b313f' },
            horzLines: { color: '#2b313f' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: '#2b313f',
        },
        timeScale: {
            borderColor: '#2b313f',
            timeVisible: true,
        }
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#009688',
        downColor: '#ff5252',
        borderVisible: false,
        wickUpColor: '#009688',
        wickDownColor: '#ff5252',
    });

    const resizeObserver = new ResizeObserver(entries => {
        if (entries.length === 0 || entries[0].target !== container) { return; }
        const newRect = entries[0].contentRect;
        chart.resize(newRect.width, newRect.height);
    });
    resizeObserver.observe(container);
}

function showLoading(show) {
    const overlay = document.getElementById('overlay');
    const spinner = document.getElementById('spinner');
    const errorMsg = document.getElementById('error-msg');
    const refreshBtn = document.getElementById('refreshBtn');

    refreshBtn.disabled = show;
    
    if (show) {
        overlay.style.display = 'flex';
        spinner.style.display = 'block';
        errorMsg.style.display = 'none';
    } else {
        overlay.style.display = 'none';
    }
}

function showError(msg) {
    const overlay = document.getElementById('overlay');
    const spinner = document.getElementById('spinner');
    const errorMsg = document.getElementById('error-msg');
    
    overlay.style.display = 'flex';
    spinner.style.display = 'none';
    errorMsg.style.display = 'block';
    errorMsg.innerText = msg;
}

async function fetchData(symbol, interval) {
    showLoading(true);
    try {
        document.title = `Loading...`;
        const response = await fetch(`/api/market-data?symbol=${symbol}&interval=${interval}&limit=500`);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.candles || data.candles.length === 0) {
            throw new Error("No data returned from Binance.");
        }

        // 1. Set Candlestick data
        candleSeries.setData(data.candles);

        // 2. Set Markers for SMC (FVG & OB)
        markers = [];
        const markerMap = new Map(); // Prevent identical timestamp crash
        
        const addMarker = (time, marker) => {
            if(!markerMap.has(time)) markerMap.set(time, []);
            markerMap.get(time).push(marker);
        };

        // Map FVGs
        data.fvgs.forEach(fvg => {
            if(fvg.type === 'bullish_fvg') {
                addMarker(fvg.time, { time: fvg.time, position: 'belowBar', color: '#009688', shape: 'arrowUp', text: 'FVG (BULL)' });
            } else {
                addMarker(fvg.time, { time: fvg.time, position: 'aboveBar', color: '#ff5252', shape: 'arrowDown', text: 'FVG (BEAR)' });
            }
        });

        // Map OBs
        data.orderBlocks.forEach(ob => {
            if(ob.type === 'bullish_ob') {
                addMarker(ob.time, { time: ob.time, position: 'belowBar', color: '#2962ff', shape: 'circle', text: 'OB (BULL)' });
            } else {
                addMarker(ob.time, { time: ob.time, position: 'aboveBar', color: '#ff9800', shape: 'circle', text: 'OB (BEAR)' });
            }
        });

        // Resolve overlaps
        markerMap.forEach((marks, time) => {
            if (marks.length === 1) {
                markers.push(marks[0]);
            } else {
                // If multiple markers on exact same timestamp, just use a generic 'Multiple' marker
                // Or we can just pick the first one and append text
                let text = marks.map(m => m.text).join(' + ');
                let m = marks[0];
                m.text = text;
                markers.push(m);
            }
        });

        // Sort markers by time as required by lightweight charts
        markers.sort((a, b) => a.time - b.time);
        
        candleSeries.setMarkers(markers);
        document.title = `SMC Dashboard - ${symbol}`;
        showLoading(false);

    } catch(err) {
        console.error("Failed to load data", err);
        showError(`Failed to load data:\n${err.message}`);
        document.title = `Error`;
        document.getElementById('refreshBtn').disabled = false;
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    
    const symbolEl = document.getElementById('symbol');
    const intervalEl = document.getElementById('interval');
    const refreshBtn = document.getElementById('refreshBtn');

    const load = () => fetchData(symbolEl.value, intervalEl.value);

    symbolEl.addEventListener('change', load);
    intervalEl.addEventListener('change', load);
    refreshBtn.addEventListener('click', load);

    // Initial Load
    load();
});
