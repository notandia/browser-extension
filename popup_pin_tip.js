'use strict';

// Pinning stays a user choice. Unsupported browsers quietly omit the tip.
document.addEventListener('DOMContentLoaded', async () => {
  const api = globalThis.browser || globalThis.chrome;
  const tip = document.getElementById('pinTip');
  if (!tip || !api?.action?.getUserSettings || !api?.storage?.local) return;
  const key = 'notandiaPinTipDismissed';
  try {
    const [stored, settings] = await Promise.all([
      api.storage.local.get(key), api.action.getUserSettings()
    ]);
    if (stored[key] || settings?.isOnToolbar !== false) return;
    const instructions = document.getElementById('pinInstructions');
    if (/Edg\//.test(navigator.userAgent)) {
      instructions.textContent = 'Open Extensions beside the address bar, find Notandia, and choose Show in toolbar.';
    } else if (/Firefox\//.test(navigator.userAgent)) {
      instructions.textContent = 'Open Extensions, select the gear beside Notandia, and choose Pin to Toolbar.';
    } else if (/Chrome\//.test(navigator.userAgent)) {
      instructions.textContent = 'Open the Extensions menu (puzzle piece) beside the address bar, then select the pin beside Notandia.';
    }
    tip.hidden = false;
    document.getElementById('dismissPinTip').addEventListener('click', () => {
      tip.hidden = true;
      api.storage.local.set({ [key]: true }).catch(() => {});
    });
    api.action.onUserSettingsChanged?.addListener(settings => {
      if (settings.isOnToolbar === true) tip.hidden = true;
    });
  } catch (_) {
    // A toolbar hint must never block the reference checker.
  }
});
