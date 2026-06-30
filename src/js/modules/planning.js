// src/js/modules/planning.js
import db from './supabase.js';
import { showToast } from './ui.js';

const MOMENTS = [
  { key: 'matin',       label: '🌅 Matin',      cls: 'moment-matin'      },
  { key: 'apres-midi',  label: '☀️ Après-midi', cls: 'moment-apres-midi' },
  { key: 'soiree',      label: '🌙 Soirée',      cls: 'moment-soiree'    },
];

let currentDate = todayISO();
let username = '';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function buildDateStrip() {
  const strip = document.getElementById('date-strip');
  strip.innerHTML = '';
  const today = new Date();
  for (let i = -1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const pill = document.createElement('button');
    pill.className = `date-pill${iso === currentDate ? ' active' : ''}`;
    pill.dataset.date = iso;
    pill.innerHTML = `<span class="text-xs font-semibold">${d.toLocaleDateString('fr', { weekday: 'short' })}</span>
                      <span class="text-lg font-bold">${d.getDate()}</span>`;
    pill.addEventListener('click', () => {
      currentDate = iso;
      document.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      loadPlanning();
    });
    strip.appendChild(pill);
  }
}

export async function loadPlanning(user = username) {
  if (user) username = user;
  buildDateStrip();
  const board = document.getElementById('planning-board');
  board.innerHTML = '';

  let items = [];
  try {
    items = await db.query('planning', `date=eq.${currentDate}&order=moment.asc,created_at.asc`);
  } catch {
    const cached = localStorage.getItem(`planning_${currentDate}`);
    if (cached) items = JSON.parse(cached);
    showToast('📴 Mode hors ligne – données en cache', 'amber');
  }
  // cache for offline
  localStorage.setItem(`planning_${currentDate}`, JSON.stringify(items));

  if (items.length === 0 && MOMENTS.every(m => !items.find(i => i.moment === m.key))) {
    // Still render empty moments
  }

  MOMENTS.forEach(({ key, label, cls }) => {
    const section = document.createElement('div');
    section.className = `moment-card border border-gray-100`;
    const momentItems = items.filter(i => i.moment === key);
    section.innerHTML = `
      <div class="moment-header ${cls}">
        <span>${label}</span>
        <span class="text-xs text-gray-500">${momentItems.length} activité${momentItems.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="divide-y divide-gray-50 bg-white" id="moment-${key}">
        ${momentItems.length === 0 ? `<div class="px-4 py-3 text-sm text-gray-400 italic">Rien de prévu — ajoutez quelque chose !</div>` : ''}
        ${momentItems.map(item => renderItem(item)).join('')}
      </div>
    `;
    board.appendChild(section);
  });

  // Bind actions
  board.querySelectorAll('.btn-delete-planning').forEach(btn => {
    btn.addEventListener('click', () => deletePlanningItem(btn.dataset.id));
  });
  board.querySelectorAll('.btn-edit-planning').forEach(btn => {
    btn.addEventListener('click', () => editPlanningItem(btn.dataset.id, items));
  });
}

function renderItem(item) {
  const mapsUrl = item.address
    ? `https://maps.google.com/?q=${encodeURIComponent(item.address)}`
    : null;

  return `
    <div class="px-4 py-3 flex gap-3 items-start">
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-sm text-gray-800 truncate">${escHtml(item.title)}</p>
        ${item.description ? `<p class="text-xs text-gray-500 mt-0.5">${escHtml(item.description)}</p>` : ''}
        ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener"
            class="inline-flex items-center gap-1 mt-1 text-xs text-blue-500 underline underline-offset-2">
            📍 ${escHtml(item.address)}
          </a>` : ''}
        <p class="text-[10px] text-gray-300 mt-1">Ajouté par ${escHtml(item.created_by || '?')}</p>
      </div>
      <div class="flex gap-1 shrink-0">
        <button class="btn-edit-planning p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 text-xs" data-id="${item.id}" title="Modifier">✏️</button>
        <button class="btn-delete-planning p-1.5 rounded-lg hover:bg-red-50 text-gray-400 text-xs" data-id="${item.id}" title="Supprimer">🗑️</button>
      </div>
    </div>
  `;
}

async function deletePlanningItem(id) {
  if (!confirm('Supprimer cette activité ?')) return;
  try {
    await db.remove('planning', id);
    showToast('✅ Activité supprimée');
    loadPlanning();
  } catch (e) { showToast('❌ Erreur : ' + e.message, 'red'); }
}

function editPlanningItem(id, items) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  openPlanningModal(item);
}

export function openPlanningModal(item = null) {
  const modal = document.getElementById('modal-planning');
  const form = document.getElementById('form-planning');
  form.reset();
  document.getElementById('planning-modal-title').textContent = item ? 'Modifier' : 'Ajouter au planning';
  if (item) {
    form.querySelector('[name=id]').value = item.id;
    form.querySelector('[name=title]').value = item.title;
    form.querySelector('[name=date]').value = item.date;
    form.querySelector('[name=moment]').value = item.moment;
    form.querySelector('[name=description]').value = item.description || '';
    form.querySelector('[name=address]').value = item.address || '';
  } else {
    form.querySelector('[name=date]').value = currentDate;
  }
  modal.classList.remove('hidden');
}

export async function savePlanningItem(formData) {
  const id = formData.get('id');
  const payload = {
    title: formData.get('title'),
    date: formData.get('date'),
    moment: formData.get('moment'),
    description: formData.get('description') || null,
    address: formData.get('address') || null,
    created_by: username,
  };
  if (id) {
    await db.update('planning', id, payload);
  } else {
    await db.insert('planning', payload);
  }
  currentDate = payload.date;
  loadPlanning();
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
