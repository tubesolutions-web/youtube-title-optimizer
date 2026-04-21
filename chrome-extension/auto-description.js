// Tube Solutions — Auto Description filler for YouTube Studio
(() => {
const AD_KEY = 'tsAutoDescTemplates';
const BTN_ID = 'ts-fill-desc-btn';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isEditPage() {
  return /\/video\/[^/]+\/edit/.test(location.pathname) ||
         /\/videos\/upload/.test(location.pathname);
}

function getDescriptionField() {
  for (const ce of document.querySelectorAll('[contenteditable="true"]')) {
    const label = (ce.getAttribute('aria-label') || '').toLowerCase();
    if (label.includes('tell viewers') || label.includes('description') ||
        label.includes('vertel kijkers') || label.includes('beschrijving')) return ce;
  }
  for (const box of document.querySelectorAll('ytcp-social-suggestions-textbox')) {
    if (box.closest('[class*="title"]') || box.closest('#title')) continue;
    const ce = box.querySelector('[contenteditable="true"]') || box.querySelector('#textbox');
    if (ce) return ce;
  }
  let best = null, bestH = 0;
  for (const ce of document.querySelectorAll('[contenteditable="true"]')) {
    const h = ce.getBoundingClientRect().height;
    if (h > bestH) { bestH = h; best = ce; }
  }
  return bestH > 50 ? best : null;
}

function isEmpty(ce) {
  return !(ce.innerText || ce.textContent || '').trim().replace(/​/g, '');
}

function setDescription(ce, text) {
  ce.focus();
  document.execCommand('selectAll', false, null);
  const ok = document.execCommand('insertText', false, text);
  if (!ok) { ce.innerText = text; }
  ce.dispatchEvent(new Event('input',  { bubbles: true, composed: true }));
  ce.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

function getChannelName() {
  try { if (window.ytcfg?.get) { const n = window.ytcfg.get('CHANNEL_NAME'); if (n) return n; } } catch {}
  const tries = [
    () => document.querySelector('ytcp-channel-watermark')?.getAttribute('channel-name'),
    () => document.querySelector('ytcp-channel-watermark')?.textContent?.trim(),
    () => document.querySelector('#channel-title')?.textContent?.trim(),
    () => document.querySelector('ytcp-entity-name')?.textContent?.trim(),
  ];
  for (const fn of tries) { try { const n = fn(); if (n) return n; } catch {} }
  return null;
}

function normalize(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }

function findTemplate(templates, channelName) {
  const keys = Object.keys(templates);
  if (!keys.length) return null;
  if (keys.length === 1) return templates[keys[0]];
  if (!channelName) return null;
  const nc = normalize(channelName);
  for (const k of keys) if (normalize(k) === nc) return templates[k];
  for (const k of keys) { const nk = normalize(k); if (nc.includes(nk) || nk.includes(nc)) return templates[k]; }
  return null;
}

// ── Inject fill button ────────────────────────────────────────────────────────

function findDescriptionLabel() {
  // Look for the label element above the description field
  for (const el of document.querySelectorAll('label, .label, ytcp-form-input-container')) {
    const text = el.textContent?.trim().toLowerCase();
    if (text === 'description' || text === 'beschrijving') return el;
  }
  // Fallback: find the div/span containing "Description" near the description field
  const ce = getDescriptionField();
  if (!ce) return null;
  let node = ce.parentElement;
  for (let i = 0; i < 6; i++) {
    if (!node) break;
    const label = node.querySelector('label, [class*="label"], ytcp-form-input-container');
    if (label) return label;
    node = node.parentElement;
  }
  return null;
}

async function injectButton() {
  if (!isEditPage()) return;
  if (document.getElementById(BTN_ID)) return;

  const ce = getDescriptionField();
  if (!ce) return;

  // Find the label element that contains "Beschrijving" / "Description"
  // Walk up from the field and look for a label row
  function findLabelRow() {
    let node = ce.parentElement;
    for (let i = 0; i < 10; i++) {
      if (!node) break;
      // Look for any element whose direct text is the description label
      const all = node.querySelectorAll('label, span, div');
      for (const el of all) {
        const t = (el.childNodes[0]?.textContent || '').trim().toLowerCase();
        if (t === 'beschrijving' || t === 'description') return el.parentElement || el;
      }
      node = node.parentElement;
    }
    return null;
  }

  const labelRow = findLabelRow();

  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.textContent = '⚡ Fill';
  Object.assign(btn.style, {
    background: 'none',
    border: '1px solid #3a3a3a',
    borderRadius: '4px',
    color: '#aaa',
    fontSize: '11px',
    fontWeight: '600',
    padding: '2px 8px',
    cursor: 'pointer',
    fontFamily: 'Roboto, sans-serif',
    marginLeft: '8px',
    flexShrink: '0',
    transition: 'border-color 0.15s, color 0.15s',
  });
  btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#6d4faa'; btn.style.color = '#c4b0ff'; });
  btn.addEventListener('mouseleave', () => { btn.style.borderColor = '#3a3a3a'; btn.style.color = '#aaa'; });

  function showTemplatePicker(tmpl, field) {
    document.getElementById('ts-tmpl-picker')?.remove();
    const keys = Object.keys(tmpl);
    const picker = document.createElement('div');
    picker.id = 'ts-tmpl-picker';
    Object.assign(picker.style, {
      position: 'absolute', zIndex: '99999', background: '#1a1a2e',
      border: '1px solid #6d4faa', borderRadius: '8px',
      boxShadow: '0 6px 20px rgba(0,0,0,0.6)', minWidth: '160px', overflow: 'hidden',
      fontFamily: 'Roboto, sans-serif',
    });
    keys.forEach(name => {
      const item = document.createElement('div');
      item.textContent = name;
      Object.assign(item.style, {
        padding: '8px 14px', cursor: 'pointer', fontSize: '12px',
        color: '#e0d0ff', borderBottom: '1px solid #2a1f4a',
      });
      item.addEventListener('mouseenter', () => item.style.background = '#2d1f4a');
      item.addEventListener('mouseleave', () => item.style.background = '');
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); e.stopPropagation();
        picker.remove();
        setDescription(field, tmpl[name]);
        btn.textContent = '✓ Done';
        setTimeout(() => { btn.textContent = '⚡ Fill'; }, 2000);
      });
      picker.appendChild(item);
    });
    const rect = btn.getBoundingClientRect();
    Object.assign(picker.style, { position: 'fixed', top: (rect.bottom + 4) + 'px', left: rect.left + 'px' });
    document.body.appendChild(picker);
    setTimeout(() => document.addEventListener('click', () => picker.remove(), { once: true }), 0);
  }

  btn.addEventListener('click', async () => {
    const field = getDescriptionField();
    if (!field) { btn.textContent = '⚡ Not found'; return; }
    const d = await chrome.storage.sync.get(AD_KEY);
    const tmpl = d[AD_KEY] || {};
    let channelName = getChannelName();
    if (!channelName) { await sleep(800); channelName = getChannelName(); }
    const template = findTemplate(tmpl, channelName);
    if (!template) {
      const keys = Object.keys(tmpl);
      if (!keys.length) { btn.textContent = 'No templates saved'; setTimeout(() => { btn.textContent = '⚡ Fill'; }, 3000); return; }
      showTemplatePicker(tmpl, field);
      return;
    }
    setDescription(field, template);
    btn.textContent = '✓ Done';
    setTimeout(() => { btn.textContent = '⚡ Fill'; }, 2000);
  });

  if (labelRow) {
    Object.assign(labelRow.style, { display: 'flex', alignItems: 'center', flexWrap: 'wrap' });
    labelRow.appendChild(btn);
  } else {
    // Fallback: insert right above the description field
    const parent = ce.closest('ytcp-social-suggestions-textbox')?.parentElement || ce.parentElement;
    parent?.insertBefore(btn, parent.firstChild);
  }
}

// ── Auto-fill on page load ────────────────────────────────────────────────────

async function autoFill() {
  if (!isEditPage()) return;

  const data = await chrome.storage.sync.get([AD_KEY, 'tsFeatures']);
  if ((data['tsFeatures'] || {}).autoDesc === false) return;
  const templates = data[AD_KEY] || {};
  if (!Object.keys(templates).length) return;

  const ce = await new Promise(resolve => {
    const existing = getDescriptionField();
    if (existing) { resolve(existing); return; }
    const obs = new MutationObserver(() => {
      const el = getDescriptionField();
      if (el) { obs.disconnect(); resolve(el); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); resolve(null); }, 15000);
  });
  if (!ce) return;

  await sleep(150);
  if (!isEmpty(ce)) return;

  let channelName = getChannelName();
  if (!channelName) { await sleep(800); channelName = getChannelName(); }

  const template = findTemplate(templates, channelName);
  if (template) setDescription(ce, template);
}

async function init() {
  await autoFill();
  // Try injecting button multiple times until the DOM is ready
  for (let i = 0; i < 10; i++) {
    await injectButton();
    if (document.getElementById(BTN_ID)) break;
    await sleep(800);
  }
}

// Popup manual override
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'fillDescription') return;
  const ce = getDescriptionField();
  if (ce) { setDescription(ce, msg.template); sendResponse({ success: true }); }
  else sendResponse({ success: false });
});

init();

let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    document.getElementById(BTN_ID)?.remove();
    setTimeout(init, 1200);
  }
}).observe(document.body, { childList: true, subtree: true });
})();
