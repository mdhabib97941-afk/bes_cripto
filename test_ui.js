const puppeteer = require('puppeteer');

(async () => {
    try {
        console.log("Launching browser...");
        const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        
        let errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error' && !msg.text().includes('favicon.ico') && !msg.text().includes('404')) {
                errors.push(msg.text());
            }
        });
        page.on('pageerror', err => errors.push(err.toString()));

        console.log("Navigating to http://localhost:3000 ...");
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        
        console.log("Waiting for chart to render...");
        await new Promise(r => setTimeout(r, 3000)); // Wait a bit for api fetch and render

        // Check if chart canvas exists and has dimensions
        const chartStatus = await page.evaluate(() => {
            const table = document.querySelector('.tv-lightweight-charts');
            const canvases = document.querySelectorAll('canvas');
            
            let totalHeight = 0;
            let totalWidth = 0;
            canvases.forEach(c => {
                totalHeight += c.clientHeight;
                totalWidth += c.clientWidth;
            });

            const errorMsg = document.getElementById('error-msg');
            
            return {
                tableExists: !!table,
                canvasCount: canvases.length,
                totalCanvasHeight: totalHeight,
                totalCanvasWidth: totalWidth,
                visibleError: errorMsg ? errorMsg.style.display !== 'none' : false,
                errorText: errorMsg ? errorMsg.innerText : ''
            };
        });

        console.log("Chart Render Status:", chartStatus);
        console.log("Console Errors:", errors);
        
        await browser.close();
        
        // Validation
        if (errors.length > 0) {
            console.error("FAILED: Browser console errors detected.");
            process.exit(1);
        }
        if (chartStatus.canvasCount === 0 || chartStatus.totalCanvasHeight === 0) {
            console.error("FAILED: Chart canvas did not render or has 0 height.");
            process.exit(1);
        }
        if (chartStatus.visibleError) {
            console.error("FAILED: UI is showing an error message:", chartStatus.errorText);
            process.exit(1);
        }

        console.log("SUCCESS: UI Test passed perfectly. Chart rendered without errors.");
        process.exit(0);
    } catch (e) {
        console.error("Test execution failed:", e);
        process.exit(1);
    }
})();
