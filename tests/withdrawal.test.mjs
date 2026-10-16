import test from "node:test";
import assert from "node:assert/strict";
import {withdrawalConfirmation} from '../src/features/member/withdrawal-confirmation.ts';
import {callbackMode} from "../src/features/auth/withdrawal-intent.ts";
import {createUserSession} from "../src/features/auth/user-session.ts";
import {memberJson,MemberApiError} from "../src/lib/member-api.ts";
const base="http://localhost:8081/api/v1",member={id:"1",nickname:"회원",handle:"writer",blogName:"기록",profileCompleted:true,status:"ACTIVE"};
const json=data=>Response.json({data}),grant=()=>json({accessToken:"temporary",tokenType:"Bearer",accessTokenExpiresIn:900});
test("탈퇴 인증 의도는 같은 OAuth state에만 적용한다",()=>{
 assert.equal(callbackMode(null,"state"),"login");assert.equal(callbackMode(JSON.stringify({mode:"withdrawal",state:"state"}),"state"),"withdrawal");
 for(const input of ["invalid",JSON.stringify({mode:"login",state:"state"}),JSON.stringify({mode:"withdrawal",state:"other"}),JSON.stringify({mode:"withdrawal-cancel",state:"state"})])assert.throws(()=>callbackMode(input,"state"));
});
test("탈퇴 시작은 DELETE /members/me에 Bearer와 Cookie를 보내고 승인 URL을 검증한다",async()=>{
 let writes=0;const session=createUserSession(async(url,options)=>{
  if(url.pathname.endsWith('/refresh'))return grant();
  if(options.method==='DELETE'){writes++;assert.equal(url.pathname,'/api/v1/members/me');assert.equal(url.search,'');assert.equal(options.credentials,'include');assert.equal(options.headers.Authorization,'Bearer temporary');assert.equal(options.body,undefined);return json({authorizationUrl:'https://nid.naver.com/oauth2.0/authorize?state=fresh'});}
  return json(member);
 },action=>action(),base);
 await session.ensure();assert.equal(await session.startWithdrawal(),'https://nid.naver.com/oauth2.0/authorize?state=fresh');assert.equal(writes,1);assert.equal(session.snapshot().phase,'ready');
});
test("withdrawal OAuth callback is single-flight, sends no Bearer, and clears local auth after immediate deletion",async()=>{
 const calls=[];const session=createUserSession(async(url,options)=>{calls.push(url.pathname);assert.equal(options.method,'POST');assert.equal(options.credentials,'include');assert.equal(options.headers.Authorization,undefined);assert.deepEqual(JSON.parse(options.body),{authorizationCode:'code',state:'state'});return json({deleted:true});},action=>action(),base);
 const results=await Promise.all([session.completeWithdrawal('code','state'),session.completeWithdrawal('code','state')]);assert.deepEqual(results,[true,true]);assert.deepEqual(calls,['/api/v1/auth/naver/withdrawal']);assert.equal(session.snapshot().phase,'guest');assert.equal(session.snapshot().member,null);
 const invalid=createUserSession(async()=>json({deleted:false}),action=>action(),base);
 await assert.rejects(invalid.completeWithdrawal('code','state'),error=>error instanceof MemberApiError&&error.code==='INVALID_RESPONSE');
});
test("late withdrawal callback cannot clear a newer login session",async()=>{
 let finishWithdrawal;const response=new Promise(resolve=>{finishWithdrawal=resolve;});
 const session=createUserSession(async(url,options)=>{
  if(url.pathname.endsWith('/withdrawal'))return response;
  if(url.pathname.endsWith('/login'))return grant();
  if(url.pathname.endsWith('/members/me'))return json(member);
  throw new Error(`unexpected ${url.pathname}`);
 },action=>action(),base);
 const withdrawing=session.completeWithdrawal('code','withdrawal-state');
 await session.complete('new-login-code','login-state');
 finishWithdrawal(json({deleted:true}));
 await assert.rejects(withdrawing,error=>error instanceof MemberApiError&&error.code==='SESSION_CHANGED');
 assert.equal(session.snapshot().phase,'ready');assert.equal(session.snapshot().member?.id,'1');
});


test("직접 입력 탈퇴는 인증된 본인 요청만 보내고 완료 시 모든 화면의 세션을 비운다",async()=>{
 let announced=0;const calls=[];
 const session=createUserSession(async(url,init)=>{
  calls.push([url.pathname,init]);
  if(url.pathname.endsWith('/refresh'))return grant();
  if(url.pathname.endsWith('/members/me'))return json(member);
  assert.equal(url.pathname,'/api/v1/members/me/withdrawal');
  assert.equal(init.method,'POST');assert.equal(init.credentials,'include');assert.equal(init.headers.Authorization,'Bearer temporary');
  assert.deepEqual(JSON.parse(init.body),{confirmation:'블로그를 삭제하는데 동의합니다.'});
  return new Response(JSON.stringify({data:{deleted:true}}),{status:200,headers:{'Content-Type':'application/json'}});
 },action=>action(),base,()=>announced++);
 await session.ensure();await session.withdraw('블로그를 삭제하는데 동의합니다.','1');
 assert.equal(session.snapshot().phase,'guest');assert.equal(session.snapshot().member,null);assert.equal(announced,1);
 assert.equal(calls.filter(([p])=>p.includes('naver')).length,0);
});

test("확인 문구는 블로그 유무에 따라 고정 문구를 사용한다",()=>{
 assert.equal(withdrawalConfirmation('Pebble'),'블로그를 삭제하는데 동의합니다.');
 assert.equal(withdrawalConfirmation(null),'내 계정을 삭제하는데 동의합니다.');
 assert.equal(withdrawalConfirmation('  '),'내 계정을 삭제하는데 동의합니다.');
});

test("잘못된 확인 문구는 계정을 유지하고 요청을 자동 재시도하지 않는다",async()=>{
 let attempts=0;
 const session=createUserSession(async(url)=>{
  if(url.pathname.endsWith('/refresh'))return grant();
  if(url.pathname.endsWith('/members/me'))return json(member);
  attempts++;return new Response(JSON.stringify({error:{code:'VALIDATION_ERROR',message:'문구를 확인해 주세요.'}}),{status:400});
 },action=>action(),base);
 await session.ensure();await assert.rejects(session.withdraw('wrong','1'));assert.equal(attempts,1);assert.equal(session.snapshot().phase,'ready');
 await assert.rejects(session.withdraw('wrong','2'),error=>error.code==='SESSION_CHANGED');assert.equal(attempts,1);
});

test("늦은 직접 탈퇴 응답이 다른 탭의 변경된 세션을 지우지 않는다",async()=>{
 let release;
 const pending=new Promise(resolve=>{release=resolve;});
 const session=createUserSession(async url=>url.pathname.endsWith('/refresh')?grant():url.pathname.endsWith('/members/me')?json(member):pending,action=>action(),base);
 await session.ensure();const deleting=session.withdraw('블로그를 삭제하는데 동의합니다.','1');
 // 인증과 잠금 진입을 마친 뒤 서버 응답을 기다리는 상태를 재현한다.
 await Promise.resolve();await Promise.resolve();session.invalidate();
 release(json({deleted:true}));await assert.rejects(deleting,error=>error.code==='SESSION_CHANGED');
 assert.equal(session.snapshot().member,null);assert.match(session.snapshot().message,/다른 탭/);
});
