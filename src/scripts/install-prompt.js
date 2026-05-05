const DISMISSED_KEY = 'mapmyroots_install_dismissed';
const PROMPT_DELAY_MS = 5000;

let deferredPrompt = null;

function shouldShow() {
  return !localStorage.getItem(DISMISSED_KEY);
}

function showBanner() {
  const banner = document.getElementById('installBanner');
  if (!banner) return;
  banner.classList.remove('hidden');
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
    }
    deferredPrompt = null;
    hideBanner();
  });

  dismissBtn?.addEventListener('click', () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    hideBanner();
  });
});
