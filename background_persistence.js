'use strict';

;(function initializeBackgroundPersistence() {
  if (globalThis.NotandiaBackgroundPersistence) return;

  const STATE_PREFIX = 'notandia-session-tab-state-';
  const STATE_VERSION = 2;
  const memoryState = new Map();
  const restorePromises = new Map();
  const saveTimers = new Map();

  function stateKey(tabId) {
    return `${STATE_PREFIX}${tabId}`;
  }

  function clone(value) {
    if (value == null) return null;
    try {
      return structuredClone(value);
    } catch {
      return JSON.parse(JSON.stringify(value));
    }
  }

  function snapshotTab(tabId) {
    if (!Number.isInteger(tabId)) return null;
    return {
      version: STATE_VERSION,
      updatedAt: Date.now(),
      integrity: clone(integrityTabData.get(tabId) || null),
      publisher: clone(publisherTabData.get(tabId) || null),
      legacyReferences: clone(tabData.get(tabId) || []),
      legacyBadge: clone(legacyBadgeData.get(tabId) || null)
    };
  }

  function validState(value) {
    return Boolean(value && typeof value === 'object' && value.version === STATE_VERSION);
  }

  function writeSession(tabId, state) {
    memoryState.set(tabId, state);
    if (!chrome.storage?.session) return Promise.resolve();
    return new Promise(resolve => {
      chrome.storage.session.set({ [stateKey(tabId)]: state }, () => resolve());
    });
  }

  async function saveTab(tabId) {
    const state = snapshotTab(tabId);
    if (!state) return false;
    await writeSession(tabId, state);
    return true;
  }

  function readSession(tabId) {
    if (memoryState.has(tabId)) return Promise.resolve(memoryState.get(tabId));
    if (!chrome.storage?.session) return Promise.resolve(null);
    return new Promise(resolve => {
      chrome.storage.session.get(stateKey(tabId), stored => {
        if (chrome.runtime.lastError) return resolve(null);
        const state = stored?.[stateKey(tabId)] || null;
        if (validState(state)) memoryState.set(tabId, state);
        resolve(validState(state) ? state : null);
      });
    });
  }

  function hasUsableState(tabId) {
    return integrityTabData.get(tabId)?.state === 'ready' || publisherTabData.has(tabId);
  }

  function restoreTab(tabId) {
    if (!Number.isInteger(tabId)) return Promise.resolve(false);
    if (restorePromises.has(tabId)) return restorePromises.get(tabId);

    const operation = (async () => {
      const state = await readSession(tabId);
      if (!validState(state)) return hasUsableState(tabId);

      let restoredIntegrity = false;
      let restoredPublisher = false;
      let restoredLegacy = false;

      // A loading snapshot has no active fetch after a worker restart. Do not
      // revive it as a permanently loading report; the recovery path will rescan.
      if (!integrityTabData.has(tabId) && state.integrity?.state === 'ready') {
        integrityTabData.set(tabId, clone(state.integrity));
        restoredIntegrity = true;
      }
      if (!publisherTabData.has(tabId) && state.publisher) {
        publisherTabData.set(tabId, clone(state.publisher));
        restoredPublisher = true;
      }
      if (!tabData.has(tabId) && Array.isArray(state.legacyReferences)) {
        tabData.set(tabId, clone(state.legacyReferences));
        restoredLegacy = state.legacyReferences.length > 0;
      }
      if (!legacyBadgeData.has(tabId) && state.legacyBadge) {
        legacyBadgeData.set(tabId, clone(state.legacyBadge));
        restoredLegacy = true;
      }

      if (restoredIntegrity || restoredPublisher || restoredLegacy) refreshBadge(tabId);
      if (restoredIntegrity) {
        chrome.runtime.sendMessage({ type: 'integrityReportUpdated', tabId, restored: true }, () => void chrome.runtime.lastError);
      }
      if (restoredPublisher) {
        chrome.runtime.sendMessage({ type: 'publisherContextUpdated', tabId, restored: true }, () => void chrome.runtime.lastError);
      }
      return hasUsableState(tabId);
    })().finally(() => restorePromises.delete(tabId));

    restorePromises.set(tabId, operation);
    return operation;
  }

  function clearTab(tabId) {
    if (!Number.isInteger(tabId)) return;
    const timer = saveTimers.get(tabId);
    if (timer) clearTimeout(timer);
    saveTimers.delete(tabId);
    restorePromises.delete(tabId);
    memoryState.delete(tabId);
    if (chrome.storage?.session) chrome.storage.session.remove(stateKey(tabId), () => void chrome.runtime.lastError);
  }

  function restoreAllTabs() {
    if (!chrome.storage?.session) return;
    chrome.storage.session.get(null, stored => {
      if (chrome.runtime.lastError) return;
      for (const [key, state] of Object.entries(stored || {})) {
        if (!key.startsWith(STATE_PREFIX) || !validState(state)) continue;
        const tabId = Number(key.slice(STATE_PREFIX.length));
        if (!Number.isInteger(tabId)) continue;
        memoryState.set(tabId, state);
        void restoreTab(tabId);
      }
    });
  }

  async function activeTabId() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return Number.isInteger(tabs[0]?.id) ? tabs[0].id : null;
    } catch {
      return null;
    }
  }

  function findContextRecord(tabId, referenceId) {
    const publisher = publisherTabData.get(tabId);
    const integrity = integrityTabData.get(tabId);
    const records = [
      ...(publisher?.references || []),
      ...(publisher?.searchResults || []),
      ...(integrity?.records || [])
    ];
    const record = records.find(candidate => candidate?.id === referenceId);
    if (!record) return null;
    const visual = publisherApi.resolveVisualMatch(record.matches || []);
    const status = record.primaryStatus ? STATUS_DEFINITIONS[record.primaryStatus] : null;
    return {
      doi: record.doi || null,
      text: String(record.text || '').slice(0, 500),
      color: status?.color || visual?.color || '#48627A'
    };
  }

  function scheduleSave(tabId, delay = 0) {
    if (!Number.isInteger(tabId)) return;
    const existing = saveTimers.get(tabId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      saveTimers.delete(tabId);
      void saveTab(tabId);
    }, delay);
    saveTimers.set(tabId, timer);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return false;
    const senderTabId = sender.tab?.id;

    if (['publisherContextUpdate', 'mdpiUpdate'].includes(message.type) || message.action === 'updateReferences') {
      scheduleSave(senderTabId, 0);
      return false;
    }

    if (message.type === 'integrityScan') {
      scheduleSave(senderTabId, 50);
      return false;
    }

    if (message.type === 'integrityScanDisabled') {
      scheduleSave(senderTabId, 0);
      return false;
    }

    if ((message.type === 'integrityReportUpdated' || message.type === 'publisherContextUpdated') && Number.isInteger(message.tabId)) {
      scheduleSave(message.tabId, 0);
      return false;
    }

    if (message.type === 'restorePersistedTabState') {
      void activeTabId().then(tabId => {
        if (!Number.isInteger(tabId)) return sendResponse({ restored: false });
        void restoreTab(tabId).then(restored => sendResponse({ restored }));
      });
      return true;
    }

    if (message.type === 'scrollToRef') {
      void activeTabId().then(tabId => {
        if (!Number.isInteger(tabId)) return;
        const context = findContextRecord(tabId, message.refId);
        if (!context) return;
        chrome.tabs.sendMessage(tabId, {
          type: 'scrollToRefOnPage',
          refId: message.refId,
          doi: context.doi,
          text: context.text,
          color: context.color
        }, () => void chrome.runtime.lastError);
      });
      return false;
    }

    return false;
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') clearTab(tabId);
  });
  chrome.tabs.onRemoved.addListener(clearTab);
  chrome.runtime.onStartup?.addListener(restoreAllTabs);

  globalThis.NotandiaBackgroundPersistence = { saveTab, restoreTab, ensureTab: restoreTab, clearTab };
  restoreAllTabs();
})();