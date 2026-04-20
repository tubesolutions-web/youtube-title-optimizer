// Tube Solutions — Auto Description filler for YouTube Studio
(() => {
const AD_KEY = 'tsAutoDescTemplates';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isEditPage() {
  return /\/video\/[^/]+\/edit/.test(location.pathname);
}

function getDescriptionField() {
  // The description div always has id="textbox" and aria-label containing "Tell viewers"
  // Check all contenteditable elements — avoid the title one
  for (const ce of document.querySelectorAll('[contenteditable="true"]')) {
    const label = (ce.getAttribute('aria-label') || '').toLowerCase();
    if (label.includes('tell viewers') || label.includes('description')) {
      return ce;
    }
  }

  // Fallback: ytcp-social-suggestions-textbox that is NOT inside a title area
  for (const box of document.querySelectorAll('ytcp-social-suggestions-textbox')) {
    if (box.closest('[class*="title"]') || box.closest('#title')) continue;
    const ce = box.querySelector('[contenteditable="true"]') || box.querySelector('#textbox');
    if (ce) return ce;
  }

  // Final fallback: tallest contenteditable (description > title in height)
  let best = null, bestH = 0;
  for (const ce of document.querySelectorAll('[contenteditable="true"]')) {
    const h = ce.getBoundingClientRect().height;
    if (h > bestH) { bestH = h; best = ce; }
  }
  return bestH > 50 ? best : null;
}

function isEmpty(ce) {
  return !(ce.innerText || ce.textContent || '').trim().replace(/\u200b/g, '');
}

function setDescription(ce, text) {
  ce.focus();

  // Try execCommand first (preserves undo history)
  document.execCommand('selectAll', false, null);
  const ok = document.execCommand('insertText', false, text);

  if (!ok) {
    // Fallback: set innerText directly and fire Polymer-compatible events
    ce.innerText = text;
  }

  ce.dispatchEvent(new Event('input',  { bubbles: true, composed: true }));
  ce.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

function getChannelName() {
  try {
    if (window.ytcfg?.get) {
      const n = window.ytcfg.get('CHANNEL_NAME');
      if (n) return n;
    }
  } catch (e) {}
  const tries = [
    () => document.querySelector('ytcp-channel-watermark')?.getAttribute('channel-name'),
    () => document.querySelector('ytcp-channel-watermark')?.textContent?.trim(),
    () => document.querySelector('#channel-title')?.textContent?.trim(),
    () => document.querySelector('ytcp-entity-name')?.textContent?.trim(),
  ];
  for (const fn of tries) {
    try { const n = fn(); if (n) return n; } catch (e) {}
  }
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

async function autoFill() {
  if (!isEditPage()) return;

  const data = await chrome.storage.sync.get([AD_KEY, 'tsFeatures']);
  const feat = data['tsFeatures'] || {};
  if (feat.autoDesc === false) return;

  const templates = data[AD_KEY] || {};
  if (!Object.keys(templates).length) return;

  // Wait for description field using MutationObserver — fires as soon as it appears
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

  // Small delay so the field is fully ready before writing
  await sleep(150);

  // Don't overwrite existing content
  if (!isEmpty(ce)) return;

  // Channel name (try immediately, then wait briefly)
  let channelName = getChannelName();
  if (!channelName) {
    await sleep(800);
    channelName = getChannelName();
  }

  const template = findTemplate(templates, channelName);
  if (template) setDescription(ce, template);
}

// Popup "Fill" button — manual override
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'fillDescription') return;
  const ce = getDescriptionField();
  if (ce) {
    setDescription(ce, msg.template);
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false });
  }
});

autoFill();

let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(autoFill, 1200);
  }
}).observe(document.body, { childList: true, subtree: true });
})();
