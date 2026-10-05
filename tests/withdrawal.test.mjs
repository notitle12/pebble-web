import test from "node:test";
import assert from "node:assert/strict";
import {callbackMode} from "../src/features/auth/withdrawal-intent.ts";
import {createUserSession} from "../src/features/auth/user-session.ts";
const base="http://localhost:8081/api/v1",member={id:"1",nickname:"회원",handle:"writer",blogName:"기록",profileCompleted:true,status:"ACTIVE"};
const json=data=>Response.json({data}),grant=()=>json({accessToken:"temporary",tokenType:"Bearer",accessTokenExpiresIn:900});
test("탈퇴 취소 의도는 같은 OAuth state에만 적용한다",()=>{
 assert.equal(callbackMode(null,"state"),"login");assert.equal(callbackMode(JSON.stringify({mode:"withdrawal-cancel",state:"state"}),"state"),"withdrawal-cancel");
 for(const input of ["invalid",JSON.stringify({mode:"login",state:"state"}),JSON.stringify({mode:"withdrawal-cancel",state:"other"})])assert.throws(()=>callbackMode(input,"state"));
});
test("탈퇴 예약은 Bearer로 한 번 요청하고 성공 시 모든 로컬 인증을 비운다",async()=>{
 let writes=0;const session=createUserSession(async(url,options)=>{
  if(url.pathname.endsWith('/refresh'))return grant();
  if(options.method==='DELETE'){writes++;assert.equal(options.credentials,'include');assert.equal(options.headers.Authorization,'Bearer temporary');assert.equal(options.body,undefined);return json({withdrawalScheduledAt:'2026-10-11T00:00:00Z'});}
  return json(member);
 },action=>action(),base);
 await session.ensure();await session.withdraw();assert.equal(writes,1);assert.equal(session.snapshot().phase,'guest');assert.equal(session.snapshot().member,null);await assert.rejects(()=>session.request('/posts'));
});
test("탈퇴 예약 응답 유실은 자동 재요청 없이 불확실 상태를 유지한다",async()=>{
 let writes=0;const session=createUserSession(async(url,options)=>{
  if(url.pathname.endsWith('/refresh'))return grant();if(options.method==='DELETE'){writes++;throw new Error('lost');}return json(member);
 },action=>action(),base);
 await session.ensure();await assert.rejects(()=>session.withdraw());assert.equal(writes,1);assert.equal(session.snapshot().phase,'error');assert.equal(session.snapshot().member,null);await assert.rejects(()=>session.withdraw());assert.equal(writes,1);
});
test("탈퇴 취소는 재인증 코드를 한 번 사용하며 새 세션을 발급하거나 로그인하지 않는다",async()=>{
 const calls=[];const session=createUserSession(async(url,options)=>{calls.push(url.pathname);assert.equal(options.credentials,'include');assert.equal(options.headers.Authorization,undefined);assert.deepEqual(JSON.parse(options.body),{authorizationCode:'code',state:'state'});return json({status:'ACTIVE'});},action=>action(),base);
 await Promise.all([session.cancelWithdrawal('code','state'),session.cancelWithdrawal('code','state')]);assert.deepEqual(calls,['/api/v1/auth/naver/withdrawal/cancel']);assert.equal(session.snapshot().phase,'guest');assert.equal(session.snapshot().member,null);
});
