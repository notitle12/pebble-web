import test from 'node:test';
import assert from 'node:assert/strict';
import {createUserSession,memberRequiresAgreement,parseMember} from '../src/features/auth/user-session.ts';
import {apiUrl,memberJson,MemberApiError} from '../src/lib/member-api.ts';
const base='http://localhost:8081/api/v1';
const member={id:'1',nickname:'회원',handle:'member',blogName:'기록',profileImageUrl:null,profileCompleted:true,status:'ACTIVE'};
const json=data=>new Response(JSON.stringify({data}),{status:200,headers:{'Content-Type':'application/json'}});
const grant=()=>json({accessToken:'test-memory-only',tokenType:'Bearer',accessTokenExpiresIn:900});
const denial=status=>new Response(JSON.stringify({error:{code:'INVALID_TOKEN',message:'인증을 확인해 주세요.'}}),{status});
const direct=action=>action();
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const serial=()=>{let tail=Promise.resolve();return action=>{const next=tail.then(action);tail=next.catch(()=>{});return next;};};

test('member gate policy requires agreement unless the parsed member explicitly accepted',()=>{
 assert.equal(memberRequiresAgreement({}),true);
 assert.equal(memberRequiresAgreement({agreementsAccepted:false}),true);
 assert.equal(memberRequiresAgreement({agreementsAccepted:true}),false);
});

test('member parser accepts older responses without profile image and preserves nullable image URLs',()=>{
 const older={...member};delete older.profileImageUrl;
 assert.equal(parseMember({data:older}).profileImageUrl,null);
 assert.equal(parseMember({data:older}).agreementsAccepted,false);
 assert.equal(parseMember({data:{...older,agreementsAccepted:true}}).agreementsAccepted,true);
 assert.equal(parseMember({data:{...member,profileImageUrl:'https://cdn.example/avatar.webp'}}).profileImageUrl,'https://cdn.example/avatar.webp');
 assert.throws(()=>parseMember({data:{...member,profileImageUrl:42}}),MemberApiError);
 assert.throws(()=>parseMember({data:{...member,agreementsAccepted:"true"}}),MemberApiError);
 assert.throws(()=>parseMember({data:{...member,agreementsAccepted:null}}),MemberApiError);
});

test('member URL preserves queries and rejects external paths',()=>{
 assert.equal(apiUrl('/members/me/posts?page=2&size=20',base).href,base+'/members/me/posts?page=2&size=20');
 assert.throws(()=>apiUrl('//example.com/leak',base),MemberApiError);
});
test('concurrent session recovery shares one refresh and sends writes with Bearer only',async()=>{
 let refresh=0;const options=[];
 const session=createUserSession(async(url,init)=>{options.push([url.pathname,init]);if(url.pathname.endsWith('/refresh')){refresh++;await Promise.resolve();return grant();}if(url.pathname.endsWith('/members/me'))return json(member);return json({id:'post'});},direct,base);
 await Promise.all([session.ensure(),session.ensure(),session.ensure()]);assert.equal(refresh,1);assert.equal(session.snapshot().phase,'ready');
 await session.request('/posts',{method:'POST',body:{title:'글'}});
 const write=options.at(-1)[1];assert.equal(write.headers.Authorization,'Bearer test-memory-only');assert.equal(write.credentials,'omit');assert.equal(options[0][1].credentials,'include');assert.equal(write.cache,'no-store');
});
test('logout waits for in-flight refresh cookie rotation and ignores stale grant',async()=>{
 const gate=deferred(),started=deferred(),calls=[];
 const session=createUserSession(async url=>{calls.push(url.pathname);if(url.pathname.endsWith('/refresh')){started.resolve();await gate.promise;return grant();}if(url.pathname.endsWith('/logout'))return new Response(null,{status:204});return json(member);},serial(),base);
 const restore=session.ensure();await started.promise;const logout=session.logout();gate.resolve();await Promise.all([restore,logout]);
 assert.deepEqual(calls,['/api/v1/auth/token/refresh','/api/v1/auth/logout']);assert.equal(session.snapshot().phase,'guest');
 await assert.rejects(session.request('/posts',{method:'POST',body:{}}));
});
test('lost refresh response is not retried and remains an error rather than Guest',async()=>{
 let calls=0;const session=createUserSession(async()=>{calls++;throw new Error('offline');},direct,base);
 await session.ensure();await session.ensure();assert.equal(calls,1);assert.equal(session.snapshot().phase,'error');await assert.rejects(session.request('/posts',{method:'POST',body:{}}));assert.equal(calls,1);
});
test('401 writes are never automatically replayed and confirmed account changes clear identity',async()=>{
 let writes=0;const session=createUserSession(async url=>url.pathname.endsWith('/refresh')?grant():url.pathname.endsWith('/members/me')?json(member):(writes++,denial(401)),direct,base);
 await session.ensure();await assert.rejects(session.request('/posts',{method:'POST',body:{}}));assert.equal(writes,1);assert.equal(session.snapshot().phase,'guest');assert.equal(session.snapshot().member.id,'1');session.invalidate();assert.equal(session.snapshot().member,null);
});
test('accepted agreements refresh the same member session before member functions continue',async()=>{
 let accepted=false;const paths=[];let submitted;
 const session=createUserSession(async(url,options)=>{
  paths.push([url.pathname,options.method??'GET']);
  if(url.pathname.endsWith('/refresh'))return grant();
  if(url.pathname.endsWith('/members/me/agreements')){
   if(options.method==='POST'){submitted=JSON.parse(options.body);accepted=true;}
   return json({termsVersion:'2026-10-21',privacyVersion:'2026-10-21',accepted,acceptedAt:accepted?'2026-10-21T01:00:00Z':null,available:true});
  }
  if(url.pathname.endsWith('/members/me'))return json({...member,agreementsAccepted:accepted});
  return json({});
 },direct,base);
 await session.ensure();assert.equal(session.snapshot().member.agreementsAccepted,false);
 await session.request('/members/me/agreements');
 await session.request('/members/me/agreements',{method:'POST',body:{termsVersion:'2026-10-21',privacyVersion:'2026-10-21',termsAccepted:true,privacyAccepted:true,ageConfirmed:true}});
 await session.reloadMember();
 assert.deepEqual(submitted,{termsVersion:'2026-10-21',privacyVersion:'2026-10-21',termsAccepted:true,privacyAccepted:true,ageConfirmed:true});
 assert.equal(session.snapshot().member.agreementsAccepted,true);
 assert.deepEqual(paths.slice(-3).map(([path,method])=>[path.split('/api/v1').pop(),method]),[['/members/me/agreements','GET'],['/members/me/agreements','POST'],['/members/me','GET']]);
});

test('member transport surfaces failures without retrying writes',async()=>{
 let calls=0;await assert.rejects(memberJson('/posts',{method:'POST',body:{}},async()=>{calls++;throw new Error('response lost');},base),e=>e instanceof MemberApiError&&e.code==='NETWORK');assert.equal(calls,1);
});

test('duplicate OAuth callback is consumed once and logout cannot restore late login',async()=>{
 const started=deferred(),gate=deferred(),calls=[];const session=createUserSession(async url=>{calls.push(url.pathname);if(url.pathname.endsWith('/login')){started.resolve();await gate.promise;return grant();}if(url.pathname.endsWith('/logout'))return new Response(null,{status:204});return json(member);},serial(),base);
 const first=session.complete('one-use-code','state');const duplicate=session.complete('one-use-code','state');await started.promise;const logout=session.logout();gate.resolve();await Promise.all([first,duplicate,logout]);assert.deepEqual(calls,['/api/v1/auth/naver/login','/api/v1/auth/logout']);assert.equal(session.snapshot().phase,'guest');
});
test('cross-tab lock failure refuses restoration and logout failure stays uncertain',async()=>{
 let calls=0;const session=createUserSession(async()=>{calls++;return grant();},()=>Promise.reject(new Error('no lock')),base);await session.ensure();assert.equal(calls,0);assert.equal(session.snapshot().phase,'error');
 const failed=createUserSession(async()=>{throw new Error('offline');},direct,base);await failed.logout();assert.equal(failed.snapshot().phase,'error');assert.equal(failed.snapshot().member,null);
});

test('expired-token restoration keeps editor identity while waiting and on response loss',async()=>{
 const started=deferred(),gate=deferred();let refreshes=0;const session=createUserSession(async url=>{if(url.pathname.endsWith('/refresh')){refreshes++;if(refreshes===1)return json({accessToken:'short-lived',tokenType:'Bearer',accessTokenExpiresIn:1});started.resolve();await gate.promise;throw new Error('response lost');}return json(member);},direct,base);
 await session.ensure();const save=session.request('/posts',{method:'POST',body:{title:'edited'}});const rejected=assert.rejects(save);await started.promise;assert.equal(session.snapshot().phase,'loading');assert.equal(session.snapshot().member.id,'1');gate.resolve();await rejected;assert.equal(session.snapshot().phase,'error');assert.equal(session.snapshot().member.id,'1');
});

test('multipart media uses Bearer and lets the browser create its boundary without replay',async()=>{
 const file=new Blob(['test'],{type:'image/png'}),body=new FormData();body.set('file',file,'test.png');let writes=0;
 const session=createUserSession(async(url,options)=>{
   if(url.pathname.endsWith('/refresh'))return grant();
   if(url.pathname.endsWith('/members/me'))return json(member);
   writes++;assert.equal(options.body,body);assert.equal(options.headers['Content-Type'],undefined);
   assert.equal(options.headers.Authorization,'Bearer test-memory-only');assert.equal(options.credentials,'omit');
   throw new Error('lost upload response');
 },direct,base);
 await session.ensure();await assert.rejects(session.request('/posts/1/thumbnail',{method:'PUT',body}));assert.equal(writes,1);
});


test('서버가 현재 동의를 요구하면 세션을 유지하면서 회원 기능을 다시 제한하고 요청을 재전송하지 않는다',async()=>{
 let writes=0;
 const session=createUserSession(async url=>{
  if(url.pathname.endsWith('/refresh'))return grant();
  if(url.pathname.endsWith('/members/me'))return json({...member,agreementsAccepted:true});
  writes++;
  return new Response(JSON.stringify({error:{code:'AGREEMENTS_REQUIRED',message:'약관 동의가 필요합니다.'}}),{status:403,headers:{'Content-Type':'application/json'}});
 },direct,base);
 await session.ensure();
 await assert.rejects(session.request('/posts',{method:'POST',body:{}}),e=>e.code==='AGREEMENTS_REQUIRED');
 assert.equal(writes,1);assert.equal(session.snapshot().phase,'ready');assert.equal(session.snapshot().member.agreementsAccepted,false);
});

test('로그인 완료 뒤 여러 화면의 세션 확인은 refresh나 회원 조회를 반복하지 않는다',async()=>{
 const paths=[];const session=createUserSession(async url=>{paths.push(url.pathname);return url.pathname.endsWith('/login')?grant():json(member);},direct,base);
 await session.complete('one-use-code','state');
 await Promise.all(Array.from({length:8},()=>session.ensure()));
 assert.deepEqual(paths,['/api/v1/auth/naver/login','/api/v1/members/me']);
 assert.equal(session.snapshot().phase,'ready');
});

test('토큰 갱신 중 회원이 바뀌면 이전 회원의 대기 중 쓰기를 보내지 않는다',async()=>{
 let refreshes=0,writes=0;
 const session=createUserSession(async(url)=>{
  if(url.pathname.endsWith('/refresh')){refreshes++;return json({accessToken:'token-'+refreshes,tokenType:'Bearer',accessTokenExpiresIn:refreshes===1?1:900});}
  if(url.pathname.endsWith('/members/me'))return json({...member,id:refreshes===1?'1':'2'});
  writes++;return new Response(null,{status:204});
 },direct,base);
 await session.ensure();assert.equal(session.snapshot().member.id,'1');
 await assert.rejects(session.request('/posts/10',{method:'DELETE'}),e=>e instanceof MemberApiError&&e.code==='SESSION_CHANGED');
 assert.equal(writes,0);assert.equal(session.snapshot().phase,'ready');assert.equal(session.snapshot().member.id,'2');
});

test('content views use cookie credentials and optional in-memory Bearer without refreshing or logging out on failure',async()=>{
 const calls=[];const session=createUserSession(async(url,options)=>{calls.push([url.pathname,options]);if(url.pathname.endsWith('/refresh'))return grant();if(url.pathname.endsWith('/members/me'))return json(member);return denial(401);},direct,base);
 await session.trackContentView('posts','42');assert.equal(calls.length,0);
 await session.ensure();const before=calls.length;
 await assert.rejects(session.trackContentView('projects','42'));assert.equal(calls.length,before+1);assert.equal(session.snapshot().phase,'ready');
 const options=calls.at(-1)[1];assert.equal(options.credentials,'include');assert.equal(options.headers.Authorization,'Bearer test-memory-only');
 await session.trackContentView('posts','../bad');assert.equal(calls.length,before+1);
});
test('guest content views do not send Bearer and analytics failures do not alter the session',async()=>{
 const calls=[];const session=createUserSession(async(url,options)=>{calls.push([url.pathname,options]);return denial(401);},direct,base);
 await session.ensure();assert.equal(session.snapshot().phase,'guest');const before=calls.length;
 await assert.rejects(session.trackContentView('posts','42'));assert.equal(calls.length,before+1);assert.equal(session.snapshot().phase,'guest');assert.equal(calls.at(-1)[1].headers.Authorization,undefined);assert.equal(calls.at(-1)[1].credentials,'include');
});
test('expired ready sessions skip content views without refresh or guest downgrade',async()=>{
 const originalNow=Date.now;let now=originalNow();Date.now=()=>now;
 try{let calls=0;const session=createUserSession(async url=>{calls++;return url.pathname.endsWith('/refresh')?grant():json(member);},direct,base);await session.ensure();const before=calls;now+=901000;await session.trackContentView('posts','42');assert.equal(calls,before);assert.equal(session.snapshot().phase,'ready');}finally{Date.now=originalNow;}
});

test('content source recording transmits only the fixed enum in optional JSON and rejects unknown values',async()=>{
 const calls=[];const session=createUserSession(async(url,options)=>{calls.push([url.pathname,options]);return url.pathname.endsWith('/refresh')?denial(401):new Response(null,{status:204});},direct,base);
 await session.ensure();await session.trackContentView('posts','42','GOOGLE');assert.deepEqual(JSON.parse(calls.at(-1)[1].body),{source:'GOOGLE'});assert.equal(calls.at(-1)[1].credentials,'include');
 const count=calls.length;await session.trackContentView('posts','42','https://google.com/search?q=private');assert.equal(calls.length,count);
 await session.trackContentView('posts','42');assert.equal(calls.at(-1)[1].body,undefined);
});
