import assert from "node:assert/strict";
import {test} from "node:test";
import {createProjectGalleryPending} from "../src/features/project/project-gallery-pending.ts";

test("갤러리 파일을 여러 개 스테이징하고 자동저장본에서 업로드 상태와 함께 복구",()=>{
  const pending=createProjectGalleryPending();
  pending.stage([
    new File(["one"],"one.png",{type:"image/png",lastModified:10}),
    new File(["two"],"two.webp",{type:"image/webp",lastModified:20}),
  ]);
  const first=pending.values()[0];
  pending.markUploaded(first.key,{id:"721389012345680001"});
  const restored=createProjectGalleryPending();
  const rows=restored.restore(pending.snapshot());
  assert.equal(rows.length,2);
  assert.equal(rows[0].file.name,"one.png");
  assert.equal(rows[0].uploadedMediaId,"721389012345680001");
  assert.equal(restored.snapshot()[1].name,"two.webp");
});

test("갤러리 파일 수와 파일 종류를 제한",()=>{
  const pending=createProjectGalleryPending();
  assert.throws(()=>pending.stage([new File(["x"],"bad.gif",{type:"image/gif"})]),/JPEG, PNG, WebP/);
  assert.throws(()=>pending.stage(Array.from({length:21},(_,i)=>new File(["x"],`${i}.png`,{type:"image/png"}))),/최대 20개/);
});
