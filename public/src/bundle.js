// ============================================================
// bundle.js — Tous les modules fusionnés en un seul fichier
// Pas de dépendance aux ES modules / import/export
// ============================================================

// ======== SUPABASE ========
const _SUPABASE_URL = () => window.ENV?.SUPABASE_URL || '';
const _SUPABASE_KEY = () => window.ENV?.SUPABASE_ANON_KEY || '';

function supabaseIsConfigured() {
  const url = _SUPABASE_URL(), key = _SUPABASE_KEY();
  return url.startsWith('https://') && !url.includes('VOTRE_PROJECT') &&
         key.length > 20 && !key.includes('VOTRE_ANON_KEY') &&
         !url.includes('REMPLACER') && !key.includes('REMPLACER');
}

function sbHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': _SUPABASE_KEY(),
    'Authorization': `Bearer ${_SUPABASE_KEY()}`,
    'Prefer': 'return=representation',
  };
}

async function sbQuery(table, params = '') {
  if (!supabaseIsConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const r = await fetch(`${_SUPABASE_URL()}/rest/v1/${table}?${params}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbInsert(table, body) {
  if (!supabaseIsConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const r = await fetch(`${_SUPABASE_URL()}/rest/v1/${table}`, {
    method: 'POST', headers: sbHeaders(), body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbUpdate(table, id, body) {
  if (!supabaseIsConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const r = await fetch(`${_SUPABASE_URL()}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbRemove(table, id) {
  if (!supabaseIsConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const r = await fetch(`${_SUPABASE_URL()}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE', headers: sbHeaders(),
  });
  if (!r.ok) throw new Error(await r.text());
}

async function sbUploadFile(bucket, path, file) {
  if (!supabaseIsConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const r = await fetch(`${_SUPABASE_URL()}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { 'apikey': _SUPABASE_KEY(), 'Authorization': `Bearer ${_SUPABASE_KEY()}`, 'Content-Type': file.type, 'x-upsert': 'true' },
    body: file,
  });
  if (!r.ok) throw new Error(await r.text());
  return `${_SUPABASE_URL()}/storage/v1/object/public/${bucket}/${path}`;
}

async function sbGetConfig(key) {
  const rows = await sbQuery('config', `key=eq.${key}&select=value`);
  return rows[0]?.value ?? null;
}

async function sbSetConfig(key, value) {
  const r = await fetch(`${_SUPABASE_URL()}/rest/v1/config?key=eq.${key}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ value }),
  });
  if (!r.ok) await sbInsert('config', { key, value });
}

// ======== UI ========
let _toastTimer = null;

function showToast(message, type = 'dark') {
  const toast = document.getElementById('toast');
  const inner = document.getElementById('toast-inner');
  const colors = { dark: 'bg-gray-800 text-white', red: 'bg-red-500 text-white', amber: 'bg-amber-500 text-white', green: 'bg-green-500 text-white' };
  inner.className = `${colors[type] || colors.dark} text-sm px-4 py-2.5 rounded-full shadow-xl font-medium`;
  inner.textContent = message;
  toast.classList.remove('hidden');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

function showUploadProgress(percent) {
  let overlay = document.getElementById('upload-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'upload-overlay';
    overlay.className = 'upload-overlay';
    overlay.innerHTML = `<div class="text-4xl">⬆️</div><p class="font-semibold">Envoi en cours...</p>
      <div class="upload-bar-track"><div class="upload-bar-fill" id="upload-bar-fill" style="width:0%"></div></div>
      <p id="upload-percent" class="text-sm opacity-70">0%</p>`;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  const fill = document.getElementById('upload-bar-fill');
  const pct  = document.getElementById('upload-percent');
  if (fill) fill.style.width = percent + '%';
  if (pct)  pct.textContent  = percent + '%';
}

function hideUploadProgress() {
  const o = document.getElementById('upload-overlay');
  if (o) o.style.display = 'none';
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
}

function initModalHandlers() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeAllModals(); });
  });
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ======== AUTH ========
const SESSION_KEY = 'ardoise_session';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function authLogin(name, password) {
  if (!name.trim()) throw new Error('Veuillez entrer votre prénom.');
  if (!supabaseIsConfigured()) {
    throw new Error('⚙️ Supabase non configuré — renseignez vos clés dans les variables d\'environnement Vercel (SUPABASE_URL et SUPABASE_ANON_KEY).');
  }
  const hash = await sha256(password);
  let storedHash = null;
  try {
    storedHash = await sbGetConfig('password_hash');
  } catch {
    storedHash = localStorage.getItem('ardoise_pw_hash');
    if (!storedHash) throw new Error('❌ Impossible de joindre Supabase. Vérifiez votre connexion et que le schéma SQL a bien été exécuté.');
  }
  if (!storedHash) throw new Error('❌ Aucun mot de passe trouvé en base. Avez-vous exécuté supabase/schema.sql ?');
  if (hash !== storedHash) throw new Error('Mot de passe incorrect. Réessayez.');
  localStorage.setItem('ardoise_pw_hash', storedHash);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ name: name.trim(), loggedAt: Date.now() }));
  return name.trim();
}

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}

function doLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
}

async function changePassword(newPw, confirmPw) {
  if (newPw !== confirmPw) throw new Error('Les mots de passe ne correspondent pas.');
  if (newPw.length < 6) throw new Error('6 caractères minimum.');
  const hash = await sha256(newPw);
  await sbSetConfig('password_hash', hash);
  localStorage.setItem('ardoise_pw_hash', hash);
}

// ======== PLANNING ========
const MOMENTS = [
  { key: 'matin',      label: '🌅 Matin',      cls: 'moment-matin'      },
  { key: 'apres-midi', label: '☀️ Après-midi', cls: 'moment-apres-midi' },
  { key: 'soiree',     label: '🌙 Soirée',      cls: 'moment-soiree'    },
];

let _planningDate = new Date().toISOString().split('T')[0];
let _planningUser = '';

function buildDateStrip() {
  const strip = document.getElementById('date-strip');
  strip.innerHTML = '';
  const today = new Date();
  for (let i = -1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const pill = document.createElement('button');
    pill.className = `date-pill${iso === _planningDate ? ' active' : ''}`;
    pill.dataset.date = iso;
    pill.innerHTML = `<span class="text-xs font-semibold">${d.toLocaleDateString('fr',{weekday:'short'})}</span><span class="text-lg font-bold">${d.getDate()}</span>`;
    pill.addEventListener('click', () => {
      _planningDate = iso;
      document.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      loadPlanning();
    });
    strip.appendChild(pill);
  }
}

async function loadPlanning(user) {
  if (user) _planningUser = user;
  buildDateStrip();
  const board = document.getElementById('planning-board');
  board.innerHTML = '';
  let items = [];
  try {
    items = await sbQuery('planning', `date=eq.${_planningDate}&order=moment.asc,created_at.asc`);
    localStorage.setItem(`planning_${_planningDate}`, JSON.stringify(items));
  } catch {
    const c = localStorage.getItem(`planning_${_planningDate}`);
    if (c) { items = JSON.parse(c); showToast('📴 Mode hors ligne – données en cache','amber'); }
  }
  MOMENTS.forEach(({ key, label, cls }) => {
    const momentItems = items.filter(i => i.moment === key);
    const section = document.createElement('div');
    section.className = 'moment-card border border-gray-100';
    section.innerHTML = `
      <div class="moment-header ${cls}">
        <span>${label}</span>
        <span class="text-xs text-gray-500">${momentItems.length} activité${momentItems.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="divide-y divide-gray-50 bg-white" id="moment-${key}">
        ${momentItems.length === 0 ? '<div class="px-4 py-3 text-sm text-gray-400 italic">Rien de prévu — ajoutez quelque chose !</div>' : ''}
        ${momentItems.map(renderPlanningItem).join('')}
      </div>`;
    board.appendChild(section);
  });
  board.querySelectorAll('.btn-delete-planning').forEach(btn =>
    btn.addEventListener('click', () => deletePlanningItem(btn.dataset.id)));
  board.querySelectorAll('.btn-edit-planning').forEach(btn =>
    btn.addEventListener('click', () => openPlanningModal(items.find(i => i.id === btn.dataset.id))));
}

function renderPlanningItem(item) {
  const mapsUrl = item.address ? `https://maps.google.com/?q=${encodeURIComponent(item.address)}` : null;
  return `<div class="px-4 py-3 flex gap-3 items-start">
    <div class="flex-1 min-w-0">
      <p class="font-semibold text-sm text-gray-800 truncate">${escHtml(item.title)}</p>
      ${item.description ? `<p class="text-xs text-gray-500 mt-0.5">${escHtml(item.description)}</p>` : ''}
      ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 mt-1 text-xs text-blue-500 underline">📍 ${escHtml(item.address)}</a>` : ''}
      <p class="text-[10px] text-gray-300 mt-1">Ajouté par ${escHtml(item.created_by || '?')}</p>
    </div>
    <div class="flex gap-1 shrink-0">
      <button class="btn-edit-planning p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 text-xs" data-id="${item.id}">✏️</button>
      <button class="btn-delete-planning p-1.5 rounded-lg hover:bg-red-50 text-gray-400 text-xs" data-id="${item.id}">🗑️</button>
    </div>
  </div>`;
}

async function deletePlanningItem(id) {
  if (!confirm('Supprimer cette activité ?')) return;
  try { await sbRemove('planning', id); showToast('✅ Supprimé'); loadPlanning(); }
  catch (e) { showToast('❌ ' + e.message, 'red'); }
}

function openPlanningModal(item = null) {
  const form = document.getElementById('form-planning');
  form.reset();
  document.getElementById('planning-modal-title').textContent = item ? 'Modifier' : 'Ajouter au planning';
  if (item) {
    form.querySelector('[name=id]').value          = item.id;
    form.querySelector('[name=title]').value       = item.title;
    form.querySelector('[name=date]').value        = item.date;
    form.querySelector('[name=moment]').value      = item.moment;
    form.querySelector('[name=description]').value = item.description || '';
    form.querySelector('[name=address]').value     = item.address || '';
  } else {
    form.querySelector('[name=date]').value = _planningDate;
  }
  document.getElementById('modal-planning').classList.remove('hidden');
}

async function savePlanningItem(formData) {
  const id = formData.get('id');
  const payload = {
    title: formData.get('title'), date: formData.get('date'),
    moment: formData.get('moment'), description: formData.get('description') || null,
    address: formData.get('address') || null, created_by: _planningUser,
  };
  if (id) await sbUpdate('planning', id, payload);
  else     await sbInsert('planning', payload);
  _planningDate = payload.date;
  loadPlanning();
}

// ======== IDEAS ========
let _allIdeas = [];
let _ideaFilter = 'all';
let _ideaUser = '';
const TYPE_LABELS  = { restaurant: '🍴 Resto', activite: '🎯 Activité' };
const TYPE_COLORS  = { restaurant: 'bg-rose-50 text-rose-600', activite: 'bg-sky-50 text-sky-600' };

async function loadIdeas(user) {
  if (user) _ideaUser = user;
  try {
    _allIdeas = await sbQuery('ideas', 'order=votes.desc,created_at.desc');
    localStorage.setItem('ideas_cache', JSON.stringify(_allIdeas));
  } catch {
    const c = localStorage.getItem('ideas_cache');
    _allIdeas = c ? JSON.parse(c) : [];
  }
  renderIdeas();
}

function renderIdeas() {
  const list = document.getElementById('ideas-list');
  const filtered = _ideaFilter === 'all' ? _allIdeas : _allIdeas.filter(i => i.type === _ideaFilter);
  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="emoji">💡</div><p class="font-medium">Aucune idée pour l'instant</p><p class="text-sm mt-1">Soyez le premier à proposer quelque chose !</p></div>`;
    return;
  }
  list.innerHTML = filtered.map(renderIdea).join('');
  list.querySelectorAll('.btn-vote').forEach(btn => btn.addEventListener('click', () => voteIdea(btn.dataset.id)));
  list.querySelectorAll('.btn-delete-idea').forEach(btn => btn.addEventListener('click', () => deleteIdea(btn.dataset.id)));
  list.querySelectorAll('.btn-select-idea').forEach(btn => btn.addEventListener('click', () => toggleSelect(btn.dataset.id)));
}

function renderIdea(idea) {
  const voters   = idea.voters || [];
  const hasVoted = voters.includes(_ideaUser);
  const mapsUrl  = idea.address ? `https://maps.google.com/?q=${encodeURIComponent(idea.address)}` : null;
  return `<div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 ${idea.selected ? 'ring-2 ring-orange-400' : ''}">
    <div class="flex items-start justify-between gap-2">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[idea.type]||''}">${TYPE_LABELS[idea.type]||idea.type}</span>
          ${idea.selected ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">✅ Sélectionné</span>' : ''}
        </div>
        <p class="font-semibold text-sm text-gray-800">${escHtml(idea.title)}</p>
        ${idea.description ? `<p class="text-xs text-gray-500 mt-0.5">${escHtml(idea.description)}</p>` : ''}
        ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener" class="text-xs text-blue-500 underline mt-1 inline-block">📍 ${escHtml(idea.address)}</a>` : ''}
        <p class="text-[10px] text-gray-300 mt-1">Proposé par ${escHtml(idea.proposed_by||'?')}</p>
      </div>
      <div class="flex flex-col items-end gap-1 shrink-0">
        <button class="btn-vote vote-btn ${hasVoted?'voted':''}" data-id="${idea.id}">👍 ${idea.votes}</button>
        <button class="btn-select-idea text-[10px] text-gray-400 hover:text-orange-500" data-id="${idea.id}">${idea.selected?'Désélectionner':'Choisir'}</button>
        <button class="btn-delete-idea text-[10px] text-gray-300 hover:text-red-400" data-id="${idea.id}">Supprimer</button>
      </div>
    </div>
  </div>`;
}

async function voteIdea(id) {
  const idea = _allIdeas.find(i => i.id === id);
  if (!idea) return;
  const voters = idea.voters || [];
  const hasVoted = voters.includes(_ideaUser);
  idea.votes  = hasVoted ? idea.votes - 1 : idea.votes + 1;
  idea.voters = hasVoted ? voters.filter(v => v !== _ideaUser) : [...voters, _ideaUser];
  renderIdeas();
  try { await sbUpdate('ideas', id, { votes: idea.votes, voters: idea.voters }); }
  catch (e) { showToast('❌ ' + e.message, 'red'); loadIdeas(); }
}

async function deleteIdea(id) {
  if (!confirm('Supprimer cette idée ?')) return;
  try { await sbRemove('ideas', id); showToast('✅ Supprimé'); loadIdeas(); }
  catch (e) { showToast('❌ ' + e.message, 'red'); }
}

async function toggleSelect(id) {
  const idea = _allIdeas.find(i => i.id === id);
  if (!idea) return;
  try { await sbUpdate('ideas', id, { selected: !idea.selected }); showToast(idea.selected ? '↩️ Désélectionné' : '✅ Sélectionné !'); loadIdeas(); }
  catch (e) { showToast('❌ ' + e.message, 'red'); }
}

async function saveIdea(formData) {
  await sbInsert('ideas', {
    type: formData.get('type') || 'activite',
    title: formData.get('title'),
    description: formData.get('description') || null,
    address: formData.get('address') || null,
    proposed_by: _ideaUser,
    votes: 0, voters: [],
  });
  loadIdeas();
}

function setIdeaFilter(f) {
  _ideaFilter = f;
  renderIdeas();
}

function spinRoulette() {
  const pool = _allIdeas.filter(i => !i.selected);
  const display = document.getElementById('roulette-display');
  const result  = document.getElementById('roulette-result');
  result.textContent = '';
  if (pool.length === 0) { result.textContent = 'Aucune idée disponible !'; return; }
  let ticks = 0, maxTicks = 20 + Math.floor(Math.random() * 15), interval = 80, timer;
  display.classList.add('spinning');
  const tick = () => {
    display.textContent = pool[Math.floor(Math.random()*pool.length)].type === 'restaurant' ? '🍴' : '🎯';
    ticks++;
    interval = Math.min(interval * 1.08, 500);
    if (ticks >= maxTicks) {
      clearTimeout(timer);
      display.classList.remove('spinning');
      const winner = pool[Math.floor(Math.random()*pool.length)];
      display.textContent = winner.type === 'restaurant' ? '🍴' : '🎯';
      result.textContent  = winner.title;
      showToast(`🎉 La roulette a choisi : ${winner.title}`);
    } else { timer = setTimeout(tick, interval); }
  };
  timer = setTimeout(tick, interval);
}

// ======== TICKETS ========
let _ticketUser = '';

async function loadTickets(user) {
  if (user) _ticketUser = user;
  const grid = document.getElementById('tickets-grid');
  grid.innerHTML = '';
  let tickets = [];
  try {
    tickets = await sbQuery('tickets', 'order=created_at.desc');
    localStorage.setItem('tickets_cache', JSON.stringify(tickets));
  } catch {
    const c = localStorage.getItem('tickets_cache');
    tickets = c ? JSON.parse(c) : [];
  }
  if (tickets.length === 0) {
    grid.innerHTML = `<div class="col-span-2 empty-state"><div class="emoji">🎫</div><p class="font-medium">Aucun billet</p><p class="text-sm mt-1">Uploadez vos tickets et QR codes !</p></div>`;
    return;
  }
  tickets.forEach(ticket => {
    const card = document.createElement('div');
    card.className = 'ticket-card';
    const isImage = ticket.file_type === 'image';
    card.innerHTML = `<div class="relative">
      ${isImage ? `<img src="${ticket.file_url}" alt="${escHtml(ticket.title)}" loading="lazy" />` : `<div class="bg-gray-100 h-28 flex items-center justify-center text-4xl">📄</div>`}
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
      <div class="absolute bottom-0 left-0 right-0 p-2">
        <p class="text-white text-xs font-semibold truncate">${escHtml(ticket.title)}</p>
        ${ticket.event_date ? `<p class="text-white/70 text-[10px]">${ticket.event_date.split('-').reverse().join('/')}</p>` : ''}
      </div>
      <button class="btn-delete-ticket absolute top-1.5 right-1.5 bg-black/40 hover:bg-red-500 text-white text-[10px] rounded-full w-6 h-6 flex items-center justify-center" data-id="${ticket.id}">✕</button>
    </div>`;
    card.addEventListener('click', e => { if (!e.target.classList.contains('btn-delete-ticket')) viewTicket(ticket); });
    grid.appendChild(card);
  });
  grid.querySelectorAll('.btn-delete-ticket').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); deleteTicket(btn.dataset.id); }));
}

async function handleTicketFile(file) {
  const title    = prompt('Nom du billet :', file.name.replace(/\.[^.]+$/,''));
  if (title === null) return;
  const dateStr  = prompt('Date (JJ/MM/AAAA, optionnel) :');
  let eventDate  = null;
  if (dateStr) { const [d,m,y] = dateStr.split('/'); if (d&&m&&y) eventDate=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`; }
  showUploadProgress(0);
  try {
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${file.name.split('.').pop()}`;
    showUploadProgress(30);
    const url = await sbUploadFile('tickets', path, file);
    showUploadProgress(70);
    await sbInsert('tickets', { title, file_url: url, file_type: file.type.startsWith('image')?'image':'pdf', event_date: eventDate, uploaded_by: _ticketUser });
    showUploadProgress(100);
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller)
      navigator.serviceWorker.controller.postMessage({ type: 'CACHE_TICKET', url });
    showToast('✅ Billet uploadé et mis en cache !');
    setTimeout(hideUploadProgress, 400);
    loadTickets();
  } catch(e) { hideUploadProgress(); showToast('❌ ' + e.message, 'red'); }
}

async function deleteTicket(id) {
  if (!confirm('Supprimer ce billet ?')) return;
  try { await sbRemove('tickets', id); showToast('✅ Supprimé'); loadTickets(); }
  catch(e) { showToast('❌ ' + e.message, 'red'); }
}

function viewTicket(ticket) {
  const viewer = document.getElementById('ticket-viewer');
  viewer.innerHTML = ticket.file_type === 'image'
    ? `<img src="${ticket.file_url}" alt="${escHtml(ticket.title)}" class="w-full" />`
    : `<div class="p-6 text-center"><p class="text-4xl mb-3">📄</p><p class="font-bold mb-4">${escHtml(ticket.title)}</p><a href="${ticket.file_url}" target="_blank" class="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold inline-block">Ouvrir le PDF</a></div>`;
  document.getElementById('modal-ticket').classList.remove('hidden');
}

// ======== PHOTOS ========
let _photoUser = '';

async function loadPhotos(user) {
  if (user) _photoUser = user;
  const grid = document.getElementById('photos-grid');
  grid.innerHTML = '';
  let photos = [];
  try {
    photos = await sbQuery('photos', 'order=created_at.desc');
    localStorage.setItem('photos_cache', JSON.stringify(photos));
  } catch {
    const c = localStorage.getItem('photos_cache');
    photos = c ? JSON.parse(c) : [];
  }
  if (photos.length === 0) {
    grid.innerHTML = `<div class="col-span-2 empty-state"><div class="emoji">📸</div><p class="font-medium">Aucune photo partagée</p></div>`;
    return;
  }
  photos.forEach(photo => {
    const item = document.createElement('div');
    item.className = 'photo-item';
    item.innerHTML = `<img src="${photo.file_url}" alt="${escHtml(photo.caption||'')}" loading="lazy" />`;
    item.addEventListener('click', () => viewPhoto(photo));
    grid.appendChild(item);
  });
}

async function compressImage(file, maxW, quality) {
  return new Promise(resolve => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(maxW/img.width, maxW/img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = img.width*ratio; canvas.height = img.height*ratio;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(new File([blob],'photo.jpg',{type:'image/jpeg'})), 'image/jpeg', quality);
    };
    img.src = url;
  });
}

async function handlePhotoFiles(files) {
  for (const file of files) {
    const caption = prompt('Légende (optionnel) :', '') ;
    if (caption === null) continue;
    showUploadProgress(0);
    try {
      const compressed = await compressImage(file, 1200, 0.82);
      showUploadProgress(40);
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const url  = await sbUploadFile('photos', path, compressed);
      showUploadProgress(80);
      await sbInsert('photos', { file_url: url, caption: caption||null, uploaded_by: _photoUser, taken_at: new Date().toISOString().split('T')[0] });
      showUploadProgress(100);
      showToast('📸 Photo partagée !');
      setTimeout(hideUploadProgress, 400);
    } catch(e) { hideUploadProgress(); showToast('❌ ' + e.message, 'red'); }
  }
  loadPhotos();
}

function viewPhoto(photo) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4';
  overlay.innerHTML = `<div class="relative max-w-lg w-full">
    <button class="absolute -top-10 right-0 text-white text-2xl">✕</button>
    <img src="${photo.file_url}" class="w-full rounded-2xl" />
    ${photo.caption ? `<p class="text-white text-center mt-3 font-semibold">${escHtml(photo.caption)}</p>` : ''}
    <p class="text-white/50 text-xs text-center mt-1">par ${escHtml(photo.uploaded_by||'?')}</p>
  </div>`;
  overlay.querySelector('button').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ======== SERVICE WORKER ========
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(r => console.log('[SW] OK', r.scope))
    .catch(e => console.warn('[SW] Erreur', e));
}

// ======== ONLINE/OFFLINE ========
function updateOnlineStatus() {
  document.getElementById('offline-badge').classList.toggle('hidden', navigator.onLine);
}
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ======== TABS ========
let _activeTab = 'planning';
const tabLoaders = { planning: () => loadPlanning(), ideas: () => loadIdeas(), tickets: () => loadTickets(), photos: () => loadPhotos() };

function switchTab(tab) {
  _activeTab = tab;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(`tab-${tab}`)?.classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  tabLoaders[tab]?.();
}

document.querySelectorAll('.nav-btn').forEach(btn =>
  btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

// ======== APP START ========
function startApp(user) {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('header-username').textContent = user;
  _planningUser = user; _ideaUser = user; _ticketUser = user; _photoUser = user;
  sbGetConfig('vacation_name').then(n => { if (n) document.getElementById('vacation-name').textContent = n; }).catch(()=>{});
  switchTab('planning');
  setInterval(() => { if (navigator.onLine) tabLoaders[_activeTab]?.(); }, 10000);
}

// Check session
const _session = getSession();
if (_session) {
  startApp(_session.name);
} else {
  document.getElementById('screen-login').classList.remove('hidden');
}

// ======== LOGIN ========
document.getElementById('btn-login').addEventListener('click', async () => {
  const name = document.getElementById('login-name').value.trim();
  const pw   = document.getElementById('login-password').value;
  const err  = document.getElementById('login-error');
  err.classList.add('hidden');
  try {
    const user = await authLogin(name, pw);
    startApp(user);
  } catch(e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  }
});

['login-name','login-password'].forEach(id =>
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
  }));

// ======== MODALS ========
initModalHandlers();

// ======== PLANNING MODAL ========
document.getElementById('btn-add-planning').addEventListener('click', () => openPlanningModal());
document.getElementById('form-planning').addEventListener('submit', async e => {
  e.preventDefault();
  try { await savePlanningItem(new FormData(e.target)); closeAllModals(); showToast('✅ Planning mis à jour !'); }
  catch(err) { showToast('❌ ' + err.message, 'red'); }
});

// ======== IDEAS ========
document.getElementById('btn-add-idea').addEventListener('click', () =>
  document.getElementById('modal-idea').classList.remove('hidden'));
document.getElementById('form-idea').addEventListener('submit', async e => {
  e.preventDefault();
  try { await saveIdea(new FormData(e.target)); closeAllModals(); showToast('💡 Idée ajoutée !'); }
  catch(err) { showToast('❌ ' + err.message, 'red'); }
});
document.querySelectorAll('.idea-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.idea-filter').forEach(b => { b.classList.remove('bg-white','shadow','text-gray-800'); b.classList.add('text-gray-500'); });
    btn.classList.add('bg-white','shadow','text-gray-800'); btn.classList.remove('text-gray-500');
    setIdeaFilter(btn.dataset.filter);
  });
});
document.getElementById('btn-roulette').addEventListener('click', () => {
  document.getElementById('modal-roulette').classList.remove('hidden');
  document.getElementById('roulette-result').textContent = '';
  document.getElementById('roulette-display').textContent = '🎯';
});
document.getElementById('btn-spin').addEventListener('click', spinRoulette);

// ======== TICKETS ========
document.getElementById('ticket-file-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  await handleTicketFile(file);
  e.target.value = '';
});

// ======== PHOTOS ========
document.getElementById('photo-file-input').addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  await handlePhotoFiles(files);
  e.target.value = '';
});

// ======== SETTINGS ========
document.getElementById('btn-settings').addEventListener('click', async () => {
  document.getElementById('modal-settings').classList.remove('hidden');
  try { const n = await sbGetConfig('vacation_name'); if (n) document.getElementById('settings-vacation-name').value = n; } catch {}
});
document.getElementById('btn-save-settings').addEventListener('click', async () => {
  const msg = document.getElementById('settings-msg');
  msg.className = 'text-sm text-center font-medium';
  msg.classList.remove('hidden');
  try {
    const vacName = document.getElementById('settings-vacation-name').value.trim();
    if (vacName) { await sbSetConfig('vacation_name', vacName); document.getElementById('vacation-name').textContent = vacName; }
    const newPw = document.getElementById('settings-new-password').value;
    const confPw = document.getElementById('settings-confirm-password').value;
    if (newPw) { await changePassword(newPw, confPw); document.getElementById('settings-new-password').value = ''; document.getElementById('settings-confirm-password').value = ''; }
    msg.textContent = '✅ Sauvegardé !'; msg.classList.add('text-green-600');
    setTimeout(() => { msg.classList.add('hidden'); closeAllModals(); }, 1500);
  } catch(e) { msg.textContent = '❌ ' + e.message; msg.classList.add('text-red-500'); }
});
document.getElementById('btn-logout').addEventListener('click', () => { if (confirm('Se déconnecter ?')) doLogout(); });
