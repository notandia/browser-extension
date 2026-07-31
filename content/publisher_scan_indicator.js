'use strict';

;(function initializePublisherScanIndicator() {
  if (window.notandiaPublisherScanIndicatorInjected) return;
  window.notandiaPublisherScanIndicatorInjected = true;

  const runtime = window.NotandiaRuntime;
  if (!runtime?.isAvailable()) return;
  let finishTimer = null;

  function announceStart(reason, fallbackDelay) {
    clearTimeout(finishTimer);
    runtime.sendMessage({ type: 'publisherScanStarted', reason: String(reason || 'scan').slice(0, 32) });
    finishTimer = setTimeout(() => {
      finishTimer = null;
      runtime.sendMessage({ type: 'publisherScanFinished' });
    }, fallbackDelay);
  }

  announceStart('initial', 4000);

  try {
    chrome.runtime.onMessage.addListener(message => {
      if (message?.type === 'forcePublisherRescan') announceStart('manual', 2500);
      return false;
    });
  } catch (error) {
    if (runtime.isInvalidationError(error)) runtime.invalidate();
    else throw error;
  }
})();