'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {canOpenEmbedded}=require('../src/popup-policy');
test('embedded popups permit auth HTTPS redirects and about blank but deny dangerous schemes',()=>{
  for(const url of ['https://login.example.com/authorize','https://accounts.example.org/callback?state=123','http://localhost:3000/login','about:blank'])
    assert.equal(canOpenEmbedded(url),true,url);
  for(const url of ['javascript:alert(1)','file:///etc/passwd','data:text/html,test','mailto:a@example.com','ftp://example.com','not a url'])
    assert.equal(canOpenEmbedded(url),false,url);
});
test('window.open adopts supplied webContents in an embedded BrowserView for opener support',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
  assert.match(src,/wc\.setWindowOpenHandler\(\(\{url\}\)/);
  assert.match(src,/createWindow:\(options\)=>\{/);
  assert.match(src,/const popup=new BrowserView\(options\)/);
  assert.match(src,/child!==options\.webContents/);
  assert.match(src,/win\.addBrowserView\(popup\)/);
  assert.match(src,/win\.removeBrowserView\(popup\)/);
  assert.doesNotMatch(src,/const popup=new WebContentsView/);
  assert.match(src,/return child;/);
  assert.doesNotMatch(src,/shell\.openExternal\(url\)/);
  assert.match(src,/child\.on\('destroyed'/);
  assert.match(src,/tab:close-popup/);
});
