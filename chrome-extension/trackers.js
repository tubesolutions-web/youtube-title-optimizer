// Tube Solutions — YouTube content script
// Injects Bookmark + Track buttons on video thumbnails and the watch page.

const TS_CLASS = 'ts-overlay';
const TS_WATCH_ID = 'ts-watch-btns';

// ── Helpers ──────────────────────────────────────────────────────────────────

function videoIdFromHref(href) {
  try { return new URL(href, location.origin).searchParams.get('v'); }
  catch { return null; }
}

function thumbUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function extractFromRenderer(renderer) {
  const thumbLink = renderer.querySelector('a#thumbnail, a[href*="watch?v="]');
  if (!thumbLink) return null;
  const videoId = videoIdFromHref(thumbLink.getAttribute('href') || '');
  if (!videoId) return null;
  const titleEl = renderer.querySelector('#video-title, yt-formatted-string#video-title');
  const channelLink = renderer.querySelector('ytd-channel-name a, #channel-name a');
  const channelHref = channelLink?.getAttribute('href') || '';
  return {
    id: videoId,
    title: titleEl?.textContent.trim() || '',
    channelTitle: channelLink?.textContent.trim() || '',
    channelUrl: channelHref ? 'https://www.youtube.com' + channelHref : '',
    thumbnail: thumbUrl(videoId),
  };
}

// ── Modal popup ───────────────────────────────────────────────────────────────

let activePopup = null;

function closePopup() {
  activePopup?.remove();
  activePopup = null;
}

function openPickerPopup({ title, subtitle, items, onSelect, onNew }) {
  closePopup();

  const backdrop = document.createElement('div');
  backdrop.className = 'ts-modal-backdrop';
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closePopup();
  });

  const modal = document.createElement('div');
  modal.className = 'ts-modal';

  // Header
  const modalHeader = document.createElement('div');
  modalHeader.className = 'ts-modal-header';

  const titleWrap = document.createElement('div');
  const titleEl = document.createElement('div');
  titleEl.className = 'ts-modal-title';
  titleEl.textContent = title;
  const subtitleEl = document.createElement('div');
  subtitleEl.className = 'ts-modal-subtitle';
  subtitleEl.textContent = subtitle;
  titleWrap.appendChild(titleEl);
  titleWrap.appendChild(subtitleEl);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'ts-modal-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closePopup);

  modalHeader.appendChild(titleWrap);
  modalHeader.appendChild(closeBtn);
  modal.appendChild(modalHeader);

  // Create new button
  const newRow = document.createElement('div');
  newRow.className = 'ts-modal-new-row';

  const newInput = document.createElement('input');
  newInput.type = 'text';
  newInput.className = 'ts-modal-new-input';
  newInput.placeholder = onNew.placeholder;

  const newBtn = document.createElement('button');
  newBtn.className = 'ts-modal-new-btn';
  newBtn.textContent = '+ Create new folder';

  async function submitNew() {
    const name = newInput.value.trim();
    if (!name) return;
    await onNew.create(name);
    closePopup();
  }

  newBtn.addEventListener('click', (e) => { e.stopPropagation(); submitNew(); });
  newInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.stopPropagation(); submitNew(); }
    if (e.key === 'Escape') closePopup();
  });

  newRow.appendChild(newInput);
  newRow.appendChild(newBtn);
  modal.appendChild(newRow);

  // List
  const list = document.createElement('div');
  list.className = 'ts-modal-list';

  items.forEach(item => {
    const row = document.createElement('label');
    row.className = 'ts-modal-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'ts-modal-checkbox';

    const label = document.createElement('span');
    label.textContent = item.label.replace(/^[^\w\s]+\s/, '');

    row.appendChild(cb);
    row.appendChild(label);
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.id === '__new__') return;
      onSelect(item);
      closePopup();
    });
    list.appendChild(row);
  });

  modal.appendChild(list);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  activePopup = backdrop;

  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { closePopup(); document.removeEventListener('keydown', onEsc); }
  });
}

// ── Extension context guard ───────────────────────────────────────────────────

function isContextValid() {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

function guardedStorage(fn) {
  if (!isContextValid()) { showToast('🔄 Reload the page to use the extension'); return Promise.resolve(); }
  return fn().catch(e => {
    if (e?.message?.includes('Extension context invalidated') || e?.message?.includes('context invalidated')) {
      showToast('🔄 Reload the page to use the extension');
    } else { throw e; }
  });
}

// ── Bookmark folder picker ────────────────────────────────────────────────────

async function openBookmarkPicker(anchorEl, video) {
  await guardedStorage(async () => {
    const { tsBookmarkFolders = [] } = await chrome.storage.local.get('tsBookmarkFolders');

    const items = [
      { id: null, label: 'All bookmarks' },
      ...tsBookmarkFolders.map(f => ({ id: f.id, label: f.name })),
    ];

    openPickerPopup({
      title: 'Bookmark video',
      subtitle: video.title || 'Choose a folder',
      items,
      onSelect: (item) => guardedStorage(async () => {
        await queueBookmark(video, item.id);
        showToast('🔖 Bookmarked!');
        anchorEl.classList.add('ts-btn-active');
      }),
      onNew: {
        placeholder: 'New folder name…',
        create: (name) => guardedStorage(async () => {
          const newFolder = { id: 'bmf_' + Date.now(), name };
          const { tsBookmarkFolders: existing = [] } = await chrome.storage.local.get('tsBookmarkFolders');
          existing.push(newFolder);
          await chrome.storage.local.set({ tsBookmarkFolders: existing });
          await queueBookmark(video, newFolder.id, newFolder);
          showToast('🔖 Saved to new folder "' + name + '"');
          anchorEl.classList.add('ts-btn-active');
        }),
      },
    });
  });
}

async function queueBookmark(video, folderId, newFolder = null) {
  const { pendingBookmarks = [] } = await chrome.storage.local.get('pendingBookmarks');
  const filtered = pendingBookmarks.filter(v => v.id !== video.id);
  filtered.push({ ...video, folderId: folderId ?? null, savedAt: Date.now(), newFolder });
  await chrome.storage.local.set({ pendingBookmarks: filtered });
}

// ── Tracker group picker ──────────────────────────────────────────────────────

async function openTrackerPicker(anchorEl, video) {
  await guardedStorage(async () => {
    const { tsTrackerGroups = [] } = await chrome.storage.local.get('tsTrackerGroups');

    const items = tsTrackerGroups.map(g => ({ id: g.id, label: g.name }));

    openPickerPopup({
      title: 'Track channel',
      subtitle: video.channelTitle ? `@${video.channelTitle} channel` : 'Choose a tracker group',
      items: items.length ? items : [{ id: '__new__', label: 'No groups yet — create one below' }],
      onSelect: (item) => guardedStorage(async () => {
        if (item.id === '__new__') return;
        await queueTrackerChannel(video, item.id, item.label);
        showToast('📊 Channel added to tracker!');
        anchorEl.classList.add('ts-btn-active');
        anchorEl.dispatchEvent(new Event('ts-tracked'));
      }),
      onNew: {
        placeholder: 'New group name…',
        create: (name) => guardedStorage(async () => {
          const newGroup = { id: 'tg_' + Date.now(), name };
          const { tsTrackerGroups: existing = [] } = await chrome.storage.local.get('tsTrackerGroups');
          existing.push(newGroup);
          await chrome.storage.local.set({ tsTrackerGroups: existing });
          await queueTrackerChannel(video, newGroup.id, name, newGroup);
          showToast('📊 Added to new group "' + name + '"');
          anchorEl.classList.add('ts-btn-active');
          anchorEl.dispatchEvent(new Event('ts-tracked'));
        }),
      },
    });
  });
}

async function queueTrackerChannel(video, groupId, groupName, newGroup = null) {
  const { pendingTrackerChannels = [] } = await chrome.storage.local.get('pendingTrackerChannels');
  if (!video.channelUrl || pendingTrackerChannels.some(c => c.url === video.channelUrl && c.groupId === groupId)) return;
  pendingTrackerChannels.push({
    name: video.channelTitle,
    url: video.channelUrl,
    groupId,
    groupName,
    newGroup,
    savedAt: Date.now(),
  });
  await chrome.storage.local.set({ pendingTrackerChannels });
}

// ── Generate titles picker ────────────────────────────────────────────────────

async function openGenerateTitlesPicker(video) {
  await guardedStorage(async () => {
    const { tsTrackerGroups = [] } = await chrome.storage.local.get('tsTrackerGroups');

    if (!tsTrackerGroups.length) {
      window.open(`${siteBase}titles?topic=${encodeURIComponent(video.title)}`, '_blank');
      return;
    }

    const items = tsTrackerGroups.map(g => ({ id: g.id, label: g.name }));

    openPickerPopup({
      title: 'Generate titles',
      subtitle: 'Pick a channel group for style reference',
      items,
      onSelect: (item) => {
        window.open(`${siteBase}titles?topic=${encodeURIComponent(video.title)}&group=${encodeURIComponent(item.label)}`, '_blank');
      },
      onNew: {
        placeholder: 'Or enter a channel name…',
        create: (name) => {
          window.open(`${siteBase}titles?topic=${encodeURIComponent(video.title)}&group=${encodeURIComponent(name)}`, '_blank');
          closePopup();
        },
      },
    });
  });
}

// ── Copy title ────────────────────────────────────────────────────────────────

function copyTitle(video) {
  navigator.clipboard.writeText(video.title || '').then(() => {
    showToast('📋 Title copied!');
  }).catch(() => {
    showToast('❌ Failed to copy title');
  });
}

// ── Copy thumbnail ────────────────────────────────────────────────────────────

async function copyThumbnail(video) {
  const urls = [
    `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${video.id}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
  ];
  try {
    for (const url of urls) {
      const pngBlob = await fetchThumbAsPng(url);
      if (!pngBlob) continue;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      showToast('🖼 Thumbnail copied!');
      return;
    }
    showToast('❌ No thumbnail found');
  } catch (e) {
    showToast('❌ ' + (e.message || 'Failed to copy thumbnail'));
  }
}

async function fetchThumbAsPng(url) {
  const resp = await new Promise(resolve => chrome.runtime.sendMessage({ type: 'FETCH_IMAGE', url }, resolve));
  if (resp?.error) throw new Error('Fetch failed: ' + resp.error);
  if (!resp?.data) return null;
  const blob = new Blob([new Uint8Array(resp.data)], { type: resp.type });
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

// ── Download thumbnail ────────────────────────────────────────────────────────

async function downloadThumbnail(video) {
  const urls = [
    `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${video.id}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
  ];
  for (const url of urls) {
    try {
      const resp = await new Promise(resolve => chrome.runtime.sendMessage({ type: 'FETCH_IMAGE', url }, resolve));
      if (!resp?.data) continue;
      const blob = new Blob([new Uint8Array(resp.data)], { type: resp.type });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (video.title || video.id) + '.jpg';
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('⬇ Thumbnail downloaded!');
      return;
    } catch {}
  }
  showToast('❌ Failed to download thumbnail');
}

// ── Copy transcript ───────────────────────────────────────────────────────────

async function copyTranscript(video) {
  if (!video.id) { showToast('❌ No video ID found'); return; }

  // Try reading directly from the page transcript panel first
  if (location.pathname.startsWith('/watch')) {
    const domText = await getDomTranscript();
    if (domText) {
      await navigator.clipboard.writeText(`${video.title}\n\n${domText}`);
      showToast('✅ Title + transcript copied!');
      return;
    }
  }

  // Fall back to background script fetch
  if (!chrome?.runtime?.sendMessage) { showToast('❌ Extension reloaded — refresh the page'); return; }
  showToast('⏳ Fetching transcript…');
  try {
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'FETCH_TRANSCRIPT', videoId: video.id }, (resp) => {
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
        if (resp?.error) { reject(new Error(resp.error)); return; }
        resolve(resp);
      });
    });
    await navigator.clipboard.writeText(`${video.title}\n\n${result.text}`);
    showToast('✅ Title + transcript copied!');
  } catch (e) {
    showToast('❌ ' + (e.message || 'Could not fetch transcript'));
  }
}

async function getDomTranscript() {
  // Find the transcript panel (may already be open)
  let panel = document.querySelector('ytd-transcript-renderer, yt-transcript-renderer');

  if (!panel) {
    const btn =
      document.querySelector('ytd-video-description-transcript-section-renderer button') ||
      Array.from(document.querySelectorAll('button')).find(b => /show transcript/i.test(b.textContent));

    if (!btn) return null;

    showToast('⏳ Opening transcript…');
    btn.click();

    await new Promise((resolve) => {
      const deadline = Date.now() + 6000;
      const poll = setInterval(() => {
        panel = document.querySelector('ytd-transcript-renderer, yt-transcript-renderer');
        if (panel || Date.now() > deadline) { clearInterval(poll); resolve(); }
      }, 150);
    });
  }

  if (!panel) return null;

  // Give segments time to render
  await new Promise(r => setTimeout(r, 400));

  const segments = panel.querySelectorAll('ytd-transcript-segment-renderer, yt-transcript-segment-renderer');
  if (!segments.length) return null;

  return Array.from(segments)
    .map(s => {
      const textEl = s.querySelector('yt-formatted-string.segment-text, .segment-text, yt-formatted-string');
      return (textEl?.textContent ?? s.textContent).trim();
    })
    .filter(Boolean)
    .join(' ');
}

// ── Toast notification ────────────────────────────────────────────────────────

function showToast(msg) {
  document.getElementById('ts-toast')?.remove();
  const el = document.createElement('div');
  el.id = 'ts-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('ts-toast-visible'));
  setTimeout(() => {
    el.classList.remove('ts-toast-visible');
    setTimeout(() => el.remove(), 350);
  }, 2400);
}

// ── Overlay on thumbnails ─────────────────────────────────────────────────────

const siteBase = 'https://tubesolutions-web.github.io/youtube-title-optimizer_V1/';

let activeDropdown = null;
function closeDropdown() { activeDropdown?.remove(); activeDropdown = null; }

function openOverlayDropdown(anchorBtn, video) {
  closeDropdown();

  const menu = document.createElement('div');
  menu.className = 'ts-dropdown';

  const options = [
    { icon: '🔖', label: 'Bookmark', action: () => openBookmarkPicker(anchorBtn, video) },
    { icon: '📊', label: 'Track channel', action: () => openTrackerPicker(anchorBtn, video) },
    { icon: '🔍', label: 'Find similar', action: () => window.open(`${siteBase}titles?similar=${encodeURIComponent(video.title)}`, '_blank') },
    { icon: '📝', label: 'Generate titles', action: () => openGenerateTitlesPicker(video) },
    { icon: '📋', label: 'Copy transcript', action: () => copyTranscript(video) },
    { icon: '✏️', label: 'Copy title', action: () => copyTitle(video) },
    { icon: '🖼', label: 'Copy thumbnail', action: () => copyThumbnail(video) },
    { icon: '⬇', label: 'Download thumbnail', action: () => downloadThumbnail(video) },
  ];

  options.forEach(({ icon, label, action }) => {
    const item = document.createElement('button');
    item.className = 'ts-dropdown-item';
    item.innerHTML = `<span class="ts-dropdown-icon">${icon}</span>${label}`;
    item.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeDropdown(); action(); });
    menu.appendChild(item);
  });

  document.body.appendChild(menu);
  activeDropdown = menu;

  const rect = anchorBtn.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
  menu.style.left = `${rect.left + window.scrollX}px`;

  requestAnimationFrame(() => {
    const mw = menu.offsetWidth;
    const vw = window.innerWidth;
    if (rect.left + mw > vw - 8) menu.style.left = `${vw - mw - 8 + window.scrollX}px`;
  });

  setTimeout(() => document.addEventListener('click', function onOut(e) {
    if (!menu.contains(e.target)) { closeDropdown(); document.removeEventListener('click', onOut, true); }
  }, true), 0);
}

function injectOverlay(renderer) {
  if (renderer.querySelector(`.${TS_CLASS}`)) return;
  const thumbContainer = renderer.querySelector('ytd-thumbnail, #thumbnail');
  if (!thumbContainer) return;
  const video = extractFromRenderer(renderer);
  if (!video?.id) return;

  const overlay = document.createElement('div');
  overlay.className = TS_CLASS;

  const mainBtn = document.createElement('button');
  mainBtn.className = 'ts-btn';
  mainBtn.title = 'Tube Solutions';
  mainBtn.textContent = '⚡';

  mainBtn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    openOverlayDropdown(mainBtn, video);
  });

  overlay.appendChild(mainBtn);
  thumbContainer.appendChild(overlay);
}

// ── Watch page buttons ────────────────────────────────────────────────────────

function injectWatchButtons() {
  if (!location.pathname.startsWith('/watch')) return;
  if (document.getElementById(TS_WATCH_ID)) return;
  const videoId = new URLSearchParams(location.search).get('v');
  if (!videoId) return;

  const titleEl =
    document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
    document.querySelector('#above-the-fold #title h1') ||
    document.querySelector('ytd-watch-metadata h1');
  if (!titleEl) return;

  const channelLink =
    document.querySelector('ytd-video-owner-renderer ytd-channel-name a') ||
    document.querySelector('#upload-info ytd-channel-name a') ||
    document.querySelector('ytd-channel-name a');

  const channelHref = channelLink?.getAttribute('href') || '';
  const video = {
    id: videoId,
    title: titleEl.textContent.trim(),
    channelTitle: channelLink?.textContent.trim() || '',
    channelUrl: channelHref ? 'https://www.youtube.com' + channelHref : '',
    thumbnail: thumbUrl(videoId),
  };

  const container = document.createElement('div');
  container.id = TS_WATCH_ID;

  const buttons = [
    ['🔖 Bookmark',          (b) => openBookmarkPicker(b, video)],
    ['📊 Track Channel',     (b) => openTrackerPicker(b, video)],
    ['🔍 Find similar',      () => window.open(`${siteBase}titles?similar=${encodeURIComponent(video.title)}`, '_blank')],
    ['📝 Generate titles',   () => openGenerateTitlesPicker(video)],
    ['📋 Copy transcript',   () => copyTranscript(video)],
    ['✏️ Copy title',        () => copyTitle(video)],
    ['🖼 Copy thumbnail',    () => copyThumbnail(video)],
    ['⬇ Download thumbnail', () => downloadThumbnail(video)],
  ];

  buttons.forEach(([label, action]) => {
    const btn = document.createElement('button');
    btn.className = 'ts-watch-btn';
    btn.textContent = label;
    btn.addEventListener('click', (e) => { e.stopPropagation(); action(btn); });
    container.appendChild(btn);
  });

  const h1 = titleEl.closest('h1') || titleEl;
  h1.insertAdjacentElement('afterend', container);
}

// ── Channel page "Track channel" button ───────────────────────────────────────

const TS_CHANNEL_BTN_ID = 'ts-channel-track-btn';

let channelBtnTimer = null;
let channelBtnObserver = null;

async function injectChannelButton() {
  if (document.getElementById(TS_CHANNEL_BTN_ID)) return;
  if (!/^\/((@|channel\/|c\/|user\/)[^/]+)/.test(location.pathname)) return;

  // Anchor: subscribe button on the channel header only (not inside modals/popups)
  const subscribeEl =
    document.querySelector('ytd-channel-header-renderer yt-subscribe-button-view-model') ||
    document.querySelector('ytd-channel-header-renderer ytd-subscribe-button-renderer') ||
    document.querySelector('ytd-channel-header-renderer #subscribe-button') ||
    document.querySelector('ytd-c4-tabbed-header-renderer yt-subscribe-button-view-model') ||
    document.querySelector('ytd-c4-tabbed-header-renderer ytd-subscribe-button-renderer');

  // Fallback anchor for own channel: the action buttons row
  const actionsRow =
    document.querySelector('yt-flexible-actions-view-model') ||
    document.querySelector('#inner-header-container #buttons') ||
    document.querySelector('#channel-header #buttons') ||
    document.querySelector('ytd-channel-header-renderer #buttons');

  const anchor = subscribeEl || actionsRow;

  if (!anchor) {
    if (!channelBtnObserver) {
      channelBtnObserver = new MutationObserver(() => {
        if (document.getElementById(TS_CHANNEL_BTN_ID)) { channelBtnObserver.disconnect(); channelBtnObserver = null; return; }
        const el =
          document.querySelector('ytd-channel-header-renderer yt-subscribe-button-view-model, ytd-channel-header-renderer ytd-subscribe-button-renderer, ytd-c4-tabbed-header-renderer yt-subscribe-button-view-model') ||
          document.querySelector('yt-flexible-actions-view-model, #inner-header-container #buttons, ytd-channel-header-renderer #buttons');
        if (el) { channelBtnObserver.disconnect(); channelBtnObserver = null; injectChannelButton(); }
      });
      channelBtnObserver.observe(document.body, { childList: true, subtree: true });
    }
    clearTimeout(channelBtnTimer);
    channelBtnTimer = setTimeout(injectChannelButton, 250);
    return;
  }

  const channelHref = location.pathname;
  const channelTitle =
    document.querySelector('#channel-name .ytd-channel-name, #channel-name yt-formatted-string')?.textContent.trim() ||
    document.querySelector('meta[property="og:title"]')?.content?.replace(/\s*-\s*YouTube\s*$/i, '').trim() ||
    document.title.replace(/\s*-\s*YouTube\s*$/i, '').trim() || '';
  const channelUrl = 'https://www.youtube.com' + channelHref;

  const video = {
    id: '', title: channelTitle, channelTitle, channelUrl, thumbnail: '',
  };

  const btn = document.createElement('button');
  btn.id = TS_CHANNEL_BTN_ID;
  btn.textContent = '📊 Track channel';

  Object.assign(btn.style, {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: '6px', padding: '0 16px', height: '36px',
    borderRadius: '18px', fontFamily: 'Roboto, Arial, sans-serif',
    fontSize: '14px', fontWeight: '500', marginLeft: '8px', flexShrink: '0',
    background: 'rgb(242,242,242)', color: 'rgb(15,15,15)', border: 'none', cursor: 'pointer',
    transition: 'background-color 0.15s',
  });

  btn.addEventListener('mouseenter', () => btn.style.background = 'rgb(218,218,218)');
  btn.addEventListener('mouseleave', () => btn.style.background = 'rgb(242,242,242)');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openTrackerPicker(btn, video);
  });

  if (subscribeEl) {
    // Insert right after the subscribe button
    const btnRow = subscribeEl.closest('#buttons, yt-flexible-actions-view-model, [class*="action"]') || subscribeEl.parentElement;
    btnRow.insertBefore(btn, subscribeEl.nextSibling);
  } else {
    // Own channel: append to the actions row
    actionsRow.appendChild(btn);
  }
}

// ── Page scanning ─────────────────────────────────────────────────────────────

const RENDERER_SELECTORS = [
  'ytd-video-renderer',
  'ytd-rich-item-renderer',
  'ytd-compact-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-playlist-video-renderer',
  'ytd-shelf-renderer ytd-video-renderer',
  'ytd-item-section-renderer ytd-video-renderer',
].join(',');

function scanPage() {
  document.querySelectorAll(RENDERER_SELECTORS).forEach(injectOverlay);
  injectWatchButtons();
  injectChannelButton();
}

// ── MutationObserver + SPA navigation ────────────────────────────────────────

let scanTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(scanPage, 300);
});
observer.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener('yt-navigate-finish', () => {
  clearTimeout(channelBtnTimer);
  channelBtnObserver?.disconnect(); channelBtnObserver = null;
  document.getElementById(TS_WATCH_ID)?.remove();
  document.getElementById(TS_CHANNEL_BTN_ID)?.remove();
  closePopup();
  setTimeout(scanPage, 200);
});

scanPage();
