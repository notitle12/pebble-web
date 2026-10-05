import test from 'node:test';
import assert from 'node:assert/strict';
import {createUserSession,parseMember} from '../src/features/auth/user-session.ts';
import {apiUrl,memberJson,MemberApiError} from '../src/lib/member-api.ts';
const base='http://localhost:8081/api/v1';
const member={id:'1',nickname:'회원',handle:'member',blogName:'기록',profileImageUrl:null,profileCompleted:true,status:'ACTIVE'};
const json=data=>new Response(JSON.stringify({data}),{status:200,headers:{'Content-Type':'application/json'}});
const grant=()=>json({accessToken:'test-memory-only',tokenType:'Bearer',accessTokenExpiresIn:900});
const denial=status=>new Response(JSON.stringify({error:{code:'INVALID_TOKEN',message:'인증을 확인해 주세요.'}}),{status});
const direct=action=>action();
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const serial=()=>{let tail=Promise.resolve();return action=>{const next=tail.then(action);tail=next.catch(()=>{});return next;};};

test('member parser accepts older responses without profile image and preserves nullable image URLs',()=>{
 const older={...member};delete older.profileImageUrl;
 assert.equal(parseMember({data:older}).profileImageUrl,null);
 assert.equal(parseMember({data:{...member,profileImageUrl:'https://cdn.example/avatar.webp'}}).profileImageUrl,'https://cdn.example/avatar.webp');
 assert.throws(()=>parseMember({data:{...member,profileImageUrl:42}}),MemberApiError);
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
