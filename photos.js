// src/js/modules/photos.js
import db from './supabase.js';
import { showToast, showUploadProgress, hideUploadProgress } from './ui.js';

let username = '';

export async function loadPhotos(user = username) {
  if (user) username = user;
  const grid = document.getElementById('photos-grid');
  grid.innerHTML = '';

  let photos = [];
  try {
    photos = await db.query('photos', 'order=created_at.desc');
    localStorage.setItem('photos_cache', JSON.stringify(photos));
  } catch {
    const cached = localStorage.getItem('photos_cache');
    photos = cached ? JSON.parse(cached) : [];
    showToast('📴 Affichage hors ligne', 'amber');
  }

  if (photos.length === 0) {
    grid.innerHTML = `<div class="col-span-2 empty-state"><div class="emoji">📸</div><p class="font-medium">Aucune photo partagée</p><p class="text-sm mt-1">Partagez vos meilleurs souvenirs !</p></div>`;
    return;
  }

  photos.forEach(photo => {
    const item = document.createElement('div');
    item.className = 'photo-item';
    item.innerHTML = `
      <div class="relative">
        <img src="${photo.file_url}" alt="${escHtml(photo.caption || 'Photo')}" loading="lazy" />
        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 hover:opacity-100 transition-opacity">
          ${photo.caption ? `<p class="text-white text-xs font-semibold">${escHtml(photo.caption)}</p>` : ''}
          <p class="text-white/70 text-[10px]">par ${escHtml(photo.uploaded_by || '?')}</p>
        </div>
        <button class="btn-delete-photo absolute top-1.5 right-1.5 bg-black/40 hover:bg-red-500 text-white text-[10px] rounded-full w-6 h-6 items-center justify-center hidden group-hover:flex transition-all" data-id="${photo.id}">✕</button>
      </div>
    `;
    item.addEventListener('click', () => viewPhoto(photo));
    grid.appendChild(item);
  });
}

export async function uploadPhoto(file) {
  showUploadProgress(0);
  try {
    // Compress image before upload
    const compressed = await compressImage(file, 1200, 0.82);
    showUploadProgress(20);

    const caption = prompt('Légende (optionnel) :', '');
    if (caption === null) { hideUploadProgress(); return; }

    const ext = 'jpg';
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    showUploadProgress(40);

    const url = await db.uploadFile('photos', path, compressed);
    showUploadProgress(80);

    await db.insert('photos', {
      file_url: url,
      caption: caption || null,
      uploaded_by: username,
      taken_at: new Date().toISOString().split('T')[0],
    });
    showUploadProgress(100);
    showToast('📸 Photo partagée avec la famille !');
    setTimeout(hideUploadProgress, 400);
    loadPhotos();
  } catch (e) {
    hideUploadProgress();
    showToast('❌ Erreur upload : ' + e.message, 'red');
  }
}

export async function handlePhotoFiles(files) {
  for (const file of files) {
    await uploadPhoto(file);
  }
}

function viewPhoto(photo) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4';
  overlay.innerHTML = `
    <div class="relative max-w-lg w-full">
      <button class="absolute -top-10 right-0 text-white text-2xl">✕</button>
      <img src="${photo.file_url}" alt="${escHtml(photo.caption || '')}" class="w-full rounded-2xl" />
      ${photo.caption ? `<p class="text-white text-center mt-3 font-semibold">${escHtml(photo.caption)}</p>` : ''}
      <p class="text-white/50 text-xs text-center mt-1">par ${escHtml(photo.uploaded_by || '?')}</p>
    </div>
  `;
  overlay.querySelector('button').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// Compress image using canvas
function compressImage(file, maxW, quality) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(maxW / img.width, maxW / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg' })), 'image/jpeg', quality);
    };
    img.src = url;
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
