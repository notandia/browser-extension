'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'notandia-preset-accessibility-'));
(async () => {
 const browser = await chromium.launchPersistentContext(path.join(output, 'browser-profile'), {
  channel: 'chromium', headless: true, viewport: { width: 1100, height: 900 },
  args: [`--disable-extensions-except=${root}/dist/chrome`, `--load-extension=${root}/dist/chrome`]
 });
 browser.setDefaultTimeout(10000);
 try {
  let worker = browser.serviceWorkers()[0] || await browser.waitForEvent('serviceworker');
  const id = worker.url().split('/')[2];
  const errors = [];
  const setupPage = await browser.newPage();
  await setupPage.setViewportSize({width:480,height:700});
  setupPage.on('pageerror', error => errors.push(error.message));
  await setupPage.goto(`chrome-extension://${id}/popup.html`);
  await setupPage.locator('#lookupSetup').waitFor({state:'visible'});
  assert.equal(await setupPage.locator('#integrityLookupsEnabled').isChecked(), false);
  assert.equal(await setupPage.locator('#ncbiApiEnabledPopup').isChecked(), false);
  await setupPage.keyboard.press('Tab');
  await setupPage.keyboard.press('Tab');
  assert.equal(await setupPage.evaluate(() => document.activeElement.id), 'enableRecommendedChecks');
  const setupBox = await setupPage.locator('#lookupSetup').boundingBox();
  await setupPage.screenshot({path:path.join(output, 'lookup-setup.png'),clip:{x:0,y:0,width:480,height:Math.ceil(setupBox.y+setupBox.height+8)}});
  await setupPage.keyboard.press('Enter');
  await setupPage.locator('#lookupSetup').waitFor({state:'hidden'});
  assert.equal(await setupPage.locator('#integrityLookupsEnabled').isChecked(), true);
  assert.equal(await setupPage.locator('#ncbiApiEnabledPopup').isChecked(), true);
  assert.equal(await setupPage.evaluate(() => document.activeElement.id), 'rescan');
  const lookupSettings = await worker.evaluate(() => chrome.storage.sync.get(['integrityLookupsEnabled','ncbiApiEnabled']));
  assert.equal(lookupSettings.integrityLookupsEnabled, true);
  assert.equal(lookupSettings.ncbiApiEnabled, true);
  // Existing service toggles provide control without a duplicate status row/button.
  assert.equal(await setupPage.locator('#externalChecksControls, #disableExternalChecks').count(), 0);
  await setupPage.getByRole('button',{name:'Open quick settings'}).click();
  await setupPage.locator('#integrityLookupsEnabled').uncheck();
  await setupPage.locator('#ncbiApiEnabledPopup').uncheck();
  await setupPage.getByRole('button',{name:'Save quick settings',exact:true}).click();
  await setupPage.locator('#status').filter({hasText:'Settings saved.'}).waitFor();
  const disabledLookups = await worker.evaluate(() => chrome.storage.sync.get(['integrityLookupsEnabled','ncbiApiEnabled']));
  assert.equal(disabledLookups.integrityLookupsEnabled, false);
  assert.equal(disabledLookups.ncbiApiEnabled, false);
  await setupPage.reload();
  await setupPage.waitForSelector('.quick-profile', {state:'attached'});
  assert.equal(await setupPage.locator('#lookupSetup').isVisible(), false);
  await setupPage.close();
  const options = await browser.newPage();
  options.on('pageerror', error => errors.push(error.message));
  await options.goto(`chrome-extension://${id}/options.html`);
  await options.waitForSelector('.profile-row');
  assert.equal(await options.locator('.profile-row').count(), 2);
  assert.equal(await options.getByRole('checkbox', {name: 'Enable MDPI',exact:true}).isChecked(), true);
  assert.equal(await options.getByRole('checkbox', {name: 'Enable Elsevier',exact:true}).count(), 0);
  assert.equal(await options.locator('#publisherPreset, #concernPreset').count(), 0);
  assert.equal(await options.locator('[aria-label="MDPI color"]').inputValue(), '#b45309');
  assert.equal(await options.locator('[aria-label="Frontiers color"]').inputValue(), '#7c3aed');
  await options.keyboard.press('Tab');
  assert.equal(await options.evaluate(() => document.activeElement.textContent), 'Why MDPI is included');
  const focus = await options.evaluate(() => {const s=getComputedStyle(document.activeElement);return [s.outlineStyle,s.outlineWidth]});
  assert.deepEqual(focus,['solid','3px']);
  const summary = options.locator('.profile-rationale summary').first();
  await summary.focus(); await options.keyboard.press('Enter');
  assert.equal(await options.locator('.profile-rationale').first().getAttribute('open'), '');
  await options.setViewportSize({width:320,height:800});
  assert.equal(await options.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await options.screenshot({path:path.join(output, 'options.png'),fullPage:true});
  await options.setViewportSize({width:1100,height:900});
  const additionalWarnings = options.getByRole('checkbox', {name:'Additional publisher and journal warnings',exact:true});
  assert.equal(await additionalWarnings.isChecked(),false);
  const sourceLink = options.locator('.publisher-warning-sources a').first();
  const sourceUrl = await sourceLink.getAttribute('href');
  // Exercise native source-link navigation without calling the external site.
  await browser.route(sourceUrl, route => route.fulfill({contentType:'text/html',body:'<!doctype html><title>Source-link navigation fixture</title>'}));
  await sourceLink.focus();
  const [sourcePage] = await Promise.all([browser.waitForEvent('page'), options.keyboard.press('Enter')]);
  await sourcePage.waitForLoadState('domcontentloaded');
  assert.equal(sourcePage.url(),sourceUrl);
  assert.equal(await additionalWarnings.isChecked(),false,'opening a source link must not enable warnings');
  await sourcePage.close();
  await browser.unroute(sourceUrl);
  await options.getByRole('combobox', {name:'MDPI action', exact:true}).selectOption('badge');
  await options.getByRole('button', {name:'Save all settings'}).click();
  await options.getByRole('status').filter({hasText:'Settings saved.'}).waitFor();
  await options.reload();
  await options.waitForSelector('.profile-row');
  assert.equal(await options.getByRole('combobox', {name:'MDPI action', exact:true}).inputValue(), 'badge');
  await options.getByRole('combobox', {name:'MDPI action', exact:true}).selectOption('highlight');
  await options.getByRole('button', {name:'Save all settings'}).click();
  await options.getByRole('status').filter({hasText:'Settings saved.'}).waitFor();
  await options.getByRole('textbox', {name:'Name', exact:true}).fill('Manual example');
  await options.getByRole('textbox', {name:'Domains', exact:true}).fill('example.org');
  await options.getByRole('button', {name:'Add publisher', exact:true}).click();
  assert.equal(await options.getByRole('checkbox', {name:'Enable Manual example', exact:true}).isChecked(), true);
  assert.equal(await options.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Enable Manual example');
  await options.getByRole('button', {name:'Save all settings'}).click();
  await options.getByRole('status').filter({hasText:'Settings saved.'}).waitFor();
  await options.reload();
  await options.waitForSelector('[data-profile-id="manual-example"]');
  assert.equal(await options.getByRole('combobox', {name:'Manual example action', exact:true}).inputValue(), 'highlight');
  await options.getByRole('button', {name:'Export', exact:true}).click();
  const exportedProfiles = await options.getByRole('textbox', {name:'Publisher profile JSON', exact:true}).inputValue();
  assert.equal(JSON.parse(exportedProfiles).profiles.find(profile => profile.id === 'manual-example').domains[0], 'example.org');
  await options.getByRole('button', {name:'Remove Manual example', exact:true}).click();
  await options.getByRole('button', {name:'Save all settings'}).click();
  await options.getByRole('status').filter({hasText:'Settings saved.'}).waitFor();
  await options.getByRole('textbox', {name:'Publisher profile JSON', exact:true}).fill(exportedProfiles);
  await options.getByRole('button', {name:'Import', exact:true}).click();
  await options.getByRole('button', {name:'Save all settings'}).click();
  await options.getByRole('status').filter({hasText:'Settings saved.'}).waitFor();
  await options.reload();
  await options.waitForSelector('[data-profile-id="manual-example"]');
  await options.locator('#loggingEnabledOptions').check();
  await options.getByRole('button', {name:'Save all settings'}).click();
  await options.getByRole('status').filter({hasText:'Settings saved.'}).waitFor();
  await options.reload();
  await options.waitForSelector('.profile-row');
  assert.equal(await options.locator('#loggingEnabledOptions').isChecked(), true);
  await options.locator('#loggingEnabledOptions').uncheck();
  await options.getByRole('button', {name:'Reset defaults', exact:true}).click();
  assert.equal(await options.locator('.profile-row').count(), 2);
  await options.getByRole('button', {name:'Save all settings'}).click();
  await options.getByRole('status').filter({hasText:'Settings saved.'}).waitFor();
  await options.locator('#communityWarningsEnabledOptions').check();
  await options.getByRole('button', {name:'Save all settings'}).click();
  await options.getByRole('status').filter({hasText:'Settings saved.'}).waitFor();
  await options.reload();
  await options.waitForSelector('.profile-row');
  assert.equal(await options.locator('#communityWarningsEnabledOptions').isChecked(), true);
  assert.equal(await options.locator('.profile-row').count(), 2);
  await options.getByRole('button', {name:'Export', exact:true}).click();
  assert.equal(JSON.parse(await options.locator('#profileJson').inputValue()).communityWarningsEnabled, true);
  const fixtureUrl = 'https://example.org/notandia-community-fixture';
  const fixture = await browser.newPage();
  fixture.on('pageerror', error => errors.push(error.message));
  await fixture.route(fixtureUrl, route => route.fulfill({contentType:'text/html', body:`<!doctype html><html><head><meta name="citation_doi" content="10.1002/notandia-synthetic"></head><body><h1>Synthetic reference checks</h1><ol>
    <li id="ref-1"><a href="https://doi.org/10.20944/preprints202407.1143.v1">Preprint example</a></li>
    <li id="ref-2"><a href="https://doi.org/10.4175/notandia-synthetic">Frontiers example</a></li>
    <li id="ref-3"><a href="https://www.omicsonline.org/notandia-synthetic">OMICS example</a></li>
    <li id="ref-4"><a href="https://benthamopenarchives.com/notandia-synthetic">Bentham Open example</a></li>
    <li id="ref-5"><a href="https://doi.org/10.1002/notandia-synthetic-reference">Other publisher</a></li>
    <li id="ref-6"><a href="https://academicjournals.org/article/123">Academic Journals example</a></li>
    <li id="ref-7"><a href="https://www.dovepress.com/core-evidence-journal/article/123">Listed journal example</a></li>
    <li id="ref-8"><a href="https://www.dovepress.com/another-journal/article/123">Unlisted journal on the same host</a></li>
    <li id="ref-9"><a href="https://doi.org/10.5897/notandia-synthetic">DOI-only CiteWatch example</a></li>
    <li id="ref-10">Example article. <span class="journal-title">Alternative Medicine Review</span></li>
    <li id="ref-11">Example article. <span class="journal-title">Journal of Management</span></li>
    <li id="ref-12"><a href="https://doi.org/10.2174/notandia-synthetic">Shared Bentham Science prefix</a></li>
    </ol></body></html>`}));
  await fixture.goto(fixtureUrl);
  await fixture.locator('#ref-1 .notandia-publisher-badge').waitFor();
  assert.equal(await fixture.locator('#ref-1 .notandia-publisher-badge').textContent(), 'MDPI · Preprint');
  assert.equal(await fixture.locator('#ref-2 .notandia-publisher-badge').textContent(), 'Frontiers');
  assert.equal(await fixture.locator('#ref-3 .notandia-publisher-badge').textContent(), 'OMICS');
  assert.equal(await fixture.locator('#ref-4 .notandia-publisher-badge').textContent(), 'Bentham Open');
  assert.equal(await fixture.locator('#ref-5 .notandia-publisher-badge').count(), 0);
  assert.equal(await fixture.locator('#ref-6 .notandia-publisher-badge').textContent(),'academicjournals.org');
  assert.equal(await fixture.locator('#ref-7 .notandia-publisher-badge').textContent(),'dovepress.com/core-evidence-journal');
  assert.equal(await fixture.locator('#ref-8 .notandia-publisher-badge').count(),0);
  assert.equal(await fixture.locator('#ref-9 .notandia-publisher-badge').textContent(),'Academic Journals');
  assert.equal(await fixture.locator('#ref-10 .notandia-publisher-badge').textContent(),'Alternative Medicine Review');
  assert.equal(await fixture.locator('#ref-11 .notandia-publisher-badge').count(),0);
  assert.equal(await fixture.locator('#ref-12 .notandia-publisher-badge').count(),0);
  const popup = await browser.newPage(); popup.on('pageerror', error=>errors.push(error.message));
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.getByRole('button',{name:'Open quick settings'}).click();
  await popup.waitForSelector('.quick-profile');
  assert.equal(await popup.locator('.quick-profile').count(),2);
  assert.equal(await popup.getByRole('combobox',{name:'Frontiers action',exact:true}).count(),1);
  assert.equal(await popup.locator('[aria-label="Frontiers color"]').count(),1);
  assert.equal(await popup.locator('#communityWarningsEnabledPopup').isChecked(),true);
  await popup.getByRole('button',{name:'Back to results'}).click();
  await worker.evaluate(async url => {
    const tabs = await chrome.tabs.query({});
    await chrome.tabs.update(tabs.find(tab => tab.url === url).id, {active:true});
  }, fixtureUrl);
  await popup.evaluate(() => document.getElementById('rescan').click());
  await popup.locator('[data-context-filter="profile:omics"] strong').waitFor();
  assert.equal(await popup.locator('[data-context-filter="profile:omics"] strong').textContent(),'1');
  assert.match(await popup.locator('#contextOverviewSummary').textContent(),/8 of 12 scanned references/);
  await popup.locator('#contextScanState').waitFor({state:'hidden'});
  await popup.getByText('About this preprint', {exact:true}).waitFor();
  assert.equal(await popup.locator('.context-item .chip').filter({hasText:/^Preprint$/}).count(),1);
  assert.equal(await popup.getByText('About this preprint', {exact:true}).count(),1);
  assert.equal(await popup.getByText('Why academicjournals.org is listed', {exact:true}).count(),1);
  assert.equal(await popup.getByText('Cite Unseen: predatory publishers (2026-03-30)', {exact:true}).count(),1);
  assert.equal(await popup.getByText('Why Academic Journals is listed', {exact:true}).count(),1);
  assert.equal(await popup.getByText('Beall’s original publisher list', {exact:true}).count(),1);
  assert.equal(await popup.getByText('Why Alternative Medicine Review is listed', {exact:true}).count(),1);
  await popup.locator('#contextScanState').waitFor({state:'hidden'});
  // Chrome action popups use the document's natural 480px width. Test that
  // width here; the full Settings page and content demo are checked at 320px.
  await popup.setViewportSize({width:480,height:900});
  assert.equal(await popup.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await popup.screenshot({path:path.join(output,'community-popup.png'),fullPage:true});
  await popup.getByRole('button',{name:'Open quick settings'}).click();
  await popup.locator('#communityWarningsEnabledPopup').uncheck();
  await popup.evaluate(() => document.getElementById('save').click());
  await popup.locator('#status').filter({hasText:'Settings saved.'}).waitFor();
  await fixture.locator('#ref-3 .notandia-publisher-badge').waitFor({state:'detached'});
  await fixture.locator('#ref-6 .notandia-publisher-badge').waitFor({state:'detached'});
  await fixture.locator('#ref-7 .notandia-publisher-badge').waitFor({state:'detached'});
  await fixture.locator('#ref-9 .notandia-publisher-badge').waitFor({state:'detached'});
  await fixture.locator('#ref-10 .notandia-publisher-badge').waitFor({state:'detached'});
  await popup.locator('[data-context-filter="profile:omics"]').waitFor({state:'detached'});
  assert.equal(await fixture.locator('#ref-1 .notandia-publisher-badge').textContent(),'MDPI · Preprint');
  await popup.setViewportSize({width:1100,height:900});
  assert.equal(await popup.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
  await popup.screenshot({path:path.join(output, 'popup.png'),fullPage:true});
  const demo=await browser.newPage(); demo.on('pageerror', error=>errors.push(error.message));
  const external=[]; demo.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
  await demo.goto(`file://${root}/docs/presentation-demo.html`);
  await demo.locator('#demo-mdpi .notandia-publisher-badge').waitFor();
  await demo.locator('#demo-elsevier .notandia-integrity-chip').waitFor();
  assert.equal(await demo.locator('#demo-elsevier .notandia-publisher-badge').count(),0);
  assert.match(await demo.locator('#demo-elsevier .notandia-integrity-chip').textContent(),/Retracted/);
  assert.match(await demo.locator('#demo-wiley .notandia-integrity-chip').textContent(),/Corrected/);
  await demo.getByRole('button',{name:'Identify Elsevier and Wiley too'}).click();
  await demo.locator('#demo-elsevier .notandia-publisher-badge').waitFor();
  assert.equal(await demo.locator('#demo-elsevier .notandia-publisher-badge').textContent(),'Elsevier');
  await demo.getByRole('button',{name:'Identify Elsevier and Wiley too'}).click();
  await demo.locator('#demo-elsevier .notandia-publisher-badge').waitFor({state:'detached'});
  assert.equal(await demo.locator('#demo-elsevier .notandia-integrity-chip').count(),1);
  const ratios=[];
  for(const dark of [false,true]) {
   if(dark) await demo.getByRole('button',{name:'Dark background'}).click();
   for(const selector of ['#demo-mdpi .notandia-publisher-badge','#demo-frontiers .notandia-publisher-badge','a[href="#demo-mdpi"]','a[href="#demo-frontiers"]','a[href="#demo-elsevier"]','a[href="#demo-wiley"]']){
    const ratio=await demo.locator(selector).evaluate(element=>{
     const s=getComputedStyle(element);const rgb=c=>c.match(/[\d.]+/g).slice(0,3).map(Number);const luminance=c=>rgb(c).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((t,v,i)=>t+v*[.2126,.7152,.0722][i],0);const values=[luminance(s.color),luminance(s.backgroundColor)].sort((a,b)=>b-a);return(values[0]+.05)/(values[1]+.05);
    });assert.ok(ratio>=4.5,`${selector}, dark=${dark}: ${ratio}`);ratios.push({selector,dark,ratio});
   }
   await demo.setViewportSize({width:320,height:800});
   assert.equal(await demo.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await demo.setViewportSize({width:1100,height:900});
  }
  await demo.screenshot({path:path.join(output, 'demo.png'),fullPage:true});
  await demo.emulateMedia({forcedColors:'active'});
  assert.equal(await demo.locator('#demo-mdpi .notandia-publisher-badge').textContent(),'MDPI');
  assert.equal(await demo.locator('#demo-frontiers .notandia-publisher-badge').textContent(),'Frontiers');
  assert.equal(external.length,0);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output, 'results.json'),JSON.stringify({options:'real Chrome extension',keyboard:true,narrowReflow:true,persistence:true,popup:true,demo:'real content renderers with local synthetic fixtures',externalRequests:external,errors,ratios},null,2));
  console.log(`Artifacts: ${output}`);
  console.log('PASS: real extension settings/popup, community opt-in and disable, citation counts and preprint labels, keyboard focus, saved publisher settings, 320px reflow, light/dark rendered contrast, forced-color labels, notice independence, zero demo network requests');
 } finally { await browser.close(); fs.rmSync(path.join(output, 'browser-profile'), {recursive:true, force:true}); }
})().catch(error=>{console.error(error);process.exitCode=1});
