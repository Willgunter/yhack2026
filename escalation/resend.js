const axios = require('axios');
require('dotenv').config();

const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Send an alert email to the security team.
 * @param {Object} violation - data to notify
 */
const sendAlertEmail = async (violation) => {
  // TODO: Use Resend API to send notification
  console.log(`Sending Email via Resend for violation ${violation.id}`);
  return { id: 'email_123' };
};

module.exports = {
  sendAlertEmail
};
