const { ManagementClient } = require('auth0');
const { auth } = require('express-oauth2-jwt-bearer');
require('dotenv').config();

// 1. JWT Validation Middleware
const validateJWT = auth({
  audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  tokenSigningAlg: 'RS256'
});

// 2. Management API Client
const auth0 = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
});

/**
 * Fetch a user's roles from app_metadata.
 * @param {string} userId - Auth0 User ID
 */
const getUserRoles = async (userId) => {
    try {
        const user = await auth0.users.get({ id: userId });
        return user.data.app_metadata?.roles || [];
    } catch (error) {
        console.error('Error fetching user roles:', error);
        throw error;
    }
};

module.exports = {
  auth0,
  validateJWT,
  getUserRoles
};
