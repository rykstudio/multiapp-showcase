'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
const database=fs.readFileSync(path.join(__dirname,'../src/settings-db.js'),'utf8');

function reorderHarness(){
  const start=renderer.indexOf('function reorderLogins(');
  const end=renderer.indexOf('function summaryAction(',start);
  assert.ok(start>=0&&end>start);
  let renders=0;
  const context={draft:{},renderSettings(){renders++;},toast(){}};
  const reorder=vm.runInNewContext('let draggingLogin=null;\n'+renderer.slice(start,end)+'\nreorderLogins',context);
  return {reorder,renders:()=>renders};
}

test('drag reorder preserves IDs and login details',()=>{
  const app={id:'app-one',logins:[
    {id:'first',username:'a@example.test',password:'a'},
    {id:'second',username:'b@example.test',password:'b'},
    {id:'third',username:'c@example.test',password:'c'}
  ]};
  const {reorder,renders}=reorderHarness();
  reorder(app,'third','first');
  assert.deepEqual(app.logins.map(l=>l.id),['third','first','second']);
  assert.equal(app.logins[0].username,'c@example.test');
  reorder(app,'third','second');
  assert.deepEqual(app.logins.map(l=>l.id),['first','second','third']);
  assert.equal(renders(),2);
});

test('invalid drop targets leave the list untouched',()=>{
  const app={id:'app-one',logins:[{id:'a'},{id:'b'}]};
  const {reorder,renders}=reorderHarness();
  reorder(app,'a','a');
  reorder(app,'missing','a');
  reorder(app,'a','missing');
  assert.deepEqual(app.logins.map(l=>l.id),['a','b']);
  assert.equal(renders(),0);
});

test('demo-login headers have drag handles and up/down buttons',()=>{
  const start=renderer.indexOf('app.logins.forEach((login,j)=>{');
  const end=renderer.indexOf('content.append(loginList);',start);
  assert.ok(start>=0&&end>start);
  const part=renderer.slice(start,end);
  for(const token of [
    'loginGrip.draggable=true',
    'loginGrip.ondragstart=',
    'box.ondragover=',
    'box.ondrop=',
    'draggingLogin?.appId!==app.id',
    'reorderLogins(app,draggingLogin.loginId,login.id)',
    "summaryAction('↑'",
    "summaryAction('↓'",
    'upLogin.disabled=j===0',
    'downLogin.disabled=j===app.logins.length-1',
    "class:'summaryActions'},[upLogin,downLogin]"
  ])assert.ok(part.includes(token),'Missing '+token);
  assert.ok(html.includes('.loginEditor.dragTarget'));
});

test('SQLite saves demo-login positions and drawer uses stored order',()=>{
  assert.ok(database.includes('demo_logins ORDER BY app_id,position,id'));
  assert.ok(database.includes('a.logins.forEach((l,j)=>logins.run'));
  assert.ok(renderer.includes('for(const login of demoEntries)'));
});
