const axios = require('axios');

async function testSovereignFlow() {
    console.log("🚀 Testing PSI Sovereign Sentinel Flow...");
    
    const testPayload = {
        action: "diff --git a/config.js b/config.js\n+ const AWS_SECRET = 'AKIAIMNOJVY6NEXAMPLE';", 
        userId: "auth0|mock_intern_123",
        surface: "github",
        payload: { type: "push" }
    };

    try {
        console.log("1. Sending Level 5 Violation Payload to Backend...");
        const response = await axios.post('http://localhost:3005/api/github/intercept', testPayload);
        
        console.log("\n2. Backend Response Received:");
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.verdict === 'DENY') {
            console.log("\n✅ SUCCESS: Violation correctly DENIED by K2-Think.");
            console.log(`🔗 Tavus Live-Injection URL: ${response.data.tavusUrl}`);
            console.log(`🧠 Reasoning Trace Captured: ${response.data.thought_process.substring(0, 100)}...`);
        } else {
            console.log("\n❌ FAILED: Violation was not denied.");
        }

    } catch (error) {
        console.error("\n❌ TEST FAILED:", error.response?.data || error.message);
    }
}

testSovereignFlow();
