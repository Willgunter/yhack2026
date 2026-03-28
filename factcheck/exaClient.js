const axios = require('axios');
require('dotenv').config();

const EXA_URL = 'https://api.exa.ai/search';

/**
 * Fact-check an action by searching for recent regulatory news or public benchmarks.
 * @param {string} query - query for fact-checking
 */
const exaSearch = async (query) => {
  // TODO: Search using Exa API
  return { results: [], analysis: 'No conflicting external data found' };
};

module.exports = {
  exaSearch
};
