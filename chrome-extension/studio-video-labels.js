// Tube Solutions — Video Labels for YouTube Studio
// Free-form label badge per video (e.g. VidRush, Manual, AI, etc.)
(() => {
const LABEL_STORAGE_KEY = 'tsVideoLabels'; // { videoId: labelText }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getLabels() {
  const data = await chrome.storage.sync.get(LABEL_STORAGE_KEY);
  return data[LABEL_STORAGE_KEY] || {};
}

async function saveLabel(videoId, value) {
  const labels = await getLabels();
  if (value) labels[videoId] = value;
  else delete labels[videoId];
  await chrome.storage.sync.set({ [LABEL_STORAGE_KEY]: labels });
}

async function getPresets() {
  const labels = await getLabels();
  // Unique values sorted alphabetically
  return [...new Set(Object.values(labels).filter(Boolean))].sort();
}

function stopEvent(e) { e.preventDefault(); e.stopPropagation(); }

function getRows() {
  return document.querySelectorAll('[id="row-container"]');
}

function getVideoId(row) {
  for (const link of row.querySelectorAll('a[href]')) {
    const m = (link.getAttribute('href') || '').match(/\/video\/([^/?:]+)/);
    if (m) return m[1];
  }
  return null;
}

function closeAllDropdowns() {
  document.querySelectorAll('.ts-label-dropdown').forEach(d => d.remove());
}

function positionDropdown(dropdown, badge) {
  const rect = badge.getBoundingClientRect();
  Object.assign(dropdown.style, {
    position: 'fixed',
    top: (rect.bottom + 4) + 'px',
    left: rect.left + 'px',
  });
}

function createLabelBadge(initialValue, videoId) {
  const wrapper = document.createElement('span');
  wrapper.className = 'ts-label-wrapper';
  wrapper.dataset.videoId = videoId;
  Object.assign(wrapper.style, {
    display: 'inline-flex', alignItems: 'center', marginRight: '6px',
    position: 'relative', zIndex: '20', flexShrink: '0',
  });

  const badge = document.createElement('button');
  badge.type = 'button';
  badge.className = 'ts-label-badge';
  badge.textContent = initialValue || 'Label';
  setBadgeStyle(badge, initialValue);

  function setBadgeStyle(el, value) {
    Object.assign(el.style, {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      height: '20px', padding: '0 8px', fontSize: '11px', fontWeight: '700',
      borderRadius: '999px', cursor: 'pointer', whiteSpace: 'nowrap',
      color: value ? '#e0d0ff' : '#888',
      background: value ? '#2d1f4a' : '#1e1e1e',
      border: value ? '1px solid #6d4faa' : '1px solid #3a3a3a',
      fontFamily: 'Roboto, sans-serif',
    });
  }

  function updateBadge(value) {
    badge.textContent = value || 'Label';
    setBadgeStyle(badge, value);
  }

  async function applyLabel(value) {
    await saveLabel(videoId, value);
    updateBadge(value);
    closeAllDropdowns();
    wrapper.dataset.editing = 'false';
  }

  async function showDropdown() {
    closeAllDropdowns();
    wrapper.dataset.editing = 'true';

    const presets = await getPresets();

    const dropdown = document.createElement('div');
    dropdown.className = 'ts-label-dropdown';
    Object.assign(dropdown.style, {
      zIndex: '99999', background: '#1a1a2e',
      border: '1px solid #6d4faa', borderRadius: '8px',
      boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
      minWidth: '130px', overflow: 'hidden',
      fontFamily: 'Roboto, sans-serif',
    });

    // Preset items
    if (presets.length) {
      presets.forEach(preset => {
        const item = document.createElement('div');
        item.textContent = preset;
        Object.assign(item.style, {
          padding: '7px 12px', cursor: 'pointer', fontSize: '12px',
          color: '#e0d0ff', borderBottom: '1px solid #2a1f4a',
          transition: 'background 0.1s',
        });
        item.addEventListener('mouseenter', () => item.style.background = '#2d1f4a');
        item.addEventListener('mouseleave', () => item.style.background = '');
        item.addEventListener('mousedown', (e) => {
          stopEvent(e);
          applyLabel(preset);
        });
        dropdown.appendChild(item);
      });
    }

    // Clear option (if currently has a label)
    const currentLabel = badge.textContent === 'Label' ? '' : badge.textContent;
    if (currentLabel) {
      const clearItem = document.createElement('div');
      clearItem.textContent = '✕ Clear';
      Object.assign(clearItem.style, {
        padding: '7px 12px', cursor: 'pointer', fontSize: '12px',
        color: '#f87171', borderBottom: '1px solid #2a1f4a',
        transition: 'background 0.1s',
      });
      clearItem.addEventListener('mouseenter', () => clearItem.style.background = '#3a1010');
      clearItem.addEventListener('mouseleave', () => clearItem.style.background = '');
      clearItem.addEventListener('mousedown', (e) => { stopEvent(e); applyLabel(''); });
      dropdown.appendChild(clearItem);
    }

    // Custom input row
    const inputRow = document.createElement('div');
    Object.assign(inputRow.style, { padding: '6px 8px', display: 'flex', gap: '4px' });

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'New label…';
    input.maxLength = 20;
    Object.assign(input.style, {
      flex: '1', background: '#111', border: '1px solid #4a3a7a',
      borderRadius: '4px', color: '#e0d0ff', fontSize: '11px',
      padding: '3px 6px', outline: 'none', fontFamily: 'Roboto, sans-serif',
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '✓';
    Object.assign(confirmBtn.style, {
      background: '#6d4faa', border: 'none', borderRadius: '4px',
      color: '#fff', fontSize: '12px', cursor: 'pointer', padding: '2px 7px',
    });

    async function confirmNew() {
      const val = input.value.trim();
      if (val) await applyLabel(val);
      else closeAllDropdowns();
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { stopEvent(e); confirmNew(); }
      if (e.key === 'Escape') { stopEvent(e); closeAllDropdowns(); }
    });
    confirmBtn.addEventListener('mousedown', (e) => { stopEvent(e); confirmNew(); });

    inputRow.appendChild(input);
    inputRow.appendChild(confirmBtn);
    dropdown.appendChild(inputRow);

    document.body.appendChild(dropdown);
    positionDropdown(dropdown, badge);
    input.focus();

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', () => {
        closeAllDropdowns();
        wrapper.dataset.editing = 'false';
      }, { once: true });
    }, 0);
  }

  ['click', 'mousedown', 'mouseup', 'pointerdown'].forEach(ev => {
    wrapper.addEventListener(ev, stopEvent);
    badge.addEventListener(ev, stopEvent);
  });

  badge.addEventListener('click', (e) => {
    stopEvent(e);
    if (wrapper.querySelector('.ts-label-dropdown')) {
      closeAllDropdowns();
      wrapper.dataset.editing = 'false';
    } else {
      showDropdown();
    }
  });

  wrapper.appendChild(badge);
  return wrapper;
}

function updateExistingBadge(wrapper, value) {
  if (wrapper.dataset.editing === 'true') return;
  const badge = wrapper.querySelector('.ts-label-badge');
  if (!badge) return;
  badge.textContent = value || 'Label';
  Object.assign(badge.style, {
    color: value ? '#e0d0ff' : '#888',
    background: value ? '#2d1f4a' : '#1e1e1e',
    border: value ? '1px solid #6d4faa' : '1px solid #3a3a3a',
  });
}

async function inject() {
  const labels = await getLabels();
  getRows().forEach(row => {
    const titleEl = row.querySelector('#video-title');
    if (!titleEl) return;
    const videoId = getVideoId(row);
    if (!videoId) return;

    Object.assign(titleEl.style, { display: 'flex', alignItems: 'center', gap: '4px' });

    const existing = row.querySelector('.ts-label-wrapper');
    if (existing) {
      if (existing.dataset.videoId === videoId) {
        updateExistingBadge(existing, labels[videoId] || '');
        return;
      }
      existing.remove();
    }

    const badge = createLabelBadge(labels[videoId] || '', videoId);
    const epBadge = titleEl.querySelector('.ep-inline-wrapper');
    if (epBadge) epBadge.after(badge);
    else titleEl.insertBefore(badge, titleEl.firstChild);
  });
}

async function boot() {
  for (let i = 0; i < 20; i++) {
    await inject();
    await sleep(500);
  }

  let debounceTimer;
  new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(inject, 300);
  }).observe(document.body, { childList: true, subtree: true });

  setInterval(inject, 3000);
}

chrome.storage.sync.get('tsFeatures', (data) => {
  if ((data['tsFeatures'] || {}).videoLabels !== false) boot();
});

chrome.storage.onChanged.addListener((changes) => {
  if (!changes['tsFeatures']) return;
  const feat = changes['tsFeatures'].newValue || {};
  if (feat.videoLabels === false) {
    document.querySelectorAll('.ts-label-wrapper').forEach(el => el.remove());
  } else {
    inject();
  }
});

})();
