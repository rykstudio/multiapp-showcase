'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');

test('settings have accessible expand-all and collapse-all actions',()=>{
  assert.match(html,/id="expandAllApps"/);
  assert.match(html,/id="collapseAllApps"/);
  assert.match(renderer,/\$\('expandAllApps'\)\.onclick/);
  assert.match(renderer,/\$\('collapseAllApps'\)\.onclick/);
});
test('application and login editors use native expandable details with summary',()=>{
  assert.match(renderer,/el\('details',\{class:'appEditor'\+\(app\.hidden/);
  assert.match(renderer,/el\('details',\{class:'loginEditor'\}\)/);
  assert.match(renderer,/el\('summary'/);
  assert.match(html,/\.appEditor>summary:focus-visible/);
});
test('collapsed application summaries show mode and demo login count',()=>{
  assert.match(renderer,/class:'summaryMeta'/);
  assert.match(renderer,/app\.displayMode==='mobile'/);
  assert.match(renderer,/function appMetaText\(app\)/);
  assert.match(renderer,/app\.logins\.length\+' '/);
});
test('expanded state is maintained by stable app and login IDs across render',()=>{
  assert.match(renderer,/const expandedAppIds=new Set\(\)/);
  assert.match(renderer,/const expandedLoginIds=new Set\(\)/);
  assert.match(renderer,/panel\.open=expandedAppIds\.has\(app\.id\)/);
  assert.match(renderer,/box\.open=expandedLoginIds\.has\(key\)/);
  assert.match(renderer,/expandedLoginIds\.add\(loginKey\(app\.id,login\.id\)\)/);
});
test('demo logins inside each website drawer can collapse independently',()=>{
  assert.match(renderer,/el\('details',\{class:'loginCard'\}\)/);
  assert.match(renderer,/expandedDrawerLoginIds/);
  assert.match(renderer,/card\.open=expandedDrawerLoginIds\.has\(key\)/);
  assert.match(renderer,/initializedDrawerApps/);
  assert.match(html,/\.loginCard\[open\]>summary:before/);
});
test('accordion UI does not persist expanded state in SQLite',()=>{
  const db=fs.readFileSync(path.join(__dirname,'../src/settings-db.js'),'utf8');
  assert.doesNotMatch(db,/expandedAppIds|expandedLoginIds/);
});
