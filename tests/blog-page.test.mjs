import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBlogPageData} from '../src/features/blog-tools/api/blog-page.ts';
import {GuestApiError} from '../src/lib/public-api.ts';
import {defaultBlogHomeSettings} from '../src/features/blog-home/api/blog-home.ts';
import {mockPosts,mockProjects} from '../scripts/mock-post-api.mjs';
const base='https://api.example.test/api/v1';
const query={handle:'test-blog',page:0,homeView:false,projectView:false};
const profile={id:'100',handle:'test-blog',nickname:'작성자',blogName:'기록',profileImageUrl:null};
const empty={content:[],page:0,size:20,totalElements:0,totalPages:0,hasNext:false,hasPrevious:false};
const popularEmpty={content:[],page:0,size:10,totalElements:0,totalPages:0,hasNext:false,hasPrevious:false};
const json=data=>new Response(JSON.stringify({data}),{headers:{'Content-Type':'application/json'}});
const home={...defaultBlogHomeSettings(),featuredProjectIds:[mockProjects[0].id],activity:{from:'2026-11-01',to:'2026-11-07',timeZone:'Asia/Seoul',days:[]}};
const project={...mockProjects[0],owner:{...mockProjects[0].owner,id:'100'},description:null,startedOn:null,completedOn:null,features:[],links:[]};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
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
 assert.equal((await data.sidebar).sidebarProjects,data.projectsResult);assert.equal(data.result,undefined);
});
test('시리즈 화면은 일반 게시글 페이지를 불필요하게 조회하지 않는다',async()=>{
 const paths=[];const data=await loadBlogPageData({...query,seriesView:true},base,async url=>{paths.push(url.pathname);return fixture(url);});
 assert.equal(data.result,undefined);
 assert.equal(paths.some(path=>path.endsWith('/posts')),false);
 assert.equal(paths.some(path=>path.endsWith('/home')),false);
});
test('보조 링크 조회 실패는 정상 게시판 목록을 막지 않는다',async()=>{
 const data=await loadBlogPageData(query,base,async url=>url.pathname.endsWith('/links')?new Response(null,{status:503}):fixture(url));
 const sidebar=await data.sidebar;
 assert.equal(sidebar.linksError,true);assert.equal(sidebar.links,null);assert.deepEqual(data.result.content,[]);assert.equal(sidebar.boardError,false);
});

test('프로필 응답 전에도 handle 기반 목록·링크 조회를 시작한다',{timeout:2000},async t=>{
 const gate=deferred(),started=deferred(),paths=[];
 t.after(()=>gate.resolve());
 const pending=loadBlogPageData(query,base,async url=>{
  paths.push(url.pathname);
  if(paths.length===3)started.resolve();
  if(url.pathname==='/api/v1/blogs/test-blog')await gate.promise;
  return fixture(url);
 });
 await started.promise;
 assert.deepEqual(new Set(paths),new Set(['/api/v1/blogs/test-blog','/api/v1/blogs/test-blog/links','/api/v1/blogs/test-blog/posts']));
 gate.resolve();
 const data=await pending;await data.sidebar;
});

test('느린 사이드바 요청이 정상 게시글 목록 반환을 막지 않는다',{timeout:2000},async t=>{
 const gate=deferred();let sidebarDone=false;
 t.after(()=>gate.resolve());
 const data=await loadBlogPageData(query,base,async url=>{
  if(url.pathname.endsWith('/links')||url.pathname.endsWith('/boards')||url.pathname.endsWith('/projects'))await gate.promise;
  return fixture(url);
 });
 data.sidebar.then(()=>{sidebarDone=true;});
 assert.deepEqual(data.result.content,[]);assert.equal(sidebarDone,false);
 gate.resolve();await data.sidebar;assert.equal(sidebarDone,true);
});

test('홈 설정·인기 글·대표 프로젝트는 사이드바를 기다리지 않으며 각각 독립적으로 완료된다',{timeout:2000},async t=>{
 const sidebarGate=deferred(),projectGate=deferred(),started=deferred(),paths=[];
 t.after(()=>{sidebarGate.resolve();projectGate.resolve();});
 const data=await loadBlogPageData({...query,homeView:true},base,async url=>{
  paths.push(url.pathname);
  if(url.pathname.endsWith('/links')||url.pathname.endsWith('/boards')||url.pathname.startsWith('/api/v1/members/'))await sidebarGate.promise;
  if(url.pathname.endsWith('/home'))return json(home);
  if(url.pathname===`/api/v1/projects/${mockProjects[0].id}`){started.resolve();await projectGate.promise;return json(project);}
  if(url.pathname.endsWith('/popular-posts'))return json({...popularEmpty,content:[{...mockPosts[0],author:{...mockPosts[0].author,handle:'test-blog'},likeCount:3}],size:10,totalElements:1,totalPages:1});
  return fixture(url);
 });
 const content=await data.home;await started.promise;
 assert.ok(content);assert.equal(content.settings.activity.timeZone,'Asia/Seoul');
 const posts=await content.posts;
 assert.equal(posts.failed,false);assert.equal(posts.posts.content[0].id,mockPosts[0].id);
 assert.ok(paths.includes('/api/v1/blogs/test-blog/popular-posts'));
 projectGate.resolve();assert.equal((await content.projects).projects.length,1);
 sidebarGate.resolve();await data.sidebar;
});

test('숨긴 홈 섹션은 목록·대표 프로젝트를 조회하지 않는다',async()=>{
 const paths=[];
 const hidden={...home,sections:home.sections.map(section=>({...section,visible:false}))};
 const data=await loadBlogPageData({...query,homeView:true},base,async url=>{paths.push(url.pathname);return url.pathname.endsWith('/home')?json(hidden):fixture(url);});
 const content=await data.home;
 assert.deepEqual(await content.posts,{posts:null,failed:false});
 assert.deepEqual(await content.projects,{projects:[],errors:0});
 assert.ok(!paths.some(path=>path.endsWith('/posts')||path.startsWith('/api/v1/projects/')));
 await data.sidebar;
});

test('대표 프로젝트의 소유자 검증과 인기 글·홈 실패 상태를 보존한다',async()=>{
 for(const failedHome of [false,true]){
  const data=await loadBlogPageData({...query,homeView:true},base,async url=>{
   if(url.pathname.endsWith('/home'))return failedHome?new Response(null,{status:503}):json(home);
   if(url.pathname.endsWith('/popular-posts'))return new Response(null,{status:503});
   if(url.pathname.startsWith('/api/v1/projects/'))return json({...project,owner:{...project.owner,id:'999'}});
   return fixture(url);
  });
  const content=await data.home;
  if(failedHome)assert.equal(content,null);
  else{assert.deepEqual(await content.posts,{posts:null,failed:true});assert.deepEqual(await content.projects,{projects:[],errors:1});}
  await data.sidebar;
 }
});

test('프로필 404가 최우선이며 먼저 실패한 보조 조회도 처리한다',async()=>{
 await assert.rejects(loadBlogPageData({...query,homeView:true},base,async()=>new Response(null,{status:404})),error=>error instanceof GuestApiError&&error.kind==='not-found');
});
test('게시판 병렬 조회 후에도 없는 폴더와 폴더 조회 실패를 허용하지 않는다',async()=>{
 for(const mode of ['missing','failed'])await assert.rejects(loadBlogPageData({...query,selected:'21'},base,async url=>url.pathname.endsWith('/boards')?(mode==='missing'?json([]):new Response(null,{status:404})):fixture(url)),error=>error instanceof GuestApiError&&error.kind==='not-found');
});
