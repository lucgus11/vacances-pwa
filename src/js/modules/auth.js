// src/js/modules/auth.js
import db from './supabase.js';

const SESSION_KEY = 'ardoise_session';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function login(name, password) {
  if (!name.trim()) throw new Error('Veuillez entrer votre prénom.');
  const hash = await sha256(password);
  let storedHash;
  try {
    storedHash = await db.getConfig('password_hash');
  } catch {
    // offline – check cache
    storedHash = localStorage.getItem('ardoise_pw_hash');
  }
  if (!storedHash) throw new Error('Impossible de vérifier le mot de passe (hors ligne ?).');
  if (hash !== storedHash) throw new Error('Mot de passe incorrect.');
  // Cache hash for offline use
  localStorage.setItem('ardoise_pw_hash', storedHash);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ name: name.trim(), loggedAt: Date.now() }));
  return name.trim();
}

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch { return null; }
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
}

export async function changePassword(newPassword, confirmPassword) {
  if (newPassword !== confirmPassword) throw new Error('Les mots de passe ne correspondent pas.');
  if (newPassword.length < 6) throw new Error('6 caractères minimum.');
  const hash = await sha256(newPassword);
  await db.setConfig('password_hash', hash);
  localStorage.setItem('ardoise_pw_hash', hash);
}
