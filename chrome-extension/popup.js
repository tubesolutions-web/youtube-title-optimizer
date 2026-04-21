const STORAGE_KEY   = 'tsAutoDescTemplates';
const FEATURES_KEY  = 'tsFeatures';

const FEATURE_IDS = ['agedChecker', 'tracker', 'epNumbers', 'videoLabels', 'autoDesc'];

let templates = {};
let features  = {};
let currentChannel = null;

const viewMain     = document.getElementById('view-main');
const viewSettings = document.getElementById('view-settings');
const channelFillList = document.getElementById('channel-fill-list');
const channelSelect   = document.getElementById('channel-select');
const input        = document.getElementById('template-input');
const saveBtn      = document.getElementById('save-btn');
const saveStatus   = document.getElementById('save-status');
const newChannelRow   = document.getElementById('new-channel-row');
const newChannelInput = document.getElementById('new-channel-input');
const addChannelBtn   = document.getElementById('add-channel-btn');

async function load() {
  const data = await chrome.storage.sync.get([STORAGE_KEY, FEATURES_KEY]);
  templates = data[STORAGE_KEY] || {};
  features  = data[FEATURES_KEY] || {};
  renderFeatureToggles();
  renderMainView();
  renderSettingsSelect();
}

// ── Feature toggles ──

function renderFeatureToggles() {
  FEATURE_IDS.forEach(id => {
    const el = document.getElementById('feat-' + id);
    if (el) el.checked = features[id] !== false; // default on
  });
}

FEATURE_IDS.forEach(id => {
  document.getElementById('feat-' + id).addEventListener('change', async (e) => {
    features[id] = e.target.checked;
    await chrome.storage.sync.set({ [FEATURES_KEY]: features });
  });
});

// ── Main View ──

function showDeleteConfirm(channelName) {
  document.getElementById('ts-popup-confirm')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'ts-popup-confirm';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '9999',
    background: 'rgba(0,0,0,0.65)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  });
  overlay.innerHTML = `
    <div style="background:#1a1a2e;border:1px solid #6d4faa;border-radius:10px;
                padding:20px 22px;max-width:240px;font-family:Roboto,sans-serif;
                display:flex;flex-direction:column;gap:14px;box-shadow:0 8px 30px rgba(0,0,0,0.7)">
      <div style="color:#e0d0ff;font-size:13px;line-height:1.5">
        Delete template <strong>"${escHtml(channelName)}"</strong>?
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button id="ts-confirm-cancel" style="background:none;border:1px solid #3a3a3a;border-radius:5px;
          color:#aaa;font-size:11px;padding:5px 12px;cursor:pointer">Cancel</button>
        <button id="ts-confirm-delete" style="background:#7f1d1d;border:1px solid #f87171;border-radius:5px;
          color:#fca5a5;font-size:11px;font-weight:700;padding:5px 12px;cursor:pointer">Delete</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#ts-confirm-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#ts-confirm-delete').addEventListener('click', async () => {
    overlay.remove();
    delete templates[channelName];
    if (currentChannel === channelName) currentChannel = null;
    await chrome.storage.sync.set({ [STORAGE_KEY]: templates });
    renderMainView();
    renderSettingsSelect();
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderMainView() {
  const channels = Object.keys(templates);
  if (!channels.length) {
    channelFillList.innerHTML = `
      <div class="empty-state">
        <strong>No templates yet</strong>
        Click ⚙ to add your first channel template.
      </div>`;
    return;
  }
  channelFillList.innerHTML = channels.map(ch => `
    <div class="channel-fill-row">
      <span class="channel-fill-name">${escHtml(ch)}</span>
      <div style="display:flex;gap:6px">
        <button class="edit-btn" data-channel="${escHtml(ch)}">Edit</button>
        <button class="delete-tmpl-btn" data-channel="${escHtml(ch)}">✕</button>
      </div>
    </div>
  `).join('');

  channelFillList.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentChannel = btn.dataset.channel;
      viewMain.classList.remove('active');
      viewSettings.classList.add('active');
      renderSettingsSelect();
    });
  });

  channelFillList.querySelectorAll('.delete-tmpl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ch = btn.dataset.channel;
      showDeleteConfirm(ch);
    });
  });
}

// ── View Switching ──

document.getElementById('open-settings-btn').addEventListener('click', () => {
  viewMain.classList.remove('active');
  viewSettings.classList.add('active');
});

document.getElementById('back-to-main').addEventListener('click', () => {
  viewSettings.classList.remove('active');
  viewMain.classList.add('active');
});

document.getElementById('main-add-channel').addEventListener('click', () => {
  viewMain.classList.remove('active');
  viewSettings.classList.add('active');
  setTimeout(() => {
    newChannelRow.style.display = 'flex';
    newChannelInput.focus();
  }, 50);
});

// ── Settings View ──

function renderSettingsSelect() {
  const channels = Object.keys(templates);
  channelSelect.innerHTML = '';
  if (!channels.length) {
    channelSelect.innerHTML = '<option value="">— No channels yet —</option>';
    input.value = '';
    currentChannel = null;
    return;
  }
  channels.forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch;
    opt.textContent = ch;
    if (ch === currentChannel) opt.selected = true;
    channelSelect.appendChild(opt);
  });
  if (!currentChannel || !templates[currentChannel]) {
    currentChannel = channels[0];
    channelSelect.value = currentChannel;
  }
  input.value = templates[currentChannel] || '';
}

channelSelect.addEventListener('change', () => {
  currentChannel = channelSelect.value;
  input.value = templates[currentChannel] || '';
});

saveBtn.addEventListener('click', async () => {
  if (!currentChannel) return;
  templates[currentChannel] = input.value;
  await chrome.storage.sync.set({ [STORAGE_KEY]: templates });
  saveStatus.classList.add('show');
  setTimeout(() => {
    saveStatus.classList.remove('show');
    viewSettings.classList.remove('active');
    viewMain.classList.add('active');
  }, 1000);
  renderMainView();
});

addChannelBtn.addEventListener('click', () => {
  newChannelRow.style.display = newChannelRow.style.display === 'none' ? 'flex' : 'none';
  if (newChannelRow.style.display === 'flex') newChannelInput.focus();
});

newChannelInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmAddChannel();
  if (e.key === 'Escape') newChannelRow.style.display = 'none';
});

async function confirmAddChannel() {
  const name = newChannelInput.value.trim();
  if (!name) return;
  templates[name] = '';
  currentChannel = name;
  await chrome.storage.sync.set({ [STORAGE_KEY]: templates });
  newChannelInput.value = '';
  newChannelRow.style.display = 'none';
  renderSettingsSelect();
  renderMainView();
}

document.getElementById('delete-channel-btn').addEventListener('click', async () => {
  if (!currentChannel) return;
  if (!confirm(`Delete template for "${currentChannel}"?`)) return;
  delete templates[currentChannel];
  currentChannel = null;
  await chrome.storage.sync.set({ [STORAGE_KEY]: templates });
  renderSettingsSelect();
  renderMainView();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEY]) { templates = changes[STORAGE_KEY].newValue || {}; renderMainView(); renderSettingsSelect(); }
  if (changes[FEATURES_KEY]) { features = changes[FEATURES_KEY].newValue || {}; renderFeatureToggles(); }
});

load();
