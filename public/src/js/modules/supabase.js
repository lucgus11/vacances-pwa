// src/js/modules/supabase.js
// Thin wrapper around the Supabase REST API (no SDK needed in plain JS)

const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://VOTRE_PROJECT.supabase.co';
const SUPABASE_KEY = window.ENV?.SUPABASE_ANON_KEY || 'VOTRE_ANON_KEY';

const headers = () => ({
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer': 'return=representation',
});

// Generic REST helpers
async function query(table, params = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function insert(table, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function update(table, id, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function remove(table, id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!r.ok) throw new Error(await r.text());
}

// Storage upload
async function uploadFile(bucket, path, file) {
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

// Realtime (simple polling fallback – works without websockets)
function subscribe(table, callback, intervalMs = 5000) {
  let lastCheck = new Date().toISOString();
  const id = setInterval(async () => {
    try {
      const rows = await query(table, `created_at=gt.${lastCheck}&order=created_at.asc`);
      if (rows.length) {
        lastCheck = rows[rows.length - 1].created_at;
        callback(rows);
      }
    } catch { /* offline – silently ignore */ }
  }, intervalMs);
  return () => clearInterval(id);
}

// Config helpers
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
  if (!r.ok) {
    // try insert if not exists
    await insert('config', { key, value });
  }
}

export default { query, insert, update, remove, uploadFile, subscribe, getConfig, setConfig };
