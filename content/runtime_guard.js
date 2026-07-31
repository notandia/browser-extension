'use strict';

;(function initializeNotandiaRuntimeGuard() {
  if (window.NotandiaRuntime) return;

  let available = true;

  function isInvalidationError(error) {
    return /extension context invalidated|message port closed|receiving end does not exist/i.test(String(error?.message || error || ''));
  }

  function isAvailable() {
    if (!available) return false;
    try {
      if (!chrome?.runtime?.id) {
        available = false;
        return false;
      }
      return true;
    } catch {
      available = false;
      return false;
    }
  }

  function invalidate() {
    available = false;
  }

  function sendMessage(message, callback) {
    if (!isAvailable()) return false;
    try {
      chrome.runtime.sendMessage(message, response => {
        let error = null;
        try { error = chrome.runtime.lastError || null; } catch { invalidate(); }
        if (error && isInvalidationError(error)) invalidate();
        callback?.(response, error);
      });
      return true;
    } catch (error) {
      if (isInvalidationError(error)) {
        invalidate();
        return false;
      }
      throw error;
    }
  }

  function storageGet(area, defaults, callback) {
    if (!isAvailable()) return false;
    try {
      chrome.storage?.[area]?.get(defaults, stored => {
        let error = null;
        try { error = chrome.runtime.lastError || null; } catch { invalidate(); }
        if (error && isInvalidationError(error)) invalidate();
        callback?.(stored || defaults, error);
      });
      return true;
    } catch (error) {
      if (isInvalidationError(error)) {
        invalidate();
        return false;
      }
      throw error;
    }
  }

  function storageSet(area, values, callback) {
    if (!isAvailable()) return false;
    try {
      chrome.storage?.[area]?.set(values, () => {
        let error = null;
        try { error = chrome.runtime.lastError || null; } catch { invalidate(); }
        if (error && isInvalidationError(error)) invalidate();
        callback?.(error);
      });
      return true;
    } catch (error) {
      if (isInvalidationError(error)) {
        invalidate();
        return false;
      }
      throw error;
    }
  }

  window.NotandiaRuntime = Object.freeze({
    invalidate,
    isAvailable,
    isInvalidationError,
    sendMessage,
    storageGet,
    storageSet
  });
})();