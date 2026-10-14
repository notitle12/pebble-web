import test from 'node:test';
import assert from 'node:assert/strict';
import {ownBlogPostsPath,parseOwnerBlogPosts,matchesOwnerBlogSnapshot,blogPostHref} from '../src/features/post/api/owner-blog-posts.ts';
const post={id:'1',urlKey:'entry-1',title:'비공개 기록',summary:null,author:{id:'100',handle:'owner-test',nickname:'작성자',blogName:null},tags:[],publishedAt:null,createdAt:'2026-10-14T00:00:00Z',visibilityStatus:'HIDDEN',draft:false,isBlocked:false,displayOrder:0,boardId:'20',boardDisplayOrder:0};
const page=content=>({data:{content,page:0,size:20,totalElements:content.length,totalPages:content.length?1:0,hasNext:false,hasPrevious:false}});
test('본인 블로그 조회는 JWT 주체의 전용 주소와 검증된 필터만 사용한다',()=>{
 assert.equal(ownBlogPostsPath({page:0}),'/members/me/blog/posts?page=0&size=20');
 assert.match(ownBlogPostsPath({page:2,boardId:'20'}),/page=2&size=20&boardId=20$/);
 assert.match(ownBlogPostsPath({page:0,q:'비밀 기록'}),/q=/);
 assert.match(ownBlogPostsPath({page:0,placement:'projects'}),/placement=projects$/);
 for(const query of [{page:-1},{page:NaN},{page:0,boardId:'bad'},{page:0,q:'x'.repeat(201)},{page:0,q:''},{page:0,q:'x',placement:'boards'},{page:0,boardId:'20',placement:'projects'}])assert.throws(()=>ownBlogPostsPath(query));
});
test('개인 목록에서 다른 작성자·블로그·초안·차단·삭제 응답을 거부한다',()=>{
 assert.equal(parseOwnerBlogPosts(page([post]),{page:0,boardId:'20'},'100','owner-test').content[0].visibilityStatus,'HIDDEN');
 for(const bad of [{...post,author:{...post.author,id:'101'}},{...post,author:{...post.author,handle:'other-blog'}},{...post,draft:true},{...post,isBlocked:true},{...post,visibilityStatus:'DELETED'}])assert.throws(()=>parseOwnerBlogPosts(page([bad]),{page:0},'100','owner-test'));
});
test('계정 전환·로그아웃·세션 재연결·페이지 변경 시 이전 개인 목록을 렌더링하지 않는다',()=>{
 const session={phase:'ready',member:{id:'100',handle:'owner-test'},message:''};
 const path=ownBlogPostsPath({page:0}),snapshot={session,path,data:page([post]).data,error:''};
 assert.equal(matchesOwnerBlogSnapshot(snapshot,session,path,'100','owner-test'),true);
 for(const next of [{...session,phase:'guest'},{...session,phase:'loading'},{...session,member:{id:'200',handle:'other-blog'}},{...session}])assert.equal(matchesOwnerBlogSnapshot(snapshot,next,path,'100','owner-test'),false);
 assert.equal(matchesOwnerBlogSnapshot(snapshot,session,ownBlogPostsPath({page:1}),'100','owner-test'),false);
 assert.equal(matchesOwnerBlogSnapshot(snapshot,session,path,'200','owner-test'),false);
});
test('비공개 글은 작성자 열람으로, 공개 글은 공개 주소로 연결한다',()=>{
 assert.equal(blogPostHref(post),'/posts/1/view');
 assert.equal(blogPostHref({...post,visibilityStatus:'PUBLIC'}),'/blogs/owner-test/posts/entry-1');
});
