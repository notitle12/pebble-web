import test from 'node:test';
import assert from 'node:assert/strict';
import {installImageHistoryKeys} from '../src/features/post/image-history-keys.ts';
const key=(values={})=>{const event=new Event('keydown',{cancelable:true,bubbles:true});for(const [name,value] of Object.entries({key:'z',code:'KeyZ',ctrlKey:true,metaKey:false,altKey:false,shiftKey:false,isComposing:false,...values}))Object.defineProperty(event,name,{value});return event;};
test('Ctrl/Cmd undo and shifted redo are captured before the underlying post editor',()=>{
 const target=new EventTarget();let undo=0,redo=0,post=0;
 const cleanup=installImageHistoryKeys(target,()=>({undo:()=>undo++,redo:()=>redo++,blocked:false}));
 target.addEventListener('keydown',()=>post++);
 for(const event of [key(),key({ctrlKey:false,metaKey:true}),key({shiftKey:true}),key({key:'Z',ctrlKey:false,metaKey:true,shiftKey:true})]){target.dispatchEvent(event);assert.equal(event.defaultPrevented,true);}
 assert.equal(undo,2);assert.equal(redo,2);assert.equal(post,0);
 cleanup();target.dispatchEvent(key());assert.equal(post,1);
});
test('saving, confirmation and IME states cannot leak undo to the post; ordinary keys are untouched',()=>{
 const target=new EventTarget();let calls=0,post=0;
 installImageHistoryKeys(target,()=>({undo:()=>calls++,redo:()=>calls++,blocked:true}));target.addEventListener('keydown',()=>post++);
 const blocked=key();target.dispatchEvent(blocked);assert.equal(blocked.defaultPrevented,true);assert.equal(calls,0);assert.equal(post,0);
 const composing=key({isComposing:true});target.dispatchEvent(composing);assert.equal(composing.defaultPrevented,false);assert.equal(post,0);
 target.dispatchEvent(key({ctrlKey:false}));target.dispatchEvent(key({altKey:true}));assert.equal(post,2);
});
