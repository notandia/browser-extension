'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const workflowPath = path.join(root, '.github', 'workflows', 'publish-store.yml');
const chromePublisherPath = path.join(root, 'scripts', 'publish-chrome.js');

test('store publication rejects prerelease tags', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /Store publication requires a stable numeric tag/);
  assert.match(workflow, /\^v\[0-9\]\+\(\\\.\[0-9\]\+\)\{0,3\}\$/);
  assert.doesNotMatch(workflow, /\(-\[0-9A-Za-z\.\-\]\+\)\?/);
});

test('Chrome publication requires a verified CRX and isolated signing key', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const publisher = fs.readFileSync(chromePublisherPath, 'utf8');

  assert.match(workflow, /CHROME_CRX_PRIVATE_KEY_B64/);
  assert.match(workflow, /google-chrome --pack-extension=/);
  assert.doesNotMatch(workflow, /DERIVED_EXTENSION_ID/);
  assert.match(workflow, /CHROME_EXTENSION_ID: \$\{\{ secrets\.CHROME_EXTENSION_ID \}\}/);
  assert.match(workflow, /openssl pkey -in/);
  assert.match(workflow, /trap cleanup EXIT/);
  assert.match(publisher, /must be a signed \.crx file/);
  assert.match(publisher, /'X-Goog-Upload-Protocol': 'raw'/);
  assert.match(publisher, /'X-Goog-Upload-File-Name': path\.basename\(packagePath\)/);
  assert.match(publisher, /'Content-Type': 'application\/x-chrome-extension'/);
  assert.doesNotMatch(publisher, /'Content-Type': 'application\/zip'/);
});
