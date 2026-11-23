'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {group,groups}=require('../src/config-features');

const root=path.resolve(__dirname,'..');
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
const renderer=fs.readFileSync(path.join(root,'src/renderer.js'),'utf8');
const html=fs.readFileSync(path.join(root,'src/index.html'),'utf8');

test('application groups permit long Unicode names and more than forty groups',()=>{
  const names=Array.from({length:75},(_,i)=>'Long group '+i+' '+('客戶').repeat(60));
  assert.equal(group(names[0]),names[0]);
  assert.deepEqual(groups(names),names);
  assert.throws(()=>groups(['Shared','shared']),/Duplicate group/);
  assert.throws(()=>groups(['']),/cannot be empty/);
});

test('extended identifiers do not change existing session partition naming',()=>{
  assert.match(main,/function validStableId\(value\)/);
  assert.match(main,/function partitionForId\(id\)/);
  assert.match(main,/createHash\('sha256'\)/);
  assert.match(main,/\? id : '~' \+ createHash/);
  assert.match(main,/!validStableId\(raw\.id\)/);
  assert.match(main,/!validStableId\(login\.id\)/);
  assert.match(main,/!validStableId\(a\.id\)/);
  assert.match(main,/!validStableId\(l\.id\)/);
});

test('UI and backend remove previous hard limits on apps, groups, titles and descriptions',()=>{
  assert.doesNotMatch(main,/apps\.length\s*>\s*40|description\.length\s*>\s*1000|title\.length\s*>\s*100|description \|\| ''\)\.slice\(0, 1000\)/);
  assert.doesNotMatch(renderer,/Maximum 40 apps|Maximum 40 groups|maxLength:48|maxLength:64|maxLength:1000/);
  assert.doesNotMatch(html,/id="newGroupName"[^>]*maxlength|id="platformTitle"[^>]*maxlength/);
  assert.match(renderer,/function loginKey|const loginKey=/);
  assert.match(renderer,/JSON\.stringify\(\[appId,loginId\]\)/);
});
