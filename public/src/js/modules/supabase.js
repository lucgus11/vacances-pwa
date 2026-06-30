// src/js/modules/supabase.js

const SUPABASE_URL = window.ENV?.SUPABASE_URL || '';
const SUPABASE_KEY = window.ENV?.SUPABASE_ANON_KEY || '';

// Détecte si les clés sont des placeholders ou vides
export function isConfigured() {
  return (
    SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('VOTRE_PROJECT') &&
    SUPABASE_KEY.length > 20 &&
    !SUPABASE_KEY.includes('VOTRE_ANON_KEY')
  );
}

const headers = () => ({
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer': 'return=representation',
});

async function query(table, params = '') {
  if (!isConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function insert(table, body) {
  if (!isConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function update(table, id, body) {
  if (!isConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function remove(table, id) {
  if (!isConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!r.ok) throw new Error(await r.text());
}

async function uploadFile(bucket, path, file) {
  if (!isConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
    body: file,
  });
  if (!r.ok) throw new Error(await r.text());
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

async function getConfig(key) {
  const rows = await query('config', `key=eq.${key}&select=value`);
  return rows[0]?.value ?? null;
}

async function setConfig(key, value) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.${key}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ value }),
  });
  if (!r.ok) await insert('config', { key, value });
}

export default { query, insert, update, remove, uploadFile, getConfig, setConfig, isConfigured };
