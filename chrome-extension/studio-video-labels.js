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
  Object.assign(badge.style, {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    height: '20px', padding: '0 8px', fontSize: '11px', fontWeight: '700',
    borderRadius: '999px', cursor: 'pointer', whiteSpace: 'nowrap',
    color: initialValue ? '#e0d0ff' : '#888',
    background: initialValue ? '#2d1f4a' : '#1e1e1e',
    border: initialValue ? '1px solid #6d4faa' : '1px solid #3a3a3a',
    fontFamily: 'Roboto, sans-serif',
  });

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'ts-label-input';
  input.value = initialValue || '';
  input.placeholder = 'Label…';
  input.maxLength = 20;
  Object.assign(input.style, {
    display: 'none', width: '80px', height: '20px', fontSize: '11px',
    textAlign: 'center', borderRadius: '999px', border: '1px solid #6d4faa',
    background: '#1a1a2e', color: '#e0d0ff', outline: 'none',
    fontFamily: 'Roboto, sans-serif',
  });

  ['click', 'mousedown', 'mouseup', 'pointerdown'].forEach(ev => {
    wrapper.addEventListener(ev, stopEvent);
    badge.addEventListener(ev, stopEvent);
    input.addEventListener(ev, stopEvent);
  });

  function setBadgeValue(value) {
    badge.textContent = value || 'Label';
    badge.style.color = value ? '#e0d0ff' : '#888';
    badge.style.background = value ? '#2d1f4a' : '#1e1e1e';
    badge.style.border = value ? '1px solid #6d4faa' : '1px solid #3a3a3a';
  }

  badge.addEventListener('click', (e) => {
    stopEvent(e);
    wrapper.dataset.editing = 'true';
    badge.style.display = 'none';
    input.style.display = 'inline-block';
    input.focus();
    input.select();
  });

  async function saveAndClose() {
    const value = input.value.trim();
    input.value = value;
    await saveLabel(videoId, value);
    setBadgeValue(value);
    input.style.display = 'none';
    badge.style.display = 'inline-flex';
    wrapper.dataset.editing = 'false';
  }

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') { stopEvent(e); await saveAndClose(); }
    if (e.key === 'Escape') {
      stopEvent(e);
      input.style.display = 'none';
      badge.style.display = 'inline-flex';
      wrapper.dataset.editing = 'false';
    }
  });

  input.addEventListener('blur', async () => {
    if (wrapper.dataset.editing === 'true') await saveAndClose();
  });

  wrapper.appendChild(badge);
  wrapper.appendChild(input);
  return wrapper;
}

function updateExistingBadge(wrapper, value, videoId) {
  if (wrapper.dataset.editing === 'true') return;
  wrapper.dataset.videoId = videoId;
  const badge = wrapper.querySelector('.ts-label-badge');
  const input = wrapper.querySelector('.ts-label-input');
  if (!badge || !input) return;
  badge.textContent = value || 'Label';
  badge.style.color = value ? '#e0d0ff' : '#888';
  badge.style.background = value ? '#2d1f4a' : '#1e1e1e';
  badge.style.border = value ? '1px solid #6d4faa' : '1px solid #3a3a3a';
  input.value = value || '';
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
        updateExistingBadge(existing, labels[videoId] || '', videoId);
        return;
      }
      existing.remove();
    }

    const badge = createLabelBadge(labels[videoId] || '', videoId);
    const epBadge = titleEl.querySelector('.ep-inline-wrapper');
    if (epBadge) {
      epBadge.after(badge);
    } else {
      // No EP badge yet — append so EP can still prepend before us later
      titleEl.insertBefore(badge, titleEl.firstChild);
    }
  });
}

async function boot() {
  for (let i = 0; i < 20; i++) {
    await inject();
    await sleep(1500);
  }
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
