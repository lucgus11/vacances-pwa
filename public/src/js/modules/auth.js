// src/js/modules/auth.js
import db, { isConfigured } from './supabase.js';

const SESSION_KEY = 'ardoise_session';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function login(name, password) {
  if (!name.trim()) throw new Error('Veuillez entrer votre prénom.');

  // --- Vérification config Supabase ---
  if (!isConfigured()) {
    throw new Error(
      '⚙️ Supabase non configuré. Ouvrez le fichier public/env.js et renseignez votre SUPABASE_URL et SUPABASE_ANON_KEY.'
    );
  }

  const hash = await sha256(password);
  let storedHash = null;

  try {
    storedHash = await db.getConfig('password_hash');
  } catch (e) {
    // Réseau KO → fallback localStorage (mode offline)
    storedHash = localStorage.getItem('ardoise_pw_hash');
    if (!storedHash) {
      throw new Error(
        '❌ Impossible de joindre Supabase. Vérifiez votre connexion et que le schéma SQL a bien été exécuté.'
      );
    }
  }

  if (!storedHash) {
    throw new Error(
      '❌ Aucun mot de passe trouvé dans la base. Avez-vous bien exécuté le fichier supabase/schema.sql ?'
    );
  }

  if (hash !== storedHash) throw new Error('Mot de passe incorrect. Réessayez.');

  // Mise en cache pour usage offline
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
