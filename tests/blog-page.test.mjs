import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBlogPageData} from '../src/features/blog-tools/api/blog-page.ts';
import {GuestApiError} from '../src/lib/public-api.ts';
const base='https://api.example.test/api/v1';
const query={handle:'test-blog',page:0,homeView:false,projectView:false};
const profile={id:'100',handle:'test-blog',nickname:'작성자',blogName:'기록',profileImageUrl:null};
const empty={content:[],page:0,size:20,totalElements:0,totalPages:0,hasNext:false,hasPrevious:false};
const json=data=>new Response(JSON.stringify({data}),{headers:{'Content-Type':'application/json'}});
function fixture(url){
 if(url.pathname.endsWith('/links'))return json({githubUrl:null,sites:[]});
 if(url.pathname.endsWith('/boards'))return json([{id:'20',name:'개발',displayOrder:0,children:[]}]);
 if(url.pathname==='/api/v1/blogs/test-blog')return json(profile);
 return json({...empty,page:Number(url.searchParams.get('page')??0),hasPrevious:Number(url.searchParams.get('page')??0)>0});
}
test('게시판의 독립 조회는 이전 응답을 기다리지 않고 동시에 시작한다',async()=>{
 let release,started,timeout;const paths=[];
 const gate=new Promise(resolve=>release=resolve),allStarted=new Promise(resolve=>started=resolve);
 const pending=loadBlogPageData(query,base,async(url,init)=>{
  assert.equal(init.credentials,'omit');assert.equal(init.headers.Authorization,undefined);assert.equal(init.cache,'no-store');
  paths.push(url.pathname);
  if(url.pathname!=='/api/v1/blogs/test-blog'){
   if(paths.length===5)started();
   await gate;
  }
  return fixture(url);
 });
 try {
  await Promise.race([allStarted,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('독립 조회가 이전 응답을 기다립니다.')),2000);})]);
  assert.deepEqual(new Set(paths),new Set(['/api/v1/blogs/test-blog','/api/v1/blogs/test-blog/links','/api/v1/members/100/boards','/api/v1/members/100/projects','/api/v1/blogs/test-blog/posts']));
 } finally {clearTimeout(timeout);release();}
 const data=await pending;assert.equal(data.author.id,'100');assert.deepEqual(data.result.content,[]);
});
test('프로젝트 첫 페이지를 사이드바와 본문에서 중복 조회하지 않는다',async()=>{
 const paths=[];const data=await loadBlogPageData({...query,projectView:true},base,async url=>{paths.push(url.pathname);return fixture(url);});
 assert.equal(paths.filter(p=>p.endsWith('/projects')).length,1);
 assert.equal(data.sidebarProjects,data.projectsResult);assert.equal(data.result,undefined);
});
test('보조 링크 조회 실패는 정상 게시판 목록을 막지 않는다',async()=>{
 const data=await loadBlogPageData(query,base,async url=>url.pathname.endsWith('/links')?new Response(null,{status:503}):fixture(url));
 assert.equal(data.linksError,true);assert.equal(data.links,null);assert.deepEqual(data.result.content,[]);assert.equal(data.boardError,false);
});
test('게시판 병렬 조회 후에도 없는 폴더와 폴더 조회 실패를 허용하지 않는다',async()=>{
 for(const mode of ['missing','failed'])await assert.rejects(loadBlogPageData({...query,selected:'21'},base,async url=>url.pathname.endsWith('/boards')?(mode==='missing'?json([]):new Response(null,{status:404})):fixture(url)),error=>error instanceof GuestApiError&&error.kind==='not-found');
});
