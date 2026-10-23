'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

const localizerSource = fs.readFileSync(require.resolve('../shared/localization.js'), 'utf8');
const statusMessagesSource = fs.readFileSync(require.resolve('../shared/status_messages.js'), 'utf8');

function loadLocalizer({ protocol = 'chrome-extension:', html = '<html><body></body></html>', language = 'en' } = {}) {
  const { document, window } = parseHTML(html);
  const walkerRoots = [];
  const nativeCreateTreeWalker = document.createTreeWalker.bind(document);
  document.createTreeWalker = (root, ...args) => {
    walkerRoots.push(root);
    return nativeCreateTreeWalker(root, ...args);
  };
  let observerCount = 0;
  class TestMutationObserver {
    constructor() { observerCount++; }
    observe() {}
  }
  const context = {
    document,
    NodeFilter: { SHOW_TEXT: 4 },
    MutationObserver: TestMutationObserver,
    location: { protocol },
    navigator: { language },
    chrome: {
      storage: { sync: { get: (defaults, callback) => callback({ ...defaults, interfaceLanguage: 'en' }) } },
      runtime: { onMessage: { addListener() {} } }
    }
  };
  vm.runInNewContext(localizerSource, context);
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return { document, i18n: context.NotandiaI18n, walkerRoots, observerCount: () => observerCount };
}

test('website localization touches only Notandia badges and installs no page-wide observer', () => {
  const { document, i18n, walkerRoots, observerCount } = loadLocalizer({
    protocol: 'https:',
    html: `<html><body>
      <article id="paper"><p>Expression of concern appears in this scholarly text.</p>
        <span class="notandia-publisher-badges" aria-label="Notandia publisher watchlist matches">
          <span class="notandia-publisher-badge" title="MDPI: potential match (journal-name, publisher-domain)">MDPI · Encyclopedia entry</span>
        </span>
      </article>
    </body></html>`
  });
  assert.equal(observerCount(), 0);
  i18n.setLanguage('it');
  assert.equal(document.querySelector('#paper p').textContent, 'Expression of concern appears in this scholarly text.');
  assert.equal(document.querySelector('.notandia-publisher-badge').textContent, 'MDPI · Voce enciclopedica');
  assert.equal(document.querySelector('.notandia-publisher-badge').title, 'MDPI: possibile corrispondenza (nome della rivista, dominio dell’editore)');
  assert.equal(document.querySelector('.notandia-publisher-badges').getAttribute('aria-label'), 'Corrispondenze tra gli editori monitorati da Notandia');
  assert.ok(walkerRoots.length > 0);
  assert.ok(walkerRoots.every(root => root.matches('.notandia-publisher-badges, .notandia-publisher-badge, .notandia-integrity-chip')));
  i18n.setLanguage('en');
  assert.equal(document.querySelector('.notandia-publisher-badge').textContent, 'MDPI · Encyclopedia entry');
  assert.equal(document.querySelector('.notandia-publisher-badge').title, 'MDPI: potential match (journal-name, publisher-domain)');
});

test('all integrity badge symbols and accessible publisher descriptions localize and restore', () => {
  const sourceLabels = [
    '× Retracted', '! Expression of concern', '✎ Corrected',
    '– Withdrawn or removed', '≡ Duplicate publication', '↩ Reinstated'
  ];
  const expectedLabels = [
    '× Ritrattato', '! Espressione di preoccupazione', '✎ Corretto',
    '– Ritirato o rimosso', '≡ Pubblicazione duplicata', '↩ Ritrattazione revocata'
  ];
  const badges = sourceLabels.map((label, index) => `<span id="status${index}" class="notandia-integrity-chip">${label}</span>`).join('');
  const { document, i18n } = loadLocalizer({ protocol: 'https:', html: `<html><body>${badges}<a id="citation" aria-description="Publisher: MDPI. Encyclopedia entry"></a></body></html>` });
  for (const node of document.querySelectorAll('.notandia-integrity-chip')) i18n.localize(node);
  i18n.localizeAttribute(document.getElementById('citation'), 'aria-description');
  i18n.setLanguage('it');
  assert.deepEqual(sourceLabels.map((_, index) => document.getElementById(`status${index}`).textContent), expectedLabels);
  assert.equal(document.getElementById('citation').getAttribute('aria-description'), 'Editore: MDPI. Voce enciclopedica');
  i18n.setLanguage('en');
  assert.deepEqual(sourceLabels.map((_, index) => document.getElementById(`status${index}`).textContent), sourceLabels);
  assert.equal(document.getElementById('citation').getAttribute('aria-description'), 'Publisher: MDPI. Encyclopedia entry');
});

test('extension pages translate joined summaries and privacy text without translating scholarly quotations', () => {
  const { document, i18n, observerCount } = loadLocalizer({
    protocol: 'chrome-extension:',
    html: `<html><body>
      <p id="summary">2 publisher matches · 1 work with formal updates</p>
      <p id="singular">1 publisher match</p>
      <p id="privacy">Crossref receives DOIs. NCBI receives DOI, PMID or PMCID identifiers. Page text, search queries and page addresses are not sent.</p>
      <p id="permission">Firefox data permission was not granted.</p>
      <div class="context-item"><p id="citation">Expression of concern; full scholarly citation text.</p></div>
    </body></html>`
  });
  assert.equal(observerCount(), 1);
  i18n.setLanguage('it');
  assert.equal(document.getElementById('summary').textContent, '2 corrispondenze con editori · 1 articolo con un avviso post-pubblicazione');
  assert.equal(document.getElementById('singular').textContent, '1 corrispondenza con un editore');
  assert.equal(document.getElementById('privacy').textContent, 'Crossref riceve i DOI. NCBI riceve identificativi DOI, PMID o PMCID. Il testo delle pagine, le query di ricerca e gli indirizzi delle pagine non vengono inviati.');
  assert.equal(document.getElementById('permission').textContent, 'Non hai concesso l’autorizzazione richiesta da Firefox.');
  assert.equal(document.getElementById('citation').textContent, 'Expression of concern; full scholarly citation text.');
  i18n.setLanguage('en');
  assert.equal(document.getElementById('summary').textContent, '2 publisher matches · 1 work with formal updates');
  assert.equal(document.getElementById('singular').textContent, '1 publisher match');
  assert.equal(document.getElementById('privacy').textContent, 'Crossref receives DOIs. NCBI receives DOI, PMID or PMCID identifiers. Page text, search queries and page addresses are not sent.');
});

test('status timers clear localized messages and ignore stale timers from earlier messages', () => {
  const timers = [];
  const element = { textContent: '' };
  const context = { setTimeout: (callback, duration) => { timers.push({ callback, duration }); } };
  vm.runInNewContext(statusMessagesSource, context);
  const writeStatus = context.NotandiaStatusMessages.create(element, 5000);
  writeStatus('Settings saved.');
  element.textContent = 'Impostazioni salvate.';
  writeStatus('Could not save settings.');
  element.textContent = 'Impossibile salvare le impostazioni.';
  assert.equal(timers.length, 2);
  timers[0].callback();
  assert.equal(element.textContent, 'Impossibile salvare le impostazioni.');
  timers[1].callback();
  assert.equal(element.textContent, '');
  assert.ok(timers.every(timer => timer.duration === 5000));
});
