import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOwnPosts} from '../src/features/post/api/member-posts.ts';
const post={id:'1',urlKey:'entry-1',title:'비공개',summary:null,author:{id:'100',handle:'owner-test',nickname:'작성자',blogName:null},tags:[],publishedAt:null,createdAt:'2026-10-14T00:00:00Z',visibilityStatus:'HIDDEN',isBlocked:false,displayOrder:7,boardDisplayOrder:0,boardId:'20'};
const page=rows=>({data:{content:rows,page:0,size:20,totalElements:rows.length,totalPages:rows.length?1:0,hasNext:false,hasPrevious:false}});
test('게시판별 본인 목록은 숨김 글을 포함하고 게시판 소유·순서 정보를 검증한다',()=>{
 assert.equal(parseOwnPosts(page([post]),0,'100','20').content[0].displayOrder,7);
 assert.equal(parseOwnPosts(page([post]),0,'100','20').content[0].boardDisplayOrder,0);
 for(const wrong of [{...post,boardId:'21'},{...post,boardDisplayOrder:undefined},{...post,boardDisplayOrder:-1},{...post,author:{...post.author,id:'101'}}])assert.throws(()=>parseOwnPosts(page([wrong]),0,'100','20'));
});

import {richContentHtml} from '../src/features/post/rich-content.ts';
test('작성자 이미지 보기는 안정적인 저장 주소를 바꾸지 않고 안전한 임시 URL로 렌더링한다',()=>{
 const stable='https://api.pebble-log.com/api/v1/posts/1/images/2/content';
 const source=`<img src="${stable}">`;
 const rendered=richContentHtml(source,'HTML',{[stable]:'https://images.pebble-log.com/owner-preview'});
 assert.match(rendered,/images.pebble-log.com\/owner-preview/);
 assert.equal(richContentHtml(source,'HTML').includes(stable),true);
 assert.doesNotMatch(richContentHtml(source,'HTML',{[stable]:'javascript:alert(1)'}),/javascript:/);
});
import {ownerPostImages} from '../src/features/post/api/owner-post-images.ts';
test('작성자 이미지 목록의 배열 응답만 허용하며 비밀 값이나 잘못된 URL은 렌더링하지 않는다',()=>{
 const previous=process.env.NEXT_PUBLIC_API_BASE_URL;process.env.NEXT_PUBLIC_API_BASE_URL='https://api.pebble-log.com/api/v1';
 try{
  assert.deepEqual(ownerPostImages({data:[{id:'2',url:'https://images.pebble-log.com/signed'}]},'1'),{'https://api.pebble-log.com/api/v1/posts/1/images/2/content':'https://images.pebble-log.com/signed'});
  assert.deepEqual(ownerPostImages({data:[{id:'2',url:'javascript:alert(1)'}]},'1'),{});
  assert.throws(()=>ownerPostImages({data:{}},'1'));assert.throws(()=>ownerPostImages({data:[{id:'../2',url:'https://test.invalid'}]},'1'));
 }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_API_BASE_URL;else process.env.NEXT_PUBLIC_API_BASE_URL=previous;}
});
