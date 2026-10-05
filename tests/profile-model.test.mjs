import test from "node:test";
import assert from "node:assert/strict";
import {formatProfileAvailability,normalizeProfileName,parseEditableMemberProfile} from "../src/features/member/profile-model.ts";

const profile={id:"9007199254740993",nickname:"수달",blogName:"Pebble 블로그",handle:"pebble-blog",status:"ACTIVE",profileCompleted:true,nicknameChangeAvailableAt:"2026-10-11T00:00:00Z",blogNameChangeAvailableAt:"2026-10-11T00:00:00Z"};

test("profile response validates account identity and cooldown timestamps",()=>{
  assert.deepEqual(parseEditableMemberProfile({data:profile},profile.id),{id:profile.id,nickname:profile.nickname,blogName:profile.blogName,handle:profile.handle,nicknameChangeAvailableAt:profile.nicknameChangeAvailableAt,blogNameChangeAvailableAt:profile.blogNameChangeAvailableAt});
  assert.throws(()=>parseEditableMemberProfile({data:{...profile,id:"42"}},profile.id));
  assert.throws(()=>parseEditableMemberProfile({data:{...profile,nicknameChangeAvailableAt:"tomorrow"}},profile.id));
  assert.throws(()=>parseEditableMemberProfile({data:{...profile,blogNameChangeAvailableAt:null}},profile.id));
  assert.throws(()=>parseEditableMemberProfile({data:{...profile,blogNameChangeAvailableAt:undefined}},profile.id));
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
