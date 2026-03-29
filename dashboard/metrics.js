const { supabase } = require('../database/supabase');

/**
 * Fetch top-level governance metrics for the dashboard.
 */
const getMetrics = async () => {
    // TODO: Query violation stats and risk scores
    return {
        totalViolations:  0,
        activeCritical: 0,
        complianceRate:  '100%'
    };
};

module.exports = {
    getMetrics
};
