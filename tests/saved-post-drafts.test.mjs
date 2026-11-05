import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSavedPostDrafts,mergeSavedPostChoices,savedPostDraftCount} from '../src/features/post/saved-post-drafts.ts';
const post={id:'1',urlKey:'entry-1',title:'직접 저장',summary:null,author:{id:'100',handle:'owner-test',nickname:'작성자',blogName:null},tags:[],publishedAt:null,createdAt:'2026-10-14T00:00:00Z',visibilityStatus:'HIDDEN',isBlocked:false,displayOrder:7,draft:true};
const page=rows=>({data:{content:rows,page:0,size:20,totalElements:rows.length,totalPages:rows.length?1:0,hasNext:false,hasPrevious:false}});
test('manual picker lists only explicit draft posts from the signed-in owner',async()=>{
 let requestPath='';const result=await fetchSavedPostDrafts(async path=>{requestPath=path;return page([post]);},'100');
 assert.equal(result.records.length,1);assert.equal(result.records[0].id,'1');assert.equal(result.total,1);assert.match(requestPath,/visibilityStatus=HIDDEN/);assert.match(requestPath,/draft=true/);assert.match(requestPath,/createdAt,desc/);
 await assert.rejects(fetchSavedPostDrafts(async()=>page([{...post,author:{...post.author,id:'101'}}]),'100'));
 await assert.rejects(fetchSavedPostDrafts(async()=>page([{...post,draft:false}]),'100'));
});

test('saved count uses the filtered server total across pages, including an empty library',async()=>{
 const rows=Array.from({length:20},(_,index)=>({...post,id:String(index+1)}));
 const result=await fetchSavedPostDrafts(async()=>({data:{content:rows,page:0,size:20,totalElements:43,totalPages:3,hasNext:true,hasPrevious:false}}),'100');
 assert.equal(result.records.length,20);assert.equal(result.total,43);assert.equal(result.hasNext,true);
 const local=[{id:'90',title:'브라우저 수동 저장',savedAt:post.createdAt}];
 assert.equal(savedPostDraftCount(result.total,result.records,local),44);
 const empty=await fetchSavedPostDrafts(async()=>page([]),'100');
 assert.equal(savedPostDraftCount(empty.total,empty.records,[]),0);
});

test('saved choices merge by post, preserve the newest version and do not count duplicate local rows',()=>{
 const server={id:'1',title:'서버',savedAt:'2026-11-01T00:00:00Z'};
 const local={id:'1',title:'직접 저장 최신본',savedAt:'2026-11-02T00:00:00Z',local:{}};
 const another={id:'2',title:'다른 글',savedAt:'2026-11-03T00:00:00Z',local:{}};
 assert.deepEqual(mergeSavedPostChoices([server],[local,another]),[another,local]);
 assert.equal(savedPostDraftCount(1,[server],[local,another,another]),2);
});
