// Using native fetch for better packaging compatibility
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TAVUS_API_KEY = process.env.TAVUS_API_KEY;

// Role map according to request
const roleMap = {
    'Intern': 'seeronsiva6@gmail.com',
    'Senior Developer': 'seerondev@gmail.com',
    'Compliance Lead': 'seeronsubscriptions@gmail.com'
};

/**
 * 
 * @param {string} customScript The text Tavus replica should speak
 * @param {string} replicaId The ID of the replica (Compliance Officer)
 * @returns {string} The hosted_url for the generated video (or placeholder if it fails)
 */
async function generateTavusVideo(customScript, replicaId = process.env.TAVUS_REPLICA_ID) {
    try {
        console.log(`🎥 Initiating Tavus POST v2/videos...`);
        
        const payload = {
            replica_id: replicaId,
            script: customScript,
            video_name: `Sovereign_Alert_${Date.now()}`,
            properties: {
                "fast": true,
                "max_seconds": 20,
                "crop": "16:9"
            }
        };

        console.log(`📡 Sending Payload to Tavus:`, JSON.stringify(payload, null, 2));

        const response = await fetch('https://tavusapi.com/v2/videos', {
            method: 'POST',
            headers: {
                'x-api-key': TAVUS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Tavus API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`✅ Tavus Fast-Video Generated: ${data.hosted_url}`);
        return data.hosted_url;

    } catch (error) {
        console.error('Tavus Generator Error:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Email the appropriate manager using Resend.
 * Small violations -> Senior Developer
 * Level 5 violations -> Compliance Lead
 */
async function escalateViaEmail(level, reasoningTrace, tavusUrl) {
    let toEmail = roleMap['Senior Developer']; // Default escalation
    let managerTitle = 'Senior Developer';

    if (level === 5) {
        toEmail = roleMap['Compliance Lead'];
        managerTitle = 'Compliance Lead';
    }

    try {
        console.log(`📩 Dispatching Resend email via API to ${managerTitle} (${toEmail})...`);
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Praesidia Sovereign <onboarding@resend.dev>',
                to: toEmail,
                subject: `[PSI Alert] Level ${level} Violation by Intern`,
                html: `
                    <h2>Sovereign Agent Governance Report</h2>
                    <p><strong>Severity:</strong> Level ${level}</p>
                    <p>An Intern has committed a violation of the Sovereign Charter.</p>
                    
                    <h3>K2-Think Reasoning Trace:</h3>
                    <pre style="background: #eee; padding: 10px; border-radius: 5px;">${reasoningTrace}</pre>
                    
                    <h3>Live-Injection PSI Script Sent:</h3>
                    ${tavusUrl ? `<p><a href="${tavusUrl}" style="color:red; font-weight:bold;">View Confrontation Video</a></p>` : '<p>Tavus Video generation failed or was bypassed.</p>'}
                    <br>
                    <p><em>End of automated report.</em></p>
                `
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Resend API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('✅ Escalation Email Sent Successfully:', data.id);
    } catch (err) {
        console.error('Escalation Request Failed:', err.response?.data || err.message);
    }
}

module.exports = { generateTavusVideo, escalateViaEmail, roleMap };
