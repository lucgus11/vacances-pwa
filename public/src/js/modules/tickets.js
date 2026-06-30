// src/js/modules/tickets.js
import db from './supabase.js';
import { showToast, showUploadProgress, hideUploadProgress } from './ui.js';

let username = '';

export async function loadTickets(user = username) {
  if (user) username = user;
  const grid = document.getElementById('tickets-grid');
  grid.innerHTML = '';

  let tickets = [];
  try {
    tickets = await db.query('tickets', 'order=created_at.desc');
    localStorage.setItem('tickets_cache', JSON.stringify(tickets));
  } catch {
    const cached = localStorage.getItem('tickets_cache');
    tickets = cached ? JSON.parse(cached) : [];
    showToast('📴 Affichage hors ligne', 'amber');
  }

  if (tickets.length === 0) {
    grid.innerHTML = `<div class="col-span-2 empty-state"><div class="emoji">🎫</div><p class="font-medium">Aucun billet</p><p class="text-sm mt-1">Uploadez vos tickets et QR codes !</p></div>`;
    return;
  }

  tickets.forEach(ticket => {
    const card = document.createElement('div');
    card.className = 'ticket-card';
    const isImage = ticket.file_type === 'image';
    card.innerHTML = `
      <div class="relative">
        ${isImage
          ? `<img src="${ticket.file_url}" alt="${escHtml(ticket.title)}" loading="lazy" />`
          : `<div class="bg-gray-100 h-28 flex items-center justify-center text-4xl">📄</div>`
        }
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <div class="absolute bottom-0 left-0 right-0 p-2">
          <p class="text-white text-xs font-semibold truncate">${escHtml(ticket.title)}</p>
          ${ticket.event_date ? `<p class="text-white/70 text-[10px]">${formatDate(ticket.event_date)}</p>` : ''}
        </div>
        <button class="btn-delete-ticket absolute top-1.5 right-1.5 bg-black/40 hover:bg-red-500 text-white text-[10px] rounded-full w-6 h-6 flex items-center justify-center transition-colors" data-id="${ticket.id}">✕</button>
      </div>
    `;
    card.addEventListener('click', e => {
      if (e.target.classList.contains('btn-delete-ticket')) return;
      viewTicket(ticket);
    });
    grid.appendChild(card);
  });

  grid.querySelectorAll('.btn-delete-ticket').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteTicket(btn.dataset.id);
    });
  });
}

export async function uploadTicket(file, title, eventDate) {
  showUploadProgress(0);
  try {
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    showUploadProgress(30);

    const url = await db.uploadFile('tickets', path, file);
    showUploadProgress(70);

    const fileType = file.type.startsWith('image') ? 'image' : 'pdf';
    await db.insert('tickets', {
      title: title || file.name,
      file_url: url,
      file_type: fileType,
      event_date: eventDate || null,
      uploaded_by: username,
    });
    showUploadProgress(100);

    // Cache the file URL in SW for offline use
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CACHE_TICKET', url });
    }

    showToast('✅ Billet uploadé et mis en cache hors ligne !');
    setTimeout(hideUploadProgress, 400);
    loadTickets();
  } catch (e) {
    hideUploadProgress();
    showToast('❌ Erreur upload : ' + e.message, 'red');
  }
}

async function deleteTicket(id) {
  if (!confirm('Supprimer ce billet ?')) return;
  try {
    await db.remove('tickets', id);
    showToast('✅ Billet supprimé');
    loadTickets();
  } catch (e) { showToast('❌ ' + e.message, 'red'); }
}

function viewTicket(ticket) {
  const viewer = document.getElementById('ticket-viewer');
  const isImage = ticket.file_type === 'image';
  viewer.innerHTML = isImage
    ? `<img src="${ticket.file_url}" alt="${escHtml(ticket.title)}" class="w-full" />`
    : `<div class="p-6 text-center"><p class="text-4xl mb-3">📄</p><p class="font-bold mb-4">${escHtml(ticket.title)}</p>
       <a href="${ticket.file_url}" target="_blank" class="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold inline-block">Ouvrir le PDF</a></div>`;
  document.getElementById('modal-ticket').classList.remove('hidden');
}

export async function handleTicketFileInput(file) {
  const title = prompt('Nom du billet (ex: Musée du Louvre) :', file.name.replace(/\.[^.]+$/, ''));
  if (title === null) return; // cancelled
  const dateStr = prompt('Date de l\'événement (JJ/MM/AAAA, optionnel) :');
  let eventDate = null;
  if (dateStr) {
    const [d, m, y] = dateStr.split('/');
    if (d && m && y) eventDate = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  await uploadTicket(file, title, eventDate);
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
