import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutosaveQueue} from '../src/lib/autosave-queue.ts';

test('rapid edits save the latest snapshot once; continuous typing checkpoints within maxWait',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});
 const writes=[],states=[];const queue=createAutosaveQueue({write:async value=>{writes.push(value);},clear:async()=>{},onState:state=>states.push(state.phase),delay:1000,maxWait:5000});
 queue.schedule('first');t.mock.timers.tick(500);queue.schedule('latest');t.mock.timers.tick(1000);await queue.flush();
 assert.deepEqual(writes,['latest']);assert.equal(states.at(-1),'saved');
 for(let index=0;index<5;index++){queue.schedule(index);t.mock.timers.tick(900);}
 t.mock.timers.tick(500);await queue.flush();assert.equal(writes.at(-1),4);queue.stop();
});
test('failed commits are reported and can retry the same complete snapshot',async()=>{
 const states=[];let fail=true,saved;
 const queue=createAutosaveQueue({write:async value=>{if(fail)throw Error('quota');saved=value;},clear:async()=>{},onState:state=>states.push(state)});
 queue.schedule({text:'keep me',files:['image']});await assert.rejects(queue.flush(),/quota/);assert.equal(states.at(-1).phase,'error');
 fail=false;await queue.flush();assert.deepEqual(saved,{text:'keep me',files:['image']});assert.equal(states.at(-1).phase,'saved');queue.stop();
});
test('publishing invalidates waiting writes and removes in-flight data before returning',async()=>{
 let release,saved,started;const calls=[];const gate=new Promise(resolve=>{release=resolve;});const running=new Promise(resolve=>{started=resolve;});
 const queue=createAutosaveQueue({write:async value=>{calls.push(value);if(value==='old'){started();await gate;}saved=value;},clear:async()=>{saved=undefined;},onState:()=>{}});
 queue.schedule('old');const writing=queue.flush();await running;
 queue.schedule('obsolete');const waiting=queue.flush();const clearing=queue.clear();release();await Promise.all([writing,waiting,clearing]);
 assert.deepEqual(calls,['old']);assert.equal(saved,undefined);
 queue.schedule('new session edit');await queue.flush();assert.equal(saved,'new session edit');queue.stop();
});
