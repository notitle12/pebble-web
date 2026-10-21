import test from "node:test";
import assert from "node:assert/strict";
import {rememberLoginReturn,consumeLoginReturn,LOGIN_RETURN_KEY} from "../src/features/auth/login-return-intent.ts";
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
test("로그인 state와 일치하는 프로젝트 수정 주소를 한 번만 복원한다",()=>{
 const s=storage(),path="/projects/899907444891119227/edit";
 rememberLoginReturn(s,"request-1",path,1000);
 assert.equal(consumeLoginReturn(s,"request-1",2000),path);
 assert.equal(consumeLoginReturn(s,"request-1",2000),"/me/blog");
});
test("이전 로그인·만료·잘못된 데이터는 관리 주소 대신 내 블로그로 복귀한다",()=>{
 for(const [state,now] of [["old-request",2000],["request-1",2000000],["request-1",0]]){
  const s=storage();rememberLoginReturn(s,"request-1","/me/boards",1000);
  assert.equal(consumeLoginReturn(s,state,now),"/me/blog");
 }
 const s=storage();s.setItem(LOGIN_RETURN_KEY,"broken");assert.equal(consumeLoginReturn(s,"request-1"),"/me/blog");
});
test("외부 목적지는 허용하지 않고 이전 배포 저장 형식은 한 번만 호환한다",()=>{
 const s=storage();rememberLoginReturn(s,"request-1","https://evil.example",1000);
 assert.equal(consumeLoginReturn(s,"request-1",2000),"/me/posts");
 s.setItem("pebble-login-destination","/projects/123/edit");
 assert.equal(consumeLoginReturn(s,"legacy"),"/projects/123/edit");
 assert.equal(consumeLoginReturn(s,"legacy"),"/me/blog");
});
