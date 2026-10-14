import test from "node:test";
import assert from "node:assert/strict";
import {callbackMode} from "../src/features/auth/withdrawal-intent.ts";
import {createUserSession} from "../src/features/auth/user-session.ts";
import {memberJson,MemberApiError} from "../src/lib/member-api.ts";
import {formatSeoulDateTime} from "../src/lib/date-time.ts";
const base="http://localhost:8081/api/v1",member={id:"1",nickname:"회원",handle:"writer",blogName:"기록",profileCompleted:true,status:"ACTIVE"};
const json=data=>Response.json({data}),grant=()=>json({accessToken:"temporary",tokenType:"Bearer",accessTokenExpiresIn:900});
test("WITHDRAWAL_PENDING retains only one valid ISO deletion time and formats it in Seoul time",async()=>{
 const response=details=>Response.json({error:{code:"WITHDRAWAL_PENDING",message:"탈퇴 예약이 진행 중입니다.",details}},{status:409});
 await assert.rejects(memberJson("/auth/naver/login",{},async()=>response([{field:"withdrawalScheduledAt",reason:"2026-10-10T15:00:00Z"}]),base),error=>error instanceof MemberApiError&&error.withdrawalScheduledAt==="2026-10-10T15:00:00Z");
 assert.equal(formatSeoulDateTime("2026-10-10T15:00:00Z"),"2026-10-11 00:00:00 (한국 시간)");
 for(const details of [[],[{field:"withdrawalScheduledAt",reason:"tomorrow"}],[{field:"withdrawalScheduledAt",reason:"2026-10-10T15:00:00Z"},{field:"traceId",reason:"x"}]]){
  await assert.rejects(memberJson("/auth/naver/login",{},async()=>response(details),base),error=>error instanceof MemberApiError&&error.withdrawalScheduledAt===undefined);
 }
 await assert.rejects(memberJson("/auth/naver/login",{},async()=>Response.json({error:{code:"OTHER",message:"x",details:[{field:"withdrawalScheduledAt",reason:"2026-10-10T15:00:00Z"}]}},{status:409}),base),error=>error instanceof MemberApiError&&error.withdrawalScheduledAt===undefined);
 assert.equal(formatSeoulDateTime("2026-02-30T15:00:00Z"),null);
});
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
test("withdrawal OAuth callback is single-flight, sends no Bearer, and clears local auth after scheduling",async()=>{
 const calls=[];const session=createUserSession(async(url,options)=>{calls.push(url.pathname);assert.equal(options.method,'POST');assert.equal(options.credentials,'include');assert.equal(options.headers.Authorization,undefined);assert.deepEqual(JSON.parse(options.body),{authorizationCode:'code',state:'state'});return json({withdrawalScheduledAt:'2026-10-11T00:00:00Z'});},action=>action(),base);
 const results=await Promise.all([session.completeWithdrawal('code','state'),session.completeWithdrawal('code','state')]);assert.deepEqual(results,['2026-10-11T00:00:00Z','2026-10-11T00:00:00Z']);assert.deepEqual(calls,['/api/v1/auth/naver/withdrawal']);assert.equal(session.snapshot().phase,'guest');assert.equal(session.snapshot().member,null);
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
 finishWithdrawal(json({withdrawalScheduledAt:'2026-10-11T00:00:00Z'}));
 await assert.rejects(withdrawing,error=>error instanceof MemberApiError&&error.code==='SESSION_CHANGED');
 assert.equal(session.snapshot().phase,'ready');assert.equal(session.snapshot().member?.id,'1');
});
