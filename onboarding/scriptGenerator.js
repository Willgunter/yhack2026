/**
 * Generate a personalized onboarding script for a user.
 * @param {Object} userData - user metadata
 */
const generateScript = async (userData) => {
  // TODO: Create dynamic script with company policies
  return `Welcome ${userData.user_name},  let's review our AI standards.`;
};

module.exports = {
  generateScript
};
