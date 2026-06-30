// src/js/app.js – point d'entrée principal
import { login, getSession, logout, changePassword } from './modules/auth.js';
import { loadPlanning, openPlanningModal, savePlanningItem } from './modules/planning.js';
import { loadIdeas, saveIdea, setFilter, spinRoulette } from './modules/ideas.js';
import { loadTickets, handleTicketFileInput } from './modules/tickets.js';
import { loadPhotos, handlePhotoFiles } from './modules/photos.js';
import { showToast, initModalHandlers, closeAllModals } from './modules/ui.js';
import db from './modules/supabase.js';

// ======== SERVICE WORKER =========
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    console.log('[SW] Registered', reg.scope);
  }).catch(err => console.warn('[SW] Registration failed', err));
}

// ======== ONLINE / OFFLINE =========
function updateOnlineStatus() {
  const badge = document.getElementById('offline-badge');
  badge.classList.toggle('hidden', navigator.onLine);
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ======== TABS =========
let activeTab = 'planning';
const tabLoaders = {
  planning: () => loadPlanning(),
  ideas:    () => loadIdeas(),
  tickets:  () => loadTickets(),
  photos:   () => loadPhotos(),
};

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(`tab-${tab}`)?.classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  tabLoaders[tab]?.();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ======== AUTH =========
const loginScreen = document.getElementById('screen-login');
const appEl = document.getElementById('app');

document.getElementById('btn-login').addEventListener('click', async () => {
  const name = document.getElementById('login-name').value.trim();
  const pw   = document.getElementById('login-password').value;
  const err  = document.getElementById('login-error');
  err.classList.add('hidden');
  try {
    const user = await login(name, pw);
    startApp(user);
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  }
});

// Allow Enter key on login
['login-name','login-password'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
  });
});

function startApp(user) {
  loginScreen.classList.add('hidden');
  appEl.classList.remove('hidden');
  document.getElementById('header-username').textContent = user;

  // Load vacation name
  db.getConfig('vacation_name').then(name => {
    if (name) document.getElementById('vacation-name').textContent = name;
  }).catch(() => {});

  // Pass username to all modules
  const u = user;
  loadPlanning(u); loadIdeas(u); loadTickets(u); loadPhotos(u);

  switchTab('planning');

  // Polling for real-time updates (every 10s on active tab)
  setInterval(() => {
    if (navigator.onLine) tabLoaders[activeTab]?.();
  }, 10000);
}

// Check existing session
const session = getSession();
if (session) {
  startApp(session.name);
} else {
  loginScreen.classList.remove('hidden');
}

// ======== MODALS GLOBAL =========
initModalHandlers();

// ======== PLANNING =========
document.getElementById('btn-add-planning').addEventListener('click', () => {
  openPlanningModal();
  document.getElementById('modal-planning').classList.remove('hidden');
});

document.getElementById('form-planning').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await savePlanningItem(new FormData(e.target));
    closeAllModals();
    showToast('✅ Planning mis à jour !');
  } catch (err) {
    showToast('❌ ' + err.message, 'red');
  }
});

// ======== IDEAS =========
document.getElementById('btn-add-idea').addEventListener('click', () => {
  document.getElementById('modal-idea').classList.remove('hidden');
});

document.getElementById('form-idea').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await saveIdea(new FormData(e.target));
    closeAllModals();
    showToast('💡 Idée ajoutée !');
  } catch (err) {
    showToast('❌ ' + err.message, 'red');
  }
});

// Filter tabs
document.querySelectorAll('.idea-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.idea-filter').forEach(b => {
      b.classList.remove('bg-white','shadow','text-gray-800');
      b.classList.add('text-gray-500');
    });
    btn.classList.add('bg-white','shadow','text-gray-800');
    btn.classList.remove('text-gray-500');
    setFilter(btn.dataset.filter);
  });
});

// Roulette
document.getElementById('btn-roulette').addEventListener('click', () => {
  document.getElementById('modal-roulette').classList.remove('hidden');
  document.getElementById('roulette-result').textContent = '';
  document.getElementById('roulette-display').textContent = '🎯';
});

document.getElementById('btn-spin').addEventListener('click', () => {
  spinRoulette();
});

// ======== TICKETS =========
document.getElementById('ticket-file-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  await handleTicketFileInput(file);
  e.target.value = '';
});

// ======== PHOTOS =========
document.getElementById('photo-file-input').addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  await handlePhotoFiles(files);
  e.target.value = '';
});

// ======== SETTINGS =========
document.getElementById('btn-settings').addEventListener('click', async () => {
  document.getElementById('modal-settings').classList.remove('hidden');
  try {
    const name = await db.getConfig('vacation_name');
    if (name) document.getElementById('settings-vacation-name').value = name;
  } catch {}
});

document.getElementById('btn-save-settings').addEventListener('click', async () => {
  const msg = document.getElementById('settings-msg');
  msg.className = 'text-sm text-center font-medium';
  msg.classList.remove('hidden');

  try {
    const vacName = document.getElementById('settings-vacation-name').value.trim();
    if (vacName) {
      await db.setConfig('vacation_name', vacName);
      document.getElementById('vacation-name').textContent = vacName;
    }

    const newPw = document.getElementById('settings-new-password').value;
    const confirmPw = document.getElementById('settings-confirm-password').value;
    if (newPw) {
      await changePassword(newPw, confirmPw);
      document.getElementById('settings-new-password').value = '';
      document.getElementById('settings-confirm-password').value = '';
    }

    msg.textContent = '✅ Paramètres sauvegardés !';
    msg.classList.add('text-green-600');
    setTimeout(() => { msg.classList.add('hidden'); closeAllModals(); }, 1500);
  } catch (e) {
    msg.textContent = '❌ ' + e.message;
    msg.classList.add('text-red-500');
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  if (confirm('Se déconnecter ?')) logout();
});
