'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

function readPngDimensions(relativePath) {
  const file = fs.readFileSync(path.join(ROOT, relativePath));
  assert.equal(file.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${relativePath} is not a PNG`);
  assert.equal(file.subarray(12, 16).toString('ascii'), 'IHDR', `${relativePath} has no IHDR chunk`);
  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20)
  };
}

test('Notandia master symbol is a self-contained accessible SVG', () => {
  const source = fs.readFileSync(path.join(ROOT, 'docs', 'brand', 'notandia-symbol.svg'), 'utf8');
  assert.match(source, /viewBox="0 0 1024 1024"/);
  assert.match(source, /<title id="title">Notandia<\/title>/);
  assert.match(source, /#12263F/);
  assert.match(source, /#F8FAFC/);
  assert.match(source, /#FFC857/);
  assert.doesNotMatch(source, /<text\b/);
  assert.doesNotMatch(source, /https?:\/\//);
});

test('committed extension icons have the declared square dimensions', () => {
  for (const size of [16, 32, 48, 64, 96, 128, 256, 512]) {
    const relativePath = `icons/icon-${size}.png`;
    assert.deepEqual(readPngDimensions(relativePath), { width: size, height: size });
  }
});

test('store exports cover Chrome, Edge and high-resolution reuse', () => {
  for (const size of [128, 300, 512, 1024]) {
    const relativePath = `store/assets/notandia-icon-${size}.png`;
    assert.deepEqual(readPngDimensions(relativePath), { width: size, height: size });
  }
});

test('manifest references the optimized toolbar icons', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.icons, {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png'
  });
  assert.deepEqual(manifest.action.default_icon, {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png'
  });
});
