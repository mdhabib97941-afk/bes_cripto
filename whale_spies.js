const axios = require('axios');

const FREE_API_KEY = 'freellmapi-b727194adc490f0b1f3479ec394b3e2852286b2b5c50d8dd';
const FREE_BASE_URL = 'https://freellmapi-5ybc.onrender.com/v1';

async function askAgent(agentName, systemPrompt, marketData) {
    const prompt = `
    Market Data Context:
    Symbol: ${marketData.symbol}
    Current Price: ${marketData.currentPrice}
    Trend (4H): ${marketData.mtfaTrend}
    SMC Bias: ${marketData.smcBias}
    Whale Net Bag: ${marketData.netCoin} coins
    Buy Spoofing: ${marketData.buySpoofPct}% | Sell Spoofing: ${marketData.sellSpoofPct}%
    Demand Vol: ${marketData.demandVolume} Base Asset | Supply Vol: ${marketData.supplyVolume} Base Asset
    Recent Sweeps: ${marketData.lastSweep}
    Active Setup: ${JSON.stringify(marketData.setup)}
    Auto-Triggered Alert: ${marketData.isAutoTrigger ? "YES. PRICE IS CURRENTLY TOUCHING THE ENTRY ZONE. VALIDATE IMMEDIATELY!" : "No"}

    Task: You are ${agentName}. ${systemPrompt} 
    Respond in 2-3 concise, highly advanced sentences. No generic advice. Focus only on institutional/whale behavior.`;

    try {
        const response = await axios.post(`${FREE_BASE_URL}/chat/completions`, {
            model: "auto",
            messages: [
                { role: "system", content: "You are an elite institutional trading algorithm." },
                { role: "user", content: prompt }
            ],
            max_tokens: 150
        }, {
            headers: {
                'Authorization': `Bearer ${FREE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000 // 15 seconds timeout
        });
        
        return { agent: agentName, report: response.data.choices[0].message.content.trim() };
    } catch (error) {
        console.error(`${agentName} API failed:`, error.message);
        // Fallback: If free API fails, return a procedural algorithmic estimation
        return { agent: agentName, report: `[Fallback Mode] Analysis indicates highly restricted liquidity flow. Proceed with extreme caution at current levels.` };
    }
}

async function deployWhaleSpies(marketData) {
    const agents = [
        { name: "Accumulation_Spy", prompt: "Analyze the Buy Spoofing and Net Coin data to detect if whales are secretly accumulating before a massive pump." },
        { name: "Distribution_Spy", prompt: "Analyze the Sell Spoofing and Supply Volume to detect if whales are secretly distributing (selling off) to trap retail buyers." },
        { name: "Liquidity_Hunter", prompt: "Analyze the SMC Bias and Order Blocks to predict where the next major liquidity sweep will happen. Where is the retail stop-loss pool?" },
        { name: "Trap_Spotter", prompt: "Look at the Recent Sweeps (IDM) and Active Setup. Are retail breakout traders currently being trapped?" },
        { name: "Tape_Reader", prompt: "Read the Whale Net Bag and Demand vs Supply Volume. Who is actually in control of the market market-orders right now?" },
        { name: "OrderBook_Sniper", prompt: "Analyze the spoofing percentages. Are there fake walls being placed to manipulate the price direction?" },
        { name: "Structure_Architect", prompt: "Look at the 4H Trend vs SMC Bias. Is the current timeframe aligning with the macro institutional trend?" },
        { name: "Timing_Expert", prompt: "Based on all data, are we in the 'Pre-Manipulation', 'Accumulation', or 'Expansion' phase of the institutional cycle?" },
        { name: "Risk_Assessor", prompt: "Evaluate the Active Setup. Is the Risk/Reward structurally safe against sudden whale stop-hunts?" }
    ];

    // Execute 9 agents concurrently (Parallel Execution Rule)
    console.log("Deploying 9 Specialized Whale Spies concurrently...");
    const reports = await Promise.all(agents.map(a => askAgent(a.name, a.prompt, marketData)));

    let synthesisContext = reports.map(r => `${r.agent}: ${r.report}`).join('\n');

    // 10th Agent: The Mastermind
    console.log("Deploying the Mastermind Spy...");
    const mastermindPrompt = `
    You are the Mastermind Whale Spy. Review the reports from your 9 specialized agents:
    ${synthesisContext}
    
    1000 Local Quant Agents Consensus: ${marketData.quantConsensus}

    Note: You must consider the 1000 Local Quant Agents Consensus. If the 1000 Quants disagree with the Spies, state who you trust more.

    Write a final, highly advanced, Bengali/Banglish mixed Mastermind Verdict (4-5 bullet points). 
    YOU MUST EXPLICITLY INCLUDE:
    1. PLAN: Is the ultimate plan to go LONG, SHORT, or WAIT?
    2. ZONE STATUS: Has the price reached our Entry Zone yet?
    3. VALIDITY & WARNING: If the dashboard shows a setup (e.g. SHORT) but whales are currently buying (Accumulating/Buy Spoofing), you MUST issue a strict "⚠️ WARNING: FAKE SETUP" alert.
    4. WHALE ACTION: Tell the user exactly what the whales are doing right now and who is being trapped.`;

    try {
        const response = await axios.post(`${FREE_BASE_URL}/chat/completions`, {
            model: "auto",
            messages: [
                { role: "system", content: "You are the Mastermind Elite Trading Agent." },
                { role: "user", content: mastermindPrompt }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${FREE_API_KEY}`, 'Content-Type': 'application/json' }
        });
        
        return {
            individualReports: reports,
            mastermind: response.data.choices[0].message.content.trim()
        };
    } catch (err) {
        console.error("Mastermind API failed:", err.message);
        return {
            individualReports: reports,
            mastermind: "Mastermind API Offline. Please rely on individual spy reports."
        };
    }
}

module.exports = { deployWhaleSpies };
