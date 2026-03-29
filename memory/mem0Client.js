const axios = require('axios');
require('dotenv').config();

const MEM0_API_KEY = process.env.MEM0_API_KEY;
const MEM0_ORG_ID = process.env.MEM0_ORG_ID || '';
const MEM0_PROJECT_ID = process.env.MEM0_PROJECT_ID || '';
const MEM0_BASE_URL = 'https://api.mem0.ai/v1';

const headers = {
  'Authorization': `Token ${MEM0_API_KEY}`,
  'Content-Type': 'application/json',
};

/**
 * Add an event to a user's persistent memory.
 * @param {string} userId - User ID
 * @param {string} content - event details
 */
const addToMemory = async (userId, content) => {
  try {
    const resp = await axios.post(`${MEM0_BASE_URL}/memories/`, {
      messages: [{ role: 'user', content }],
      user_id: userId,
      org_id: MEM0_ORG_ID,
      project_id: MEM0_PROJECT_ID,
    }, { headers, timeout: 10000 });
    return { status: 'recorded', data: resp.data };
  } catch (err) {
    console.warn('[Mem0] addToMemory failed:', err.message);
    return { status: 'error', error: err.message };
  }
};

/**
 * Recall relevant facts about a user.
 * @param {string} userId - User ID
 * @param {string} query - query for context
 */
const recallUserContext = async (userId, query) => {
  try {
    const resp = await axios.post(`${MEM0_BASE_URL}/memories/search/`, {
      query,
      user_id: userId,
      org_id: MEM0_ORG_ID,
      project_id: MEM0_PROJECT_ID,
    }, { headers, timeout: 10000 });
    // Return array of memory strings
    const results = resp.data.results || resp.data || [];
    return results.map(r => r.memory || r.text || r.content || JSON.stringify(r));
  } catch (err) {
    console.warn('[Mem0] recallUserContext failed:', err.message);
    return [];
  }
};

module.exports = {
  addToMemory,
  recallUserContext
};
