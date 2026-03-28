const axios = require('axios');
require('dotenv').config();

const TAVUS_URL = 'https://api.tavus.ai/v2/videos';

/**
 * Generate a personalized AI video for user onboarding.
 * @param {string} userId - User ID
 * @param {string} script - text for the video
 */
const generateOnboardingVideo = async (userId, script) => {
  // TODO: Use Tavus API to generate personalized video
  console.log(`Generating Tavus video for user ${userId}`);
  return { videoId: 'tavus_video_123' };
};

module.exports = {
  generateOnboardingVideo
};
