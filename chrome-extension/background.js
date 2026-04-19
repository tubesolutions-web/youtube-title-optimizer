// Tube Solutions — background service worker

// Open the Tube Solutions website when the toolbar icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'https://tubesolutions-web.github.io/youtube-title-optimizer_V1/' });
});

// ── Transcript fetching ───────────────────────────────────────────────────────
// Background scripts get full YouTube HTML (including ytInitialPlayerResponse)
// because they aren't subject to the same fetch restrictions as content scripts.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'FETCH_TRANSCRIPT') {
    fetchTranscript(msg.videoId).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
  if (msg.type === 'FETCH_IMAGE') {
    fetchImageAsArray(msg.url).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
});

async function fetchImageAsArray(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const buf = await resp.arrayBuffer();
  return { data: Array.from(new Uint8Array(buf)), type: resp.headers.get('content-type') || 'image/jpeg' };
}

async function fetchTranscript(videoId) {
  const pageResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    credentials: 'include',
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  if (!pageResp.ok) throw new Error('HTTP ' + pageResp.status);
  const html = await pageResp.text();

  const m = html.match(/"captionTracks":(\[[\s\S]*?\]),"audioTracks"/) ||
            html.match(/"captionTracks":(\[[\s\S]*?\]),"translationLanguages"/);
  if (!m) throw new Error('No transcript available for this video');

  const tracks = JSON.parse(m[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/'));
  if (!tracks?.length) throw new Error('No transcript available');

  const track = tracks.find(t => t.languageCode === 'en') ||
                tracks.find(t => t.languageCode?.startsWith('en')) ||
                tracks[0];
  if (!track?.baseUrl) throw new Error('No transcript available');

  const cleanUrl = track.baseUrl.replace(/[&?]fmt=[^&]*/g, '');
  const sep = cleanUrl.includes('?') ? '&' : '?';

  const captResp = await fetch(cleanUrl + sep + 'fmt=json3', { credentials: 'include' });
  if (!captResp.ok) throw new Error('Could not fetch captions');
  const raw = await captResp.text();

  let text = '';
  try {
    const captData = JSON.parse(raw);
    text = (captData.events || [])
      .filter(e => e.segs)
      .flatMap(e => e.segs.map(s => s.utf8 || ''))
      .join('').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  } catch {
    text = raw.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
  }

  if (!text) throw new Error('No transcript available');
  return { text };
}
