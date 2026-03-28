const axios = require('axios');
require('dotenv').config();

async function checkVitals() {
  console.log("🛡️ Checking Praesidia Sovereign Vitals...");
  
  const apis = [
    { 
      name: "K2-Think", 
      url: "https://api.k2think.ai/v1/models", 
      headers: { 'Authorization': `Bearer ${process.env.K2_API_KEY}` } 
    },
    { 
      name: "Tavus", 
      url: "https://tavusapi.com/v2/replicas", 
      headers: { 'x-api-key': process.env.TAVUS_API_KEY } 
    },
    { 
      name: "Resend", 
      url: "https://api.resend.com/emails", 
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` } 
    }
  ];

  for (const api of apis) {
    try {
      await axios.get(api.url, { headers: api.headers });
      console.log(`✅ ${api.name}: Online`);
    } catch (e) {
      console.log(`⚠️ ${api.name}: Check Keys/Status (Code: ${e.response?.status || 'Unknown'})`);
    }
  }
}

checkVitals();
