'use strict';

;(function coordinateNotandiaBadges() {
  if (globalThis.NotandiaBadgeCoordinator || !chrome?.action) return;

  const native = {
    setBadgeText: chrome.action.setBadgeText.bind(chrome.action),
    setBadgeBackgroundColor: chrome.action.setBadgeBackgroundColor.bind(chrome.action),
    setTitle: chrome.action.setTitle.bind(chrome.action)
  };
  const pending = new Map();
  const states = new Map();

  function keyFor(details) {
    return Number.isInteger(details?.tabId) ? details.tabId : -1;
  }

  function classify(title) {
    const value = String(title || '');
    if (/known integrity signals/i.test(value)) return 'integrity';
    if (/publisher watchlists/i.test(value)) return 'publisher';
    return 'legacy';
  }

  function selectedState(tabId) {
    const state = states.get(tabId) || {};
    if (state.integrity?.text) return state.integrity;
    if (state.publisher?.text) return state.publisher;
    return state.legacy || { text: '', color: '#48627A', title: 'Notandia' };
  }

  function apply(tabId) {
    const selected = selectedState(tabId);
    const tab = tabId === -1 ? {} : { tabId };
    native.setBadgeText({ ...tab, text: selected.text || '' });
    native.setBadgeBackgroundColor({ ...tab, color: selected.color || '#48627A' });
    native.setTitle({ ...tab, title: selected.title || 'Notandia' });
  }

  chrome.action.setBadgeText = details => {
    const tabId = keyFor(details);
    const value = pending.get(tabId) || {};
    value.text = String(details?.text || '');
    pending.set(tabId, value);
    return Promise.resolve();
  };

  chrome.action.setBadgeBackgroundColor = details => {
    const tabId = keyFor(details);
    const value = pending.get(tabId) || {};
    value.color = details?.color || '#48627A';
    pending.set(tabId, value);
    return Promise.resolve();
  };

  chrome.action.setTitle = details => {
    const tabId = keyFor(details);
    const title = String(details?.title || 'Notandia');
    const source = classify(title);
    const tabState = states.get(tabId) || {};
    if (source === 'legacy') delete tabState.integrity;
    tabState[source] = { ...(pending.get(tabId) || {}), title };
    states.set(tabId, tabState);
    pending.delete(tabId);
    apply(tabId);
    return Promise.resolve();
  };

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'publisherContextUpdate') return false;
    const report = message.report || {};
    const hasMatches = Boolean(report.currentArticle || report.references?.length || report.searchResults?.length);
    if (!hasMatches && Number.isInteger(sender.tab?.id)) {
      const tabState = states.get(sender.tab.id) || {};
      delete tabState.publisher;
      states.set(sender.tab.id, tabState);
      apply(sender.tab.id);
    }
    return false;
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      pending.delete(tabId);
      states.delete(tabId);
    }
  });
  chrome.tabs.onRemoved.addListener(tabId => {
    pending.delete(tabId);
    states.delete(tabId);
  });

  globalThis.NotandiaBadgeCoordinator = Object.freeze({
    classify,
    selectedState,
    clear: tabId => { pending.delete(tabId); states.delete(tabId); }
  });
})();
