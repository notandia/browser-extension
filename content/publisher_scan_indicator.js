'use strict';

;(function initializePublisherScanIndicator() {
  if (window.notandiaPublisherScanIndicatorInjected) return;
  window.notandiaPublisherScanIndicatorInjected = true;

  const runtime = window.NotandiaRuntime;
  if (!runtime?.isAvailable()) return;

  function announceStart(reason) {
    runtime.sendMessage({ type: 'publisherScanStarted', reason: String(reason || 'scan').slice(0, 32) });
  }

  announceStart('initial');

  try {
    chrome.runtime.onMessage.addListener(message => {
      if (message?.type === 'forcePublisherRescan') announceStart('manual');
      return false;
    });
  } catch (error) {
    if (runtime.isInvalidationError(error)) runtime.invalidate();
    else throw error;
  }
})();