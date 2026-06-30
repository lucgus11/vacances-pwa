// src/js/modules/ui.js

let toastTimer = null;

export function showToast(message, type = 'dark') {
  const toast = document.getElementById('toast');
  const inner = document.getElementById('toast-inner');
  const colors = {
    dark:  'bg-gray-800 text-white',
    red:   'bg-red-500 text-white',
    amber: 'bg-amber-500 text-white',
    green: 'bg-green-500 text-white',
  };
  inner.className = `${colors[type] || colors.dark} text-sm px-4 py-2.5 rounded-full shadow-xl font-medium`;
  inner.textContent = message;
  toast.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

export function showUploadProgress(percent) {
  let overlay = document.getElementById('upload-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'upload-overlay';
    overlay.className = 'upload-overlay';
    overlay.innerHTML = `
      <div class="text-4xl">⬆️</div>
      <p class="font-semibold">Envoi en cours...</p>
      <div class="upload-bar-track"><div class="upload-bar-fill" id="upload-bar-fill" style="width:0%"></div></div>
      <p id="upload-percent" class="text-sm opacity-70">0%</p>
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  const fill = document.getElementById('upload-bar-fill');
  const pct = document.getElementById('upload-percent');
  if (fill) fill.style.width = percent + '%';
  if (pct) pct.textContent = percent + '%';
}

export function hideUploadProgress() {
  const overlay = document.getElementById('upload-overlay');
  if (overlay) overlay.style.display = 'none';
}

export function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

export function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
}

// Close modals on overlay click or .modal-close buttons
export function initModalHandlers() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeAllModals();
    });
  });
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });
}
