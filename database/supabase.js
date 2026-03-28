const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Insert a new governance violation record.
 * @param {Object} data - violation details
 */
const insertViolation = async (data) => {
  const { data: result, error } = await supabase
    .from('violations')
    .insert([data]);
  
  if (error) throw error;
  return result;
};

/**
 * Fetch user details by ID.
 * @param {string} userId - User ID
 */
const getUser = async (userId) => {
  const { data, error } = await supabase
    .from('user_risk_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) throw error;
  return data;
};

/**
 * Update an existing violation record.
 * @param {string} id - Violation UUID
 * @param {Object} data - Updated fields
 */
const updateViolation = async (id, data) => {
  const { data: result, error } = await supabase
    .from('violations')
    .update(data)
    .eq('id', id);
  
  if (error) throw error;
  return result;
};

module.exports = {
  supabase,
  insertViolation,
  getUser,
  updateViolation
};
