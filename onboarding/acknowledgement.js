const { supabase } = require('../database/supabase');

/**
 * Record a user's acknowledgement of the policy video for compliance.
 * @param {string} userId - User ID
 * @param {string} videoId - corresponding Tavus video ID
 */
const recordAcknowledgement = async (userId, videoId) => {
  // TODO: Insert record into policy_acknowledgements table
  console.log(`User ${userId} acknowledged video ${videoId}`);
  return { status: 'acknowledged' };
};

module.exports = {
  recordAcknowledgement
};
