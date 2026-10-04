'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function background({ enabled = true, permitted = true } = {}) {
  let changed;
  let fetches = 0;
  const context = {
    NotandiaPublisherProfiles: require('../shared/publisher_profiles.js'),
    MDPIIntegrity: require('../shared/integrity.js'),
    URL, AbortController, DOMException, setTimeout, clearTimeout,
    browser: { permissions: { getAll: async () => ({data_collection:permitted ? ['websiteContent'] : []}) } },
    fetch: async () => { fetches++; return {status:200,ok:true,headers:{get:()=> 'application/json'},json:async()=>({message:{}})}; },
    chrome: {
      runtime: {
        getManifest: () => ({browser_specific_settings:{gecko:{data_collection_permissions:{optional:['websiteContent']}}}}),
        onMessage:{addListener(){}}, onInstalled:{addListener(){}}, onStartup:{addListener(){}}, sendMessage:(_,cb)=>cb?.()
      },
      storage: {
        sync:{ get:(defaults,cb)=>cb({...defaults,integrityLookupsEnabled:enabled}), set(){} },
        onChanged:{addListener:fn=>{changed=fn;}}
      },
      tabs:{onUpdated:{addListener(){}},onRemoved:{addListener(){}}}
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../background.js'),'utf8'),context);
  return {context,changed,fetches:()=>fetches};
}

test('Crossref checks the saved setting and Firefox permission at the transmission boundary', async () => {
  for (const [enabled,permitted] of [[false,true],[true,false],[true,true]]) {
    const b = background({enabled,permitted});
    const request = b.context.fetchCrossrefJson('https://api.crossref.org/works/10.1234/example',new AbortController());
    if (enabled && permitted) await request;
    else await assert.rejects(request,{name:'AbortError'});
    assert.equal(b.fetches(),enabled && permitted ? 1 : 0);
  }
});

test('turning off integrity checks immediately aborts active requests', () => {
  const b = background();
  b.context.testController = new AbortController();
  vm.runInContext('activeIntegrityScans.set(1,{cancelled:false,controllers:new Set([testController])})',b.context);
  b.changed({integrityLookupsEnabled:{newValue:false}},'sync');
  assert.equal(b.context.testController.signal.aborted,true);
  assert.equal(vm.runInContext('activeIntegrityScans.size',b.context),0);
});
