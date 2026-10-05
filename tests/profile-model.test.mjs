import test from "node:test";
import assert from "node:assert/strict";
import {formatProfileAvailability,normalizeHandle,normalizeProfileName,parseEditableMemberProfile,safeProfileReturnTo} from "../src/features/member/profile-model.ts";

const profile={id:"9007199254740993",nickname:"수달",blogName:"Pebble 블로그",handle:"pebble-blog",status:"ACTIVE",profileCompleted:true,nicknameChangeAvailableAt:"2026-10-11T00:00:00Z",blogNameChangeAvailableAt:"2026-10-11T00:00:00Z"};

test("profile response validates account identity and cooldown timestamps",()=>{
  assert.deepEqual(parseEditableMemberProfile({data:profile},profile.id),{id:profile.id,nickname:profile.nickname,blogName:profile.blogName,handle:profile.handle,profileImageUrl:null,nicknameChangeAvailableAt:profile.nicknameChangeAvailableAt,blogNameChangeAvailableAt:profile.blogNameChangeAvailableAt});
  assert.throws(()=>parseEditableMemberProfile({data:{...profile,id:"42"}},profile.id));
  assert.throws(()=>parseEditableMemberProfile({data:{...profile,nicknameChangeAvailableAt:"tomorrow"}},profile.id));
  assert.throws(()=>parseEditableMemberProfile({data:{...profile,blogNameChangeAvailableAt:null}},profile.id));
  assert.throws(()=>parseEditableMemberProfile({data:{...profile,blogNameChangeAvailableAt:undefined}},profile.id));
});

test("handle identifiers support underscores with safe edge rules",()=>{
  assert.equal(normalizeHandle("  pebble_log_  "),"pebble_log_");
  assert.equal(normalizeHandle("p-1"),"p-1");
  assert.equal(normalizeHandle("a"+"b".repeat(29)).length,30);
  for(const value of ["_pebble","pebble-","ab"]){assert.throws(()=>normalizeHandle(value));}
  for(const value of ["admin","api","auth","me","posts","search","settings","www"])assert.throws(()=>normalizeHandle(value));
  assert.equal(normalizeHandle("UPPER"),"upper");
});

test("profile return paths stay on safe internal pages",()=>{
  assert.equal(safeProfileReturnTo("/blogs/local_preview_?q=one"),"/blogs/local_preview_?q=one");
  for(const value of ["https://evil.example/path","//evil.example/path","/auth/naver/callback?code=secret","/oauth/callback/naver?state=x","/page?access_token=secret","/blogs/%2f%2fevil.example","/settings/profile","/\\evil.example"])assert.equal(safeProfileReturnTo(value),null);
});

test("profile names trim and normalize before counting Unicode code points",()=>{
  assert.equal(normalizeProfileName("  e\u0301  ","nickname"),"é");
  assert.equal(normalizeProfileName("😀".repeat(30),"nickname"),"😀".repeat(30));
  assert.throws(()=>normalizeProfileName("😀".repeat(31),"nickname"));
  assert.throws(()=>normalizeProfileName("  ","blogName"));
  assert.throws(()=>normalizeProfileName("\ud800","nickname"));
});

test("profile availability uses valid server timestamps and handles expired values",()=>{
  assert.equal(formatProfileAvailability(null),"변경 가능 시각을 확인할 수 없습니다. 다시 불러와 주세요.");
  assert.equal(formatProfileAvailability("2026-10-11T00:00:00Z",Date.parse("2026-10-12T00:00:00Z")),"지금 변경할 수 있어요.");
  assert.match(formatProfileAvailability("2026-10-11T00:00:00Z",Date.parse("2026-10-10T00:00:00Z")),/부터 변경할 수 있어요\.$/);
});
