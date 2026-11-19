'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {withSavedOrder,inSavedOrder,moveApp} = require('../src/app-order');

test('move up and down changes order without modifying IDs', () => {
  const apps = [{id:'one'},{id:'two'},{id:'three'}];
  assert.equal(moveApp(apps,2,-1),true);
  assert.deepEqual(apps.map(a=>a.id),['one','three','two']);
  assert.equal(moveApp(apps,0,1),true);
  assert.deepEqual(apps.map(a=>a.id),['three','one','two']);
});
test('new order round trips through serialized settings and survives restart',()=>{
  const apps=[{id:'first'},{id:'second'},{id:'third'}];
  moveApp(apps,2,-1);
  const disk=JSON.stringify({apps:withSavedOrder(apps)});
  const restored=inSavedOrder(JSON.parse(disk).apps);
  assert.deepEqual(restored.map(a=>a.id),['first','third','second']);
});
test('legacy config arrays retain original sequence',()=>{
  assert.deepEqual(inSavedOrder([{id:'z'},{id:'x'},{id:'y'}]).map(a=>a.id),['z','x','y']);
});
test('explicit persisted order is honored even if file array is shuffled',()=>{
  const raw=[{id:'z',order:2},{id:'x',order:0},{id:'y',order:1}];
  assert.deepEqual(inSavedOrder(raw).map(a=>a.id),['x','y','z']);
});
test('out of range move is ignored',()=>{
  const raw=[{id:'a'},{id:'b'}];
  assert.equal(moveApp(raw,0,-1),false);
  assert.equal(moveApp(raw,1,1),false);
  assert.deepEqual(raw.map(a=>a.id),['a','b']);
});
