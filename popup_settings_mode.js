'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('settingsIcon');
  const panel = document.getElementById('settingsPanel');
  if (!button || !panel) return;

  function sync(open) {
    panel.hidden = !open;
    panel.classList.toggle('open', open);
    document.body.classList.toggle('settings-mode', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close quick settings' : 'Open quick settings');
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  sync(button.getAttribute('aria-expanded') === 'true');

  button.addEventListener('click', () => {
    queueMicrotask(() => sync(button.getAttribute('aria-expanded') === 'true'));
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || button.getAttribute('aria-expanded') !== 'true') return;
    sync(false);
    button.focus();
  });
});
