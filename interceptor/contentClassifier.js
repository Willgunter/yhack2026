/**
 * Classify action content (code, email, slack message) to detect intent.
 * @param {string} content - content to categorize
 */
const classifyContent = async (content) => {
  // TODO: Use NLP or prompt-based classification
  return { type: 'code_push', sensitive: false };
};

module.exports = {
  classifyContent
};
