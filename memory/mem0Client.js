const { Memory } = require('mem0ai/oss'); // Adjusting import based on official SDK
require('dotenv').config();

const memory = new Memory();

/**
 * Add an event to a user's persistent memory.
 * @param {string} userId - User ID
 * @param {string} content - event details
 */
const addToMemory = async (userId, content) => {
  // TODO: Implement Mem0 persistent memory update
  await memory.add(content, { user_id: userId });
  return { status: 'recorded' };
};

/**
 * Recall relevant facts about a user.
 * @param {string} userId - User ID
 * @param {string} query - query for context
 */
const recallUserContext = async (userId, query) => {
  // TODO: Contextual retrieval from Mem0
  const facts = await memory.search(query, { user_id: userId });
  return facts;
};

module.exports = {
  addToMemory,
  recallUserContext
};
