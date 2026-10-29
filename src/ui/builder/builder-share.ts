// builder-share.ts - "Share by link" dialog on the builder page.

import { encodeTreeToParam } from '@/features/share/url-codec.js';
import { buildShareUrl, MAX_URL_BYTES } from '@/features/share/share-utils.js';
import { appContext, EVENTS } from '@/utils/event-bus.js';

const shareBtn = document.getElementById('shareBtn');
const shareModal = document.getElementById('shareModal');

if (shareBtn && shareModal) {
  const closeShareModal = () => shareModal.classList.add('hidden');

  document.getElementById('shareModalClose')?.addEventListener('click', closeShareModal);
  document.getElementById('shareCloseBtn')?.addEventListener('click', closeShareModal);
  shareModal.addEventListener('click', (e) => { if (e.target === shareModal) closeShareModal(); });

  shareBtn.addEventListener('click', async () => {
    const state = window.treeCore?.getCurrentState?.();
    if (!state?.persons?.length) {
      const { notifications } = await import('@/ui/components/notifications.js');
      notifications.warning('Nothing to share', 'Add some people to the tree first.');
      return;
    }

    try {
      const encoded = await encodeTreeToParam(state);
      const url = buildShareUrl(window.location.origin, encoded);
      const nodeCount = state?.persons?.length || 0;

      const urlInput = document.getElementById('shareUrlInput') as HTMLInputElement | null;
      const tooBig = document.getElementById('shareTooBig');
      const statusEl = document.getElementById('shareStatus');

      if (url.length > MAX_URL_BYTES) {
        if (urlInput) urlInput.value = '';
        tooBig?.classList.remove('hidden');
        shareModal.classList.remove('hidden');
        try {
          appContext.getEventBus().emit(EVENTS.SHARE_URL_TOO_LARGE, { urlBytes: url.length, nodeCount });
        } catch {}
        return;
      }

      tooBig?.classList.add('hidden');
      if (urlInput) urlInput.value = url;
      if (statusEl) statusEl.textContent = '';
      shareModal.classList.remove('hidden');
      try {
        appContext.getEventBus().emit(EVENTS.SHARE_URL_GENERATED, { urlBytes: url.length, nodeCount });
      } catch {}
    } catch (err) {
      const { notifications } = await import('@/ui/components/notifications.js');
      notifications.error('Share failed', err.message);
    }
  });

  document.getElementById('shareCopyBtn')?.addEventListener('click', async () => {
    const urlInput = document.getElementById('shareUrlInput') as HTMLInputElement | null;
    const statusEl = document.getElementById('shareStatus');
    if (!urlInput?.value) return;
    try {
      await navigator.clipboard.writeText(urlInput.value);
      if (statusEl) statusEl.textContent = 'Copied!';
      setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2000);
      try {
        appContext.getEventBus().emit(EVENTS.SHARE_URL_COPIED, {});
      } catch {}
    } catch {
      urlInput.select();
      if (statusEl) statusEl.textContent = 'Press Ctrl+C to copy.';
    }
  });
}
