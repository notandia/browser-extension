'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const test=require('node:test');const text=fs.readFileSync(path.resolve(__dirname,'..','docs/pr-scope-google-special-modules.md'),'utf8');test('branch scope remains focused',()=>assert.match(text,/No additional product features belong in this branch/));
