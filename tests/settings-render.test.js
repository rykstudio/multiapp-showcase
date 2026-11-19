'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('imported demo-login description renders as textarea without assigning readonly type',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
  const fragment=source.slice(source.indexOf('function el('),source.indexOf('let toastTimer;'));
  const document={
    createElement(tag){
      const node={tagName:tag.toUpperCase(),children:[],append(child){this.children.push(child);}};
      if(tag==='textarea'){
        Object.defineProperty(node,'type',{get(){return 'textarea';},set(){throw new TypeError('Cannot set property type of HTMLTextAreaElement');}});
      }
      return node;
    }
  };
  const ctx=vm.createContext({document});
  const makeField=vm.runInContext(fragment+'\nfield',ctx);
  const area=makeField('Description','First demo login description',()=>{},{multiline:true,maxLength:1000});
  assert.equal(area.children[1].tagName,'TEXTAREA');
  assert.equal(area.children[1].value,'First demo login description');
  assert.equal(area.children[1].type,'textarea');
  assert.equal(area.children[1].rows,2);
  const password=makeField('Password','demo-secret',()=>{},{type:'password'});
  assert.equal(password.children[1].tagName,'INPUT');
  assert.equal(password.children[1].type,'password');
});
