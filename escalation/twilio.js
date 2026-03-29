const client = require('twilio');
require('dotenv').config();

/*
const twilioClient = client(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
*/

/**
 * Trigger an automated call for high severity violations.
 * @param {string} to - recipient phone number
 * @param {string} message - text to speak
 */
const initiateCall = async (to, message) => {
  // TODO: Use twilio voice API
  console.log(`Initiating call to ${to}: ${message}`);
  return { sid: 'call_sid_123' };
};

module.exports = {
  initiateCall
};
