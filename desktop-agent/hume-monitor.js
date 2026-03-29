const path = require('path');
const WebSocket = require('ws'); // In desktop environment, 'ws' or native browser WebSocket works
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const HUME_API_KEY = process.env.HUME_API_KEY || 'PLACEHOLDER';
const HUME_EVI_WS_URL = `wss://api.hume.ai/v0/evi/chat?api_key=${HUME_API_KEY}`;

// Threshold for stress detection via Prosody models
const STRESS_THRESHOLD = 0.75; 
// Keywords indicating intentional bypass
const SECRET_KEYWORDS = ['password', 'bypass', 'secret key', 'don\'t tell', 'ignore the rules', 'leak'];

/**
 * Initializes Hume AI Emotional Voice Interceptor
 * @param {Function} onViolationCallback Triggered on detection of high-risk voice activity
 */
async function startHumeAudioMonitor(onViolationCallback) {
    try {
        console.log('🎙️ [Hume EVI]: Starting system audio monitoring...');

        // 1. In a real Electron app, use `electron-audio-loopback` to get the MediaStream
        // const { initMain } = require('electron-audio-loopback');
        // await initMain();
        
        // 2. Establish connection to Hume's Empathic Voice Interface
        const socket = new WebSocket(HUME_EVI_WS_URL);
        
        socket.on('open', () => {
            console.log('✅ Connectected to Hume EVI Sovereign WebSocket.');
            // Here you would continuously capture mic/loopback PCM data and send:
            // socket.send(JSON.stringify({ type: 'audio_input', data: base64AudioChunk }));
        });

        socket.on('message', (data) => {
            const message = JSON.parse(data.toString());

            if (message.type === 'user_message') {
                const transcript = message.message.content.toLowerCase();
                const prosodyScores = message.models?.prosody?.scores;
                
                // Risk Analysis: 1. Is there high Anxiety/Stress/Fear?
                const isStressed = prosodyScores && 
                    (prosodyScores.Anxiety > STRESS_THRESHOLD || 
                     prosodyScores.Fear > STRESS_THRESHOLD || 
                     prosodyScores.Distress > STRESS_THRESHOLD);

                // Risk Analysis: 2. Are they saying something they shouldn't?
                const isLeaking = SECRET_KEYWORDS.some(word => transcript.includes(word));

                if (isLeaking && isStressed) {
                    console.log(`🚨 HUME EVI VIOLATION DETECTED! Trans: "${transcript}"`);
                    onViolationCallback({
                        reason: 'High-stress vocal anomaly matched with restricted keyword leakage.',
                        transcript: transcript,
                        emotionData: prosodyScores
                    });
                }
            }
        });

        socket.on('error', (err) => {
            console.warn('Hume API WebSocket Error (Skipping if no key provided):', err.message);
        });

        // Simulate a Voice Violation after 15 seconds for Demo purposes
        setTimeout(() => {
            const demoTranscript = "Okay, I'm just going to bypass the rules and push this secret key now.";
            if (SECRET_KEYWORDS.some(word => demoTranscript.toLowerCase().includes(word))) {
                 console.log(`🎙️ [Hume EVI Demo Trigger]: Simulated Voice Violation -> "${demoTranscript}"`);
                 onViolationCallback({
                     reason: 'Simulated high-stress bypass intent.',
                     transcript: demoTranscript,
                     emotionData: { Anxiety: 0.85, Determination: 0.90 }
                 });
            }
        }, 15000);

    } catch (error) {
        console.error('Failed to start Hume Audio Monitor:', error.message);
    }
}

module.exports = { startHumeAudioMonitor };
