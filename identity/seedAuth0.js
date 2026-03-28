const { auth0 } = require('./auth0Client');
require('dotenv').config();

const rolesToCreate = [
  {"name": "Intern", "description": "High-frequency monitoring, restricted PII access."},
  {"name": "Junior Dev", "description": "Standard dev, subject to automated guardrails."},
  {"name": "Senior Dev", "description": "Low-frequency monitoring, trusted access."},
  {"name": "Compliance Manager", "description": "Full audit access and block override power."}
];

const TEST_USER_ID = process.env.TEST_USER_ID;

/**
 * Seed roles and assign the initial 'Intern' role to the test user.
 */
const seedAuth0 = async () => {
    try {
        console.log('--- Starting Auth0 Seed Process ---');
        
        // 1. Create Roles in Auth0 (if they don't exist)
        for (const role of rolesToCreate) {
            try {
                await auth0.roles.create({
                    name: role.name,
                    description: role.description
                });
                console.log(`[Role Created]: ${role.name}`);
            } catch (err) {
                if (err.statusCode === 409) {
                    console.log(`[Role Skip]: ${role.name} already exists.`);
                } else {
                    console.error(`[Role Error]: Failed to create ${role.name}`, err.message);
                }
            }
        }

        // 2. Assign 'Intern' role to TEST_USER_ID
        if (TEST_USER_ID) {
            // Find the 'Intern' role ID first
            const allRoles = await auth0.roles.getAll();
            const internRole = allRoles.data.find(r => r.name === 'Intern');
            
            if (internRole) {
                await auth0.users.assignRoles({ id: TEST_USER_ID }, { roles: [internRole.id] });
                console.log(`[Assignment Success]: Assigned 'Intern' role to user ${TEST_USER_ID}`);
            } else {
                console.error('[Assignment Error]: Could not find Intern role ID.');
            }
        } else {
            console.log('[Assignment Skip]: No TEST_USER_ID found in .env');
        }

        console.log('--- Auth0 Seed Process Completed ---');
    } catch (error) {
        console.error('CRITICAL SEED ERROR:', error);
    }
};

if (require.main === module) {
    seedAuth0();
}

module.exports = { seedAuth0 };
