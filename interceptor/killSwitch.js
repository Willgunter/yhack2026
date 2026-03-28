/**
 * Emergency function to block all outgoing actions from a compromised surface.
 * @param {string} surface - github, slack, etc.
 * @param {string} userId - ID of the user triggering the block
 */
const initiateKillSwitch = async (surface, userId) => {
  // TODO: Implement emergency block across surfaces
  console.log(`KILL SWITCH ACTIVATED for ${userId} on ${surface}`);
  return { status: 'blocked' };
};

module.exports = {
  initiateKillSwitch
};
