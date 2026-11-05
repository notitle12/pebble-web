import test from 'node:test';
import assert from 'node:assert/strict';
import {autoImageTextBox,fitImageTextBox,resizeImageTextBox} from '../src/features/post/image-text-box.ts';

const measure=line=>Array.from(line).length*10;

test('typing into a manually sized box keeps its width and grows enough for every line',()=>{
 const text='처음 글씨\n둘째 줄\n셋째 줄';
 assert.deepEqual(fitImageTextBox(text,{x:10,y:10,width:92,height:22},{width:300,height:200},16,measure,false),{x:10,y:10,width:92,height:62});
});

test('narrowing text reflows all lines and moves the box above the bottom edge',()=>{
 const text='가나다라마바사아자차';
 assert.deepEqual(fitImageTextBox(text,{x:10,y:90,width:32,height:22},{width:200,height:100},16,measure,false),{x:10,y:18,width:32,height:82});
});

test('auto-growing text near the bottom preserves its complete height instead of clipping earlier lines',()=>{
 assert.deepEqual(fitImageTextBox('첫줄\n둘째\n셋째',{x:20,y:90,width:32,height:22},{width:200,height:100},16,measure,true),{x:20,y:38,width:32,height:62});
});

test('auto text preserves its width but discards a stale soft-wrapped height during typing',()=>{
 const size={width:300,height:200};
 const first=fitImageTextBox('가나',{x:10,y:10,width:80,height:43},size,16,measure,true);
 const composing=fitImageTextBox('가ㄴ',first,size,16,measure,true);
 const complete=fitImageTextBox('가나',composing,size,16,measure,true);
 assert.deepEqual(first,{x:10,y:10,width:80,height:22});
 assert.deepEqual(composing,first);
 assert.deepEqual(complete,first);
});

test('auto text reserves caret space and only grows while more text is entered',()=>{
 let rect={x:10,y:10,width:32,height:22};
 for(const text of ['가나다','가나다라','가나다라마']){
  const next=fitImageTextBox(text,rect,{width:300,height:200},16,measure,true);
  assert.ok(next.width>=measure(text)+8);
  assert.ok(next.width>=rect.width);
  assert.equal(next.height,22);
  rect=next;
 }
});

test('auto text box starts clickable when empty and grows for Korean and multiline text',()=>{
 assert.deepEqual(autoImageTextBox('',10,10,{width:300,height:200},16,measure),{width:32,height:22});
 assert.deepEqual(autoImageTextBox('가나다\n라마',10,10,{width:300,height:200},16,measure),{width:38,height:42});
});

test('auto text box wraps naturally when the remaining image width is limited',()=>{
 assert.deepEqual(autoImageTextBox('가나다라마바사',75,0,{width:100,height:120},16,measure),{width:25,height:82});
 assert.deepEqual(autoImageTextBox('긴 문장',10,0,{width:20,height:15},16,measure),{width:10,height:15});
});

test('all resize handles keep the opposite edges anchored and clamp to the image',()=>{
 const rect={x:20,y:20,width:40,height:30},size={width:100,height:100};
 assert.deepEqual(resizeImageTextBox(rect,'e',10,0,size,16),{x:20,y:20,width:50,height:30});
 assert.deepEqual(resizeImageTextBox(rect,'w',10,0,size,16),{x:30,y:20,width:30,height:30});
 assert.deepEqual(resizeImageTextBox(rect,'s',0,10,size,16),{x:20,y:20,width:40,height:40});
 assert.deepEqual(resizeImageTextBox(rect,'n',0,10,size,16),{x:20,y:30,width:40,height:20});
 assert.deepEqual(resizeImageTextBox(rect,'se',10,10,size,16),{x:20,y:20,width:50,height:40});
 assert.deepEqual(resizeImageTextBox(rect,'nw',10,10,size,16),{x:30,y:30,width:30,height:20});
 assert.deepEqual(resizeImageTextBox(rect,'ne',10,10,size,16),{x:20,y:30,width:50,height:20});
 assert.deepEqual(resizeImageTextBox(rect,'sw',10,10,size,16),{x:30,y:20,width:30,height:40});
 assert.deepEqual(resizeImageTextBox(rect,'move',500,-500,size,16),{x:60,y:0,width:40,height:30});
});

test('resize respects minimum dimensions, small canvases and non-finite input',()=>{
 assert.deepEqual(resizeImageTextBox({x:20,y:20,width:40,height:30},'nw',100,100,{width:100,height:100},16),{x:44,y:30,width:16,height:20});
 assert.deepEqual(resizeImageTextBox({x:0,y:0,width:2,height:2},'se',-20,-20,{width:8,height:10},20),{x:0,y:0,width:8,height:10});
 const rect={x:2,y:3,width:10,height:12};
 assert.equal(resizeImageTextBox(rect,'se',Number.NaN,0,{width:100,height:100},16),rect);
 assert.deepEqual(autoImageTextBox('x',0,0,{width:100,height:100},16,()=>Number.NaN),{width:32,height:22});
});
