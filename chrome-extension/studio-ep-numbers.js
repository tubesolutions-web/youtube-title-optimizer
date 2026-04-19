// Tube Solutions — YouTube Studio content script
// Adds editable EP number badges to YouTube Studio video rows.

const STORAGE_KEY = 'ytStudioEpMap';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getMap() {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  return data[STORAGE_KEY] || {};
}

async function saveValue(videoId, value) {
  const cleaned = normalizeEpValue(value);
  const map = await getMap();
  map[videoId] = cleaned;
  await chrome.storage.sync.set({ [STORAGE_KEY]: map });
}

function stripLeadingZeros(value) {
  const num = parseInt(String(value), 10);
  return Number.isNaN(num) ? String(value).trim() : String(num);
}

function normalizeEpValue(value) {
  if (!value) return '';
  const text = String(value).trim();
  const match = text.match(/\bEP[\s._-]?(\d+)\b/i);
  if (match) return stripLeadingZeros(match[1]);
  const digitsOnly = text.match(/^(\d+)$/);
  if (digitsOnly) return stripLeadingZeros(digitsOnly[1]);
  return text;
}

function stopEvent(e) {
  e.preventDefault();
  e.stopPropagation();
}

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

function getVideoIdFromDetailsPage() {
  const m = window.location.pathname.match(/\/video\/([^/]+)/);
  return m ? m[1] : null;
}

function isDetailsPage() {
  return /\/video\/[^/]+\/edit/.test(window.location.pathname);
}

function extractEpNumber(text) {
  if (!text) return null;
  const m = text.match(/\bEP[\s._-]?(\d+)\b/i);
  return m ? stripLeadingZeros(m[1]) : null;
}

function findFilenameFromPageText() {
  const text = document.body.innerText || '';
  const idx = text.indexOf('Filename');
  if (idx !== -1) {
    const m = text.slice(idx, idx + 500).match(/([^\n]+\.(mp4|mov|mkv|webm|m4v))/i);
    if (m) return m[1].trim();
  }
  for (const line of text.split('\n').map(l => l.trim()).filter(Boolean)) {
    if (/\.(mp4|mov|mkv|webm|m4v)$/i.test(line) && /EP[\s._-]?\d+/i.test(line)) return line;
  }
  return null;
}

async function autoSaveFromDetailsPage() {
  if (!isDetailsPage()) return;
  const videoId = getVideoIdFromDetailsPage();
  if (!videoId) return;
  const filename = findFilenameFromPageText();
  if (!filename) return;
  const epNumber = extractEpNumber(filename);
  if (!epNumber) return;
  const map = await getMap();
  if (map[videoId] !== epNumber) {
    await saveValue(videoId, epNumber);
  }
}

function createBadge(initialValue, videoId) {
  const wrapper = document.createElement('span');
  wrapper.className = 'ep-inline-wrapper';
  wrapper.dataset.videoId = videoId;
  Object.assign(wrapper.style, {
    display: 'inline-flex', alignItems: 'center', marginRight: '6px',
    position: 'relative', zIndex: '20', flexShrink: '0',
  });

  const badge = document.createElement('button');
  badge.type = 'button';
  badge.className = 'ep-inline-badge';
  badge.textContent = initialValue ? `EP.${initialValue}` : 'EP';
  Object.assign(badge.style, {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    height: '20px', padding: '0 6px', fontSize: '11px', fontWeight: '700',
    borderRadius: '999px', cursor: 'pointer', whiteSpace: 'nowrap', color: '#fff',
    background: initialValue ? '#1f1f1f' : '#3a1a1a',
    border: initialValue ? '1px solid #444' : '1px solid #ff4d4d',
  });

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'ep-inline-input';
  input.value = initialValue || '';
  input.placeholder = 'EP';
  Object.assign(input.style, {
    display: 'none', width: '56px', height: '20px', fontSize: '11px',
    textAlign: 'center', borderRadius: '999px', border: '1px solid #555',
    background: '#111', color: '#fff', outline: 'none',
  });

  ['click', 'mousedown', 'mouseup', 'pointerdown'].forEach(ev => {
    wrapper.addEventListener(ev, stopEvent);
    badge.addEventListener(ev, stopEvent);
    input.addEventListener(ev, stopEvent);
  });

  function setBadgeValue(value) {
    badge.textContent = value ? `EP.${value}` : 'EP';
    badge.style.background = value ? '#1f1f1f' : '#3a1a1a';
    badge.style.border = value ? '1px solid #444' : '1px solid #ff4d4d';
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
    const value = normalizeEpValue(input.value);
    input.value = value;
    await saveValue(videoId, value);
    setBadgeValue(value);
    input.style.display = 'none';
    badge.style.display = 'inline-flex';
    wrapper.dataset.editing = 'false';
  }

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') { stopEvent(e); await saveAndClose(); }
    else if (e.key === 'Escape') {
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
  const badge = wrapper.querySelector('.ep-inline-badge');
  const input = wrapper.querySelector('.ep-inline-input');
  if (!badge || !input) return;
  badge.textContent = value ? `EP.${value}` : 'EP';
  badge.style.background = value ? '#1f1f1f' : '#3a1a1a';
  badge.style.border = value ? '1px solid #444' : '1px solid #ff4d4d';
  input.value = value || '';
}

async function inject() {
  const map = await getMap();
  getRows().forEach(row => {
    const titleEl = row.querySelector('#video-title');
    if (!titleEl) return;
    const videoId = getVideoId(row);
    if (!videoId) return;

    Object.assign(titleEl.style, { display: 'flex', alignItems: 'center', gap: '6px' });

    const existing = row.querySelector('.ep-inline-wrapper');
    if (existing) {
      if (existing.dataset.videoId === videoId) {
        updateExistingBadge(existing, map[videoId] || '', videoId);
        return;
      }
      existing.remove();
    }

    titleEl.prepend(createBadge(map[videoId] || '', videoId));
  });
}

async function runAll() {
  await autoSaveFromDetailsPage();
  await inject();
}

async function boot() {
  // Poll during initial page load (Studio is slow to render)
  for (let i = 0; i < 20; i++) {
    await runAll();
    await sleep(1500);
  }

  new MutationObserver(() => runAll()).observe(document.body, {
    childList: true, subtree: true,
  });

  setInterval(runAll, 3000);
}

boot();
