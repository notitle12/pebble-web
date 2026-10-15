import test from "node:test";
import assert from "node:assert/strict";
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
