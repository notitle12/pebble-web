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
test('Backspace and Delete remove only a selected mosaic, stay inside the dialog, and leave text inputs alone',()=>{
 class KeyTarget extends EventTarget{isContentEditable=false;selector='';closest(value){return value.split(',').includes(this.selector)?this:null;}}
 const target=new KeyTarget();let deleted=0,post=0,blocked=false,selected=true;
 installImageHistoryKeys(target,()=>({undo:()=>{},redo:()=>{},deleteSelected:()=>deleted++,blocked:blocked||!selected}));
 target.addEventListener('keydown',()=>post++);
 const send=(values={})=>{const event=key({key:'Delete',ctrlKey:false,...values});target.dispatchEvent(event);return event;};
 assert.equal(send().defaultPrevented,true);assert.equal(deleted,1);assert.equal(post,0);
 selected=false;send({key:'Backspace'});assert.equal(deleted,1);assert.equal(post,0);
 selected=true;blocked=true;send();assert.equal(deleted,1);assert.equal(post,0);
 blocked=false;target.selector='input:not([type="range"])';const inputEvent=send();assert.equal(inputEvent.defaultPrevented,false);assert.equal(deleted,1);assert.equal(post,1);
 target.selector='textarea';const textareaEvent=send();assert.equal(textareaEvent.defaultPrevented,false);assert.equal(deleted,1);assert.equal(post,2);
 target.selector='[data-image-text-control]';const textInputEvent=send();assert.equal(textInputEvent.defaultPrevented,false);assert.equal(deleted,1);assert.equal(post,3);
 target.selector='';target.isContentEditable=true;const contentEvent=send();assert.equal(contentEvent.defaultPrevented,false);assert.equal(deleted,1);assert.equal(post,4);
});

test('mosaic Delete works from its size slider while composition never deletes the selected area',()=>{
 class Slider extends EventTarget{closest(){return null;}}
 const target=new Slider();let count=0,post=0;
 installImageHistoryKeys(target,()=>({undo:()=>{},redo:()=>{},deleteSelected:()=>count++,blocked:false}));target.addEventListener('keydown',()=>post++);
 const composing=key({key:'Backspace',ctrlKey:false,isComposing:true});target.dispatchEvent(composing);assert.equal(count,0);assert.equal(post,0);assert.equal(composing.defaultPrevented,false);
 const del=key({key:'Delete',ctrlKey:false});target.dispatchEvent(del);assert.equal(count,1);assert.equal(post,0);assert.equal(del.defaultPrevented,true);
});
