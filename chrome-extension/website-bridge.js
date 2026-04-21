// Tube Solutions — website bridge
// Injected into the GitHub Pages site to relay chrome.storage calls from the page.

window.addEventListener('message', async ({ source, data }) => {
  if (source !== window || typeof data?.tsReq !== 'string') return;
  const { tsReq, id, payload } = data;
  try {
    if (tsReq === 'get') {
      const result = await chrome.storage.local.get(payload);
      window.postMessage({ tsRes: 'get', id, result }, '*');
    } else if (tsReq === 'set') {
      await chrome.storage.local.set(payload);
      window.postMessage({ tsRes: 'set', id }, '*');
    } else if (tsReq === 'remove') {
      await chrome.storage.local.remove(payload);
      window.postMessage({ tsRes: 'remove', id }, '*');
    } else if (tsReq === 'fetchTranscript') {
      try {
        const result = await chrome.runtime.sendMessage({ type: 'FETCH_TRANSCRIPT', videoId: payload.videoId });
        window.postMessage({ tsRes: 'fetchTranscript', id, result }, '*');
      } catch (e) {
        // Retry once — service worker may have been sleeping
        await new Promise(r => setTimeout(r, 600));
        try {
          const result = await chrome.runtime.sendMessage({ type: 'FETCH_TRANSCRIPT', videoId: payload.videoId });
          window.postMessage({ tsRes: 'fetchTranscript', id, result }, '*');
        } catch (e2) {
          window.postMessage({ tsRes: 'fetchTranscript', id, result: { error: e2.message } }, '*');
        }
      }
      return;
    }
  } catch (e) {
    window.postMessage({ tsRes: 'error', id, error: e.message }, '*');
  }
});

// Signal to the page that the extension bridge is ready
window.postMessage({ tsRes: 'ready' }, '*');
