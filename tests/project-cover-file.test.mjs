import test from 'node:test';
import assert from 'node:assert/strict';
import {projectCoverFile} from '../src/features/project/project-cover-file.ts';
test('cover downloads reject errors, invalid MIME and empty files before selection',async()=>{
 for(const response of [new Response('missing',{status:404}),new Response('html',{headers:{'Content-Type':'text/html'}}),new Response('',{headers:{'Content-Type':'image/png'}})])await assert.rejects(projectCoverFile('https://images.example.com/a',async()=>response));
 await assert.rejects(projectCoverFile('javascript:alert(1)',async()=>{throw Error('must not fetch');}));
});
test('valid cover keeps actual MIME and omits credentials',async()=>{
 const file=await projectCoverFile('https://images.example.com/a',async(url,options)=>{assert.equal(options.credentials,'omit');return new Response('png',{headers:{'Content-Type':'image/png'}});});
 assert.equal(file.type,'image/png');assert.equal(file.size,3);
});
