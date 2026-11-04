import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSavedPostDrafts} from '../src/features/post/saved-post-drafts.ts';
const post={id:'1',urlKey:'entry-1',title:'직접 저장',summary:null,author:{id:'100',handle:'owner-test',nickname:'작성자',blogName:null},tags:[],publishedAt:null,createdAt:'2026-10-14T00:00:00Z',visibilityStatus:'HIDDEN',isBlocked:false,displayOrder:7,draft:true};
const page=rows=>({data:{content:rows,page:0,size:20,totalElements:rows.length,totalPages:rows.length?1:0,hasNext:false,hasPrevious:false}});
test('manual picker lists only explicit draft posts from the signed-in owner',async()=>{
 let requestPath='';const result=await fetchSavedPostDrafts(async path=>{requestPath=path;return page([post,{...post,id:'2',draft:false}]);},'100');
 assert.equal(result.records.length,1);assert.equal(result.records[0].id,'1');assert.match(requestPath,/visibilityStatus=HIDDEN/);assert.match(requestPath,/createdAt,desc/);
 await assert.rejects(fetchSavedPostDrafts(async()=>page([{...post,author:{...post.author,id:'101'}}]),'100'));
});
