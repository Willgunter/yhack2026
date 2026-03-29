const { WebClient } = require('@slack/web-api');
require('dotenv').config();

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

/**
 * Send a notification to the security slack channel.
 * @param {Object} violation - data to notify
 */
const notify = async (violation) => {
  // TODO: Send Slack message
  console.log('Sending Slack Alert...', violation.id);
  return { ok: true };
};

module.exports = {
  notify
};
