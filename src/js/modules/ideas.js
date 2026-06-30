// src/js/modules/ideas.js
import db from './supabase.js';
import { showToast } from './ui.js';

let username = '';
let currentFilter = 'all';
let allIdeas = [];

const TYPE_LABELS = { restaurant: '🍴 Resto', activite: '🎯 Activité' };
const TYPE_COLORS = { restaurant: 'bg-rose-50 text-rose-600', activite: 'bg-sky-50 text-sky-600' };

export async function loadIdeas(user = username) {
  if (user) username = user;
  try {
    allIdeas = await db.query('ideas', 'order=votes.desc,created_at.desc');
    localStorage.setItem('ideas_cache', JSON.stringify(allIdeas));
  } catch {
    const cached = localStorage.getItem('ideas_cache');
    allIdeas = cached ? JSON.parse(cached) : [];
    showToast('📴 Mode hors ligne – données en cache', 'amber');
  }
  renderIdeas();
}

export function setFilter(filter) {
  currentFilter = filter;
  renderIdeas();
}

function renderIdeas() {
  const list = document.getElementById('ideas-list');
  const filtered = currentFilter === 'all' ? allIdeas : allIdeas.filter(i => i.type === currentFilter);

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="emoji">💡</div><p class="font-medium">Aucune idée pour l'instant</p><p class="text-sm mt-1">Soyez le premier à proposer quelque chose !</p></div>`;
    return;
  }

  list.innerHTML = filtered.map(renderIdea).join('');

  list.querySelectorAll('.btn-vote').forEach(btn => {
    btn.addEventListener('click', () => voteIdea(btn.dataset.id));
  });
  list.querySelectorAll('.btn-delete-idea').forEach(btn => {
    btn.addEventListener('click', () => deleteIdea(btn.dataset.id));
  });
  list.querySelectorAll('.btn-select-idea').forEach(btn => {
    btn.addEventListener('click', () => toggleSelect(btn.dataset.id));
  });
}

function renderIdea(idea) {
  const voters = idea.voters || [];
  const hasVoted = voters.includes(username);
  const mapsUrl = idea.address ? `https://maps.google.com/?q=${encodeURIComponent(idea.address)}` : null;

  return `
    <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 ${idea.selected ? 'ring-2 ring-orange-400' : ''}">
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[idea.type] || ''}">${TYPE_LABELS[idea.type] || idea.type}</span>
            ${idea.selected ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">✅ Sélectionné</span>' : ''}
          </div>
          <p class="font-semibold text-sm text-gray-800">${escHtml(idea.title)}</p>
          ${idea.description ? `<p class="text-xs text-gray-500 mt-0.5">${escHtml(idea.description)}</p>` : ''}
          ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener" class="text-xs text-blue-500 underline mt-1 inline-block">📍 ${escHtml(idea.address)}</a>` : ''}
          <p class="text-[10px] text-gray-300 mt-1">Proposé par ${escHtml(idea.proposed_by || '?')}</p>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0">
          <button class="btn-vote vote-btn ${hasVoted ? 'voted' : ''}" data-id="${idea.id}">
            👍 ${idea.votes}
          </button>
          <button class="btn-select-idea text-[10px] text-gray-400 hover:text-orange-500 transition-colors" data-id="${idea.id}">${idea.selected ? 'Désélectionner' : 'Choisir'}</button>
          <button class="btn-delete-idea text-[10px] text-gray-300 hover:text-red-400 transition-colors" data-id="${idea.id}">Supprimer</button>
        </div>
      </div>
    </div>
  `;
}

async function voteIdea(id) {
  const idea = allIdeas.find(i => i.id === id);
  if (!idea) return;
  const voters = idea.voters || [];
  let newVotes, newVoters;
  if (voters.includes(username)) {
    newVotes = idea.votes - 1;
    newVoters = voters.filter(v => v !== username);
  } else {
    newVotes = idea.votes + 1;
    newVoters = [...voters, username];
  }
  // Optimistic update
  idea.votes = newVotes;
  idea.voters = newVoters;
  renderIdeas();
  try {
    await db.update('ideas', id, { votes: newVotes, voters: newVoters });
  } catch (e) {
    showToast('❌ Erreur vote : ' + e.message, 'red');
    await loadIdeas();
  }
}

async function deleteIdea(id) {
  if (!confirm('Supprimer cette idée ?')) return;
  try {
    await db.remove('ideas', id);
    showToast('✅ Idée supprimée');
    loadIdeas();
  } catch (e) { showToast('❌ ' + e.message, 'red'); }
}

async function toggleSelect(id) {
  const idea = allIdeas.find(i => i.id === id);
  if (!idea) return;
  try {
    await db.update('ideas', id, { selected: !idea.selected });
    showToast(idea.selected ? '↩️ Désélectionné' : '✅ Sélectionné !');
    loadIdeas();
  } catch (e) { showToast('❌ ' + e.message, 'red'); }
}

export async function saveIdea(formData) {
  const payload = {
    type: formData.get('type') || 'activite',
    title: formData.get('title'),
    description: formData.get('description') || null,
    address: formData.get('address') || null,
    proposed_by: username,
    votes: 0,
    voters: [],
  };
  await db.insert('ideas', payload);
  loadIdeas();
}

// === ROULETTE ===
export function spinRoulette(filterType = 'all') {
  const pool = allIdeas.filter(i => !i.selected && (filterType === 'all' || i.type === filterType));
  if (pool.length === 0) {
    document.getElementById('roulette-result').textContent = 'Aucune idée disponible !';
    return;
  }

  const display = document.getElementById('roulette-display');
  const result = document.getElementById('roulette-result');
  result.textContent = '';

  let ticks = 0;
  const maxTicks = 20 + Math.floor(Math.random() * 15);
  let interval = 80;

  display.classList.add('spinning');

  const tick = () => {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    display.textContent = pick.type === 'restaurant' ? '🍴' : '🎯';
    ticks++;
    interval = Math.min(interval * 1.08, 500);

    if (ticks >= maxTicks) {
      clearTimeout(timer);
      display.classList.remove('spinning');
      const winner = pool[Math.floor(Math.random() * pool.length)];
      display.textContent = winner.type === 'restaurant' ? '🍴' : '🎯';
      result.textContent = winner.title;
      showToast(`🎉 La roulette a choisi : ${winner.title}`);
    } else {
      timer = setTimeout(tick, interval);
    }
  };
  let timer = setTimeout(tick, interval);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
