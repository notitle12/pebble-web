import assert from "node:assert/strict";
import {test} from "node:test";
import {normalizeTags,normalizeTagName,splitTagInput,restoreDraftTags} from "../src/features/post/post-tags.ts";
import {buildPostSaveBody,createEditorBlock} from "../src/features/post/post-editor-model.ts";
test("자유 태그는 원문 대소문자 보존, # 제거, 중복 제거, 20개·50자 제한",()=>{
 assert.deepEqual(normalizeTags(splitTagInput("#회고 #JPA, 삽질기록 #회고")),["회고","JPA","삽질기록"]);
 assert.equal(normalizeTagName(" ##React "),"React");
 for(const values of [["#"],["x".repeat(51)],["a\nb"],["\ud800"],Array.from({length:21},(_,i)=>`tag${i}`)])assert.throws(()=>normalizeTags(values));
});
test("게시글 저장은 카탈로그 생성 없이 tags 배열을 전송하고 수정 생략·비우기·순서를 구별",()=>{
 const value={title:"글",summary:"",tags:["회고","JPA"],blocks:[createEditorBlock("TEXT")]};
 const existing={visibilityStatus:"HIDDEN",isBlocked:false,tags:["회고","JPA"]};
 assert.deepEqual(buildPostSaveBody(value).tags,["회고","JPA"]);
 assert.equal("tags" in buildPostSaveBody(value,existing),false);
 assert.deepEqual(buildPostSaveBody({...value,tags:[]},existing).tags,[]);
 assert.deepEqual(buildPostSaveBody({...value,tags:["JPA","회고"]},existing).tags,["JPA","회고"]);
 assert.equal("tagIds" in buildPostSaveBody(value),false);
});

test("이전 브라우저 초안의 연결 태그와 미발행 태그를 이름으로 복원",()=>{
 assert.deepEqual(restoreDraftTags({tagIds:["1"],pendingTagNames:["회고"]},[{id:"1",name:"Java"}]),["Java","회고"]);
 assert.throws(()=>restoreDraftTags({tagIds:["missing"]}),/태그 이름/);
});
