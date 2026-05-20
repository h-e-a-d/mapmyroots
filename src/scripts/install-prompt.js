import { appContext, EVENTS } from '../utils/event-bus.js';

const DISMISSED_KEY = 'mapmyroots_install_dismissed';
const PROMPT_DELAY_MS = 5000;

let deferredPrompt = null;

function emitBus(eventName, payload = {}) {
  try {
    appContext.getEventBus().emit(eventName, payload);
  } catch {
    // EventBus may not be ready before app boot.
  }
}

function shouldShow() {
  return !localStorage.getItem(DISMISSED_KEY);
}

function showBanner() {
  const banner = document.getElementById('installBanner');
  if (!banner) return;
  banner.classList.remove('hidden');
  emitBus(EVENTS.PWA_INSTALL_PROMPT_SHOWN, {});
}

function hideBanner() {
  const banner = document.getElementById('installBanner');
  if (!banner) return;
  banner.classList.add('hidden');
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  if (shouldShow()) {
    setTimeout(showBanner, PROMPT_DELAY_MS);
  }
});

window.addEventListener('appinstalled', () => {
  localStorage.setItem(DISMISSED_KEY, '1');
  hideBanner();
  deferredPrompt = null;
  emitBus(EVENTS.PWA_INSTALL_ACCEPTED, {});
});

document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('installBtn');
  const dismissBtn = document.getElementById('installDismissBtn');

  installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(DISMISSED_KEY, '1');
      emitBus(EVENTS.PWA_INSTALL_ACCEPTED, {});
    } else {
      emitBus(EVENTS.PWA_INSTALL_DISMISSED, { method: 'browser' });
    }
    deferredPrompt = null;
    hideBanner();
  });

  dismissBtn?.addEventListener('click', () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    hideBanner();
    emitBus(EVENTS.PWA_INSTALL_DISMISSED, { method: 'button' });
  });
});
