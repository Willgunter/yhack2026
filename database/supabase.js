const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load .env relative to this file's location (works both in dev and packaged Electron)
let envPath = path.resolve(__dirname, '..', '.env');
if (process.resourcesPath && require('fs').existsSync(path.join(process.resourcesPath, 'app.asar', '.env'))) {
    envPath = path.join(process.resourcesPath, 'app.asar', '.env');
}
require('dotenv').config({ path: envPath });

// Fallback: also try same directory (for dev mode)
if (!process.env.SUPABASE_URL) {
  require('dotenv').config({ path: path.resolve(__dirname, '.env') });
}

const supabaseUrl = process.env.SUPABASE_URL || 'https://hsultqvbrcvfbvlxbzzv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_r0J8uDqhWgVSrGaRCZG7Og_AabyWkwQ';

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('[Supabase] Client initialized successfully.');
} else {
  console.warn('[Supabase] WARNING: Missing SUPABASE_URL or key. Running in offline/mock mode.');
}

/**
 * Insert a new governance violation record.
 */
const insertViolation = async (data) => {
  if (!supabase) { console.warn('[Supabase] Offline — skipping insertViolation'); return null; }
  const { data: result, error } = await supabase.from('violations').insert([data]);
  if (error) throw error;
  return result;
};

/**
 * Fetch user details by ID.
 */
const getUser = async (userId) => {
  if (!supabase) { console.warn('[Supabase] Offline — skipping getUser'); return null; }
  const { data, error } = await supabase.from('user_risk_profiles').select('*').eq('user_id', userId).single();
  if (error) throw error;
  return data;
};

/**
 * Update an existing violation record.
 */
const updateViolation = async (id, data) => {
  if (!supabase) { console.warn('[Supabase] Offline — skipping updateViolation'); return null; }
  const { data: result, error } = await supabase.from('violations').update(data).eq('id', id);
  if (error) throw error;
  return result;
};

/**
 * Fetch active policies for RAG injection into K2-Think.
 */
const getActivePolicies = async () => {
  if (!supabase) { console.warn('[Supabase] Offline — returning empty policies'); return []; }
  const { data, error } = await supabase.from('policies').select('name, rules, slack_alert_channel').eq('active', true).order('created_at', { ascending: false }).limit(5);
  if (error) { console.warn('[Supabase] policies fetch failed:', error.message); return []; }
  return data || [];
};

/**
 * List all policies (for dashboard).
 */
const listPolicies = async () => {
  if (!supabase) { console.warn('[Supabase] Offline — returning empty policy list'); return []; }
  const { data, error } = await supabase.from('policies').select('id, name, source, active, created_at, slack_alert_channel, rules').order('created_at', { ascending: false });
  if (error) { console.warn('[Supabase] listPolicies failed:', error.message); return []; }
  return data || [];
};

module.exports = {
  supabase,
  insertViolation,
  getUser,
  updateViolation,
  getActivePolicies,
  listPolicies
};
