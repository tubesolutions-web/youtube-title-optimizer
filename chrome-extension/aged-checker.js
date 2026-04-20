// YouTube Aged Checker
// Shows "Zero channel" or "Aged channel" badge on YouTube channel pages.

const channelDetector = (() => {
  const BADGE_ID = 'ts-channel-badge';
  const ZERO_THRESHOLD_DAYS = 120;
  const CACHE_KEY = 'ts-join-cache';
  let running = false;
  let prefetchedJoined = null;

  function isChannelPage() {
    return /^\/((@|channel\/|c\/|user\/)[^/]+)/.test(location.pathname);
  }

  function getChannelKey() {
    const m = location.pathname.match(/^\/((@|channel\/|c\/|user\/)[^/]+)/);
    return m ? m[1] : null;
  }

  function getAboutUrl() {
    const key = getChannelKey();
    return key ? `${location.origin}/${key}/about` : null;
  }

  function removeBadge() { document.getElementById(BADGE_ID)?.remove(); }

  function formatAge(days) {
    if (days < 30) return `${days} days old`;
    if (days < 365) {
      const months = Math.round(days / 30.44);
      return `${months} ${months === 1 ? 'month' : 'months'} old`;
    }
    return `${Math.round(days / 365.25)} years old`;
  }

  async function getCached(channelKey) {
    try {
      const data = await chrome.storage.local.get(CACHE_KEY);
      const cache = data[CACHE_KEY] || {};
      const entry = cache[channelKey];
      if (!entry) return null;
      return { text: entry.text, date: new Date(entry.date) };
    } catch { return null; }
  }

  async function setCached(channelKey, joined) {
    try {
      const data = await chrome.storage.local.get(CACHE_KEY);
      const cache = data[CACHE_KEY] || {};
      cache[channelKey] = { text: joined.text, date: joined.date.toISOString() };
      await chrome.storage.local.set({ [CACHE_KEY]: cache });
    } catch { /* silent */ }
  }

  async function fetchJoinDate() {
    const url = getAboutUrl();
    if (!url) return null;
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return null;
      const html = await res.text();
      for (const p of [
        /"joinedDateText"\s*:\s*\{\s*"content"\s*:\s*"Joined\s+([^"]+)"/i,
        /Joined\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i,
      ]) {
        const m = html.match(p);
        if (m) { const d = new Date(m[1].trim()); if (!isNaN(d)) return { text: m[1].trim(), date: d }; }
      }
    } catch { /* silent */ }
    return null;
  }

  async function getJoinDate() {
    const key = getChannelKey();
    if (!key) return null;
    if (prefetchedJoined) { const j = prefetchedJoined; prefetchedJoined = null; return j; }
    const cached = await getCached(key);
    if (cached) return cached;
    const fetched = await fetchJoinDate();
    if (fetched) await setCached(key, fetched);
    return fetched;
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none';
  }

  const SIDEBAR_SELECTORS = '#guide, #sections, ytd-mini-guide-renderer, #masthead';

  function findTitleElement() {
    const directSelectors = [
      '#page-header ytd-page-header-renderer #title h1',
      '#page-header ytd-page-header-renderer #title yt-formatted-string',
      'ytd-c4-tabbed-header-renderer #channel-name h1',
      'ytd-c4-tabbed-header-renderer #channel-name yt-formatted-string',
      'ytd-channel-name #text.ytd-channel-name',
      '#channel-name #text',
      '#inner-header-container h1',
      '#channel-header-container h1',
      '#header h1',
    ];
    for (const sel of directSelectors) {
      const el = document.querySelector(sel);
      if (el && isVisible(el) && !el.closest(SIDEBAR_SELECTORS)) return el;
    }
    const expected = (document.querySelector('meta[property="og:title"]')?.content || document.title)
      .replace(/\s*-\s*YouTube\s*$/i, '').trim();
    if (expected) {
      let best = null, bestScore = -Infinity;
      document.querySelectorAll('h1, yt-formatted-string').forEach(el => {
        if (!isVisible(el) || el.innerText?.trim() !== expected) return;
        if (el.closest(SIDEBAR_SELECTORS)) return;
        const score = parseFloat(getComputedStyle(el).fontSize) * 10 + (el.tagName === 'H1' ? 100 : 0);
        if (score > bestScore) { bestScore = score; best = el; }
      });
      if (best) return best;
    }
    for (const el of document.querySelectorAll('h1')) {
      if (isVisible(el) && !el.closest(SIDEBAR_SELECTORS)) return el;
    }
    return null;
  }

  function insertBadge(label, joinedText, isZero) {
    removeBadge();
    const titleEl = findTitleElement();
    if (!titleEl) return false;
    const color = isZero ? '#ff7a00' : '#00eaff';
    const badge = document.createElement('span');
    badge.id = BADGE_ID;
    badge.innerText = label;
    badge.title = `Joined ${joinedText}`;
    Object.assign(badge.style, {
      display: 'inline-flex', alignItems: 'center',
      marginLeft: '8px', padding: '0 16px', borderRadius: '9999px',
      height: '36px', fontSize: '14px', fontWeight: '500', background: 'rgba(0,0,0,0.85)',
      border: `1px solid ${color}`, color, zIndex: '9999', whiteSpace: 'nowrap',
      backdropFilter: 'blur(6px)', verticalAlign: 'middle', cursor: 'default',
      letterSpacing: '0.01em',
      boxShadow: `0 0 5px ${color}88, 0 0 10px ${color}44`,
    });
    titleEl.insertAdjacentElement('afterend', badge);
    return true;
  }

  async function run() {
    const featData = await chrome.storage.sync.get('tsFeatures');
    if ((featData['tsFeatures'] || {}).agedChecker === false) { removeBadge(); return; }
    if (running) return;
    running = true;
    try {
      if (!isChannelPage()) { removeBadge(); return; }
      const joined = await getJoinDate();
      if (!joined) return;
      const days = Math.floor((Date.now() - joined.date.getTime()) / 86400000);
      const isZero = days <= ZERO_THRESHOLD_DAYS;
      const label = `${isZero ? 'Zero' : 'Aged'} channel · ${formatAge(days)}`;
      for (const delay of [0, 200, 500, 1000, 2000]) {
        if (delay) await new Promise(r => setTimeout(r, delay));
        if (!isChannelPage()) break;
        if (insertBadge(label, joined.text, isZero)) break;
      }
    } finally { running = false; }
  }

  async function prefetch() {
    if (!isChannelPage()) return;
    const key = getChannelKey();
    if (!key) return;
    const cached = await getCached(key);
    if (cached) { prefetchedJoined = cached; return; }
    const fetched = await fetchJoinDate();
    if (fetched) { prefetchedJoined = fetched; await setCached(key, fetched); }
  }

  let mutationTimer = null;
  new MutationObserver(() => {
    if (document.getElementById(BADGE_ID) || running || !isChannelPage()) return;
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      if (!document.getElementById(BADGE_ID) && !running && isChannelPage()) run();
    }, 300);
  }).observe(document.body, { childList: true, subtree: true });

  return {
    run,
    onNavigateStart() { prefetch(); },
    onNavigate() { removeBadge(); setTimeout(run, 200); },
  };
})();

chrome.storage.sync.get('tsFeatures', (data) => {
  if ((data['tsFeatures'] || {}).agedChecker === false) return;
  window.addEventListener('yt-navigate-start', () => channelDetector.onNavigateStart());
  window.addEventListener('yt-navigate-finish', () => channelDetector.onNavigate());
  channelDetector.run();
});

chrome.storage.onChanged.addListener((changes) => {
  if (!changes['tsFeatures']) return;
  const feat = changes['tsFeatures'].newValue || {};
  if (feat.agedChecker === false) {
    document.getElementById('ts-channel-badge')?.remove();
  } else {
    channelDetector.run();
  }
});
