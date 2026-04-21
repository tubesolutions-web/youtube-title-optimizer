// Tube Solutions — Video Labels for YouTube Studio
// Free-form label badge per video (e.g. VidRush, Manual, AI, etc.)
(() => {
const LABEL_STORAGE_KEY = 'tsVideoLabels'; // { videoId: labelText }
const COLOR_STORAGE_KEY = 'tsLabelColors'; // { labelText: colorKey }

const PALETTE = [
  { key: 'purple', bg: '#2d1f4a', border: '#7c3aed', text: '#e0d0ff' },
  { key: 'blue',   bg: '#1a2a4a', border: '#3b82f6', text: '#bfdbfe' },
  { key: 'green',  bg: '#1a3a2a', border: '#22c55e', text: '#bbf7d0' },
  { key: 'red',    bg: '#3a1a1a', border: '#ef4444', text: '#fecaca' },
  { key: 'orange', bg: '#3a2a1a', border: '#f97316', text: '#fed7aa' },
  { key: 'yellow', bg: '#3a361a', border: '#eab308', text: '#fef08a' },
  { key: 'pink',   bg: '#3a1a2d', border: '#ec4899', text: '#fbcfe8' },
  { key: 'teal',   bg: '#1a3333', border: '#06b6d4', text: '#a5f3fc' },
];

function getColor(key) {
  return PALETTE.find(c => c.key === key) || PALETTE[0];
}

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

async function getLabelColors() {
  const data = await chrome.storage.sync.get(COLOR_STORAGE_KEY);
  return data[COLOR_STORAGE_KEY] || {};
}

async function saveLabelColor(label, colorKey) {
  const colors = await getLabelColors();
  colors[label] = colorKey;
  await chrome.storage.sync.set({ [COLOR_STORAGE_KEY]: colors });
}

async function getPresets() {
  const [labels, colors] = await Promise.all([getLabels(), getLabelColors()]);
  const names = [...new Set(Object.values(labels).filter(Boolean))].sort();
  return names.map(name => ({ name, colorKey: colors[name] || 'purple' }));
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

function createLabelBadge(initialValue, videoId, initialColorKey) {
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
  applyBadgeStyle(badge, initialValue, initialColorKey);

  function applyBadgeStyle(el, value, colorKey) {
    if (value) {
      const c = getColor(colorKey || 'purple');
      Object.assign(el.style, {
        color: c.text, background: c.bg, border: `1px solid ${c.border}`,
      });
    } else {
      Object.assign(el.style, {
        color: '#888', background: '#1e1e1e', border: '1px solid #3a3a3a',
      });
    }
    Object.assign(el.style, {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      height: '20px', padding: '0 8px', fontSize: '11px', fontWeight: '700',
      borderRadius: '999px', cursor: 'pointer', whiteSpace: 'nowrap',
      fontFamily: 'Roboto, sans-serif',
    });
  }

  function updateBadge(value, colorKey) {
    badge.textContent = value || 'Label';
    applyBadgeStyle(badge, value, colorKey);
  }

  async function applyLabel(value, colorKey) {
    await saveLabel(videoId, value);
    if (value && colorKey) await saveLabelColor(value, colorKey);
    updateBadge(value, colorKey);
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
      minWidth: '150px', overflow: 'hidden',
      fontFamily: 'Roboto, sans-serif',
    });

    // Preset items (colored)
    presets.forEach(({ name, colorKey }) => {
      const c = getColor(colorKey);
      const item = document.createElement('div');
      Object.assign(item.style, {
        padding: '7px 12px', cursor: 'pointer', fontSize: '12px',
        display: 'flex', alignItems: 'center', gap: '8px',
        borderBottom: '1px solid #2a1f4a', transition: 'background 0.1s',
      });
      const dot = document.createElement('span');
      Object.assign(dot.style, {
        width: '8px', height: '8px', borderRadius: '50%',
        background: c.border, flexShrink: '0',
      });
      const label = document.createElement('span');
      label.textContent = name;
      label.style.color = c.text;
      item.appendChild(dot);
      item.appendChild(label);
      item.addEventListener('mouseenter', () => item.style.background = '#2d1f4a');
      item.addEventListener('mouseleave', () => item.style.background = '');
      item.addEventListener('mousedown', (e) => { stopEvent(e); applyLabel(name, colorKey); });
      dropdown.appendChild(item);
    });

    // Clear option
    const currentLabel = badge.textContent === 'Label' ? '' : badge.textContent;
    if (currentLabel) {
      const clearItem = document.createElement('div');
      clearItem.textContent = '✕ Clear';
      Object.assign(clearItem.style, {
        padding: '7px 12px', cursor: 'pointer', fontSize: '12px',
        color: '#f87171', borderBottom: '1px solid #2a1f4a', transition: 'background 0.1s',
      });
      clearItem.addEventListener('mouseenter', () => clearItem.style.background = '#3a1010');
      clearItem.addEventListener('mouseleave', () => clearItem.style.background = '');
      clearItem.addEventListener('mousedown', (e) => { stopEvent(e); applyLabel('', null); });
      dropdown.appendChild(clearItem);
    }

    // Color swatches
    let selectedColorKey = 'purple';
    const swatchRow = document.createElement('div');
    Object.assign(swatchRow.style, {
      padding: '6px 10px 2px', display: 'flex', gap: '5px', flexWrap: 'wrap',
    });
    PALETTE.forEach(c => {
      const swatch = document.createElement('span');
      swatch.dataset.colorKey = c.key;
      Object.assign(swatch.style, {
        width: '14px', height: '14px', borderRadius: '50%', background: c.border,
        cursor: 'pointer', border: '2px solid transparent', flexShrink: '0',
        transition: 'border-color 0.1s',
      });
      if (c.key === selectedColorKey) swatch.style.borderColor = '#fff';
      swatch.addEventListener('mousedown', (e) => {
        stopEvent(e);
        selectedColorKey = c.key;
        swatchRow.querySelectorAll('span').forEach(s => s.style.borderColor = 'transparent');
        swatch.style.borderColor = '#fff';
      });
      swatchRow.appendChild(swatch);
    });
    dropdown.appendChild(swatchRow);

    // New label input
    const inputRow = document.createElement('div');
    Object.assign(inputRow.style, { padding: '4px 8px 8px', display: 'flex', gap: '4px' });

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
      if (val) await applyLabel(val, selectedColorKey);
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

    dropdown.addEventListener('click', stopEvent);
    document.body.appendChild(dropdown);
    positionDropdown(dropdown, badge);
    input.focus();

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

function updateExistingBadge(wrapper, value, colorKey) {
  if (wrapper.dataset.editing === 'true') return;
  const badge = wrapper.querySelector('.ts-label-badge');
  if (!badge) return;
  badge.textContent = value || 'Label';
  if (value) {
    const c = getColor(colorKey || 'purple');
    Object.assign(badge.style, { color: c.text, background: c.bg, border: `1px solid ${c.border}` });
  } else {
    Object.assign(badge.style, { color: '#888', background: '#1e1e1e', border: '1px solid #3a3a3a' });
  }
}

async function inject() {
  const [labels, colors] = await Promise.all([getLabels(), getLabelColors()]);
  getRows().forEach(row => {
    const titleEl = row.querySelector('#video-title');
    if (!titleEl) return;
    const videoId = getVideoId(row);
    if (!videoId) return;

    Object.assign(titleEl.style, { display: 'flex', alignItems: 'center', gap: '4px' });

    const labelValue = labels[videoId] || '';
    const colorKey = labelValue ? (colors[labelValue] || 'purple') : '';

    const existing = row.querySelector('.ts-label-wrapper');
    if (existing) {
      if (existing.dataset.videoId === videoId) {
        updateExistingBadge(existing, labelValue, colorKey);
        return;
      }
      existing.remove();
    }

    const badge = createLabelBadge(labelValue, videoId, colorKey);
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
