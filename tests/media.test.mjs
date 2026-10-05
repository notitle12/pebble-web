import test from "node:test";
import assert from "node:assert/strict";
import {MemberApiError} from "../src/lib/member-api.ts";
import {mediaFailure,mediaFileError,parseProjectMedia,safeMediaUrl} from "../src/features/media/model.ts";

import {parseOwnedMedia} from "../src/features/media/owned-media.ts";

const project={id:"10",name:"Pebble",summary:null,owner:{id:"7",nickname:"Owner"},tags:[],lifecycleStatus:"IN_PROGRESS",publishedAt:null,createdAt:"2026-10-03T00:00:00Z",description:null,architectureDescription:null,executionInstructions:null,startedOn:null,completedOn:null,features:[],links:[],visibilityStatus:"HIDDEN",isBlocked:false};
const media={id:"11",mediaRole:"SCREENSHOT",altText:null,displayOrder:0,url:null,thumbnailUrl:null,createdAt:"2026-10-03T00:00:00Z"};

test("project media validates the contract and keeps hidden signed URLs nullable",()=>{
  assert.deepEqual(parseProjectMedia(media),media);
  const parsed=parseOwnedMedia("projects",{data:{...project,media:[media]}},"7","10");
  assert.equal(parsed.projectMedia[0].url,null);
  assert.throws(()=>parseProjectMedia({...media,mediaRole:"OTHER"}));
  assert.throws(()=>parseProjectMedia({...media,displayOrder:-1}));
  assert.throws(()=>parseProjectMedia({...media,createdAt:"yesterday"}));
  assert.throws(()=>parseOwnedMedia("projects",{data:{...project,media:[media]}},"8","10"));
  assert.throws(()=>parseOwnedMedia("projects",{data:{...project,media:[media,{...media}]}},"7","10"));
  assert.throws(()=>parseOwnedMedia("projects",{data:{...project,media:[media,{...media,id:"12",mediaRole:"THUMBNAIL"},{...media,id:"13",mediaRole:"THUMBNAIL"}]}},"7","10"));
});

test("post thumbnail parsing checks owner and nullable URL",()=>{
  const post={id:"20",urlKey:"first-post",title:"Post",summary:null,author:{id:"7",handle:"owner",nickname:"Owner",blogName:null},tags:[],publishedAt:null,createdAt:"2026-10-03T00:00:00Z",blocks:[],boardId:null,projectId:null,visibilityStatus:"HIDDEN",isBlocked:false,thumbnailUrl:null,category:null};
  assert.equal(parseOwnedMedia("posts",{data:post},"7","20").postThumbnailUrl,null);
  assert.throws(()=>parseOwnedMedia("posts",{data:{...post,author:{...post.author,id:"8"}}},"7","20"));
  assert.throws(()=>parseOwnedMedia("posts",{data:{...post,thumbnailUrl:8}},"7","20"));
});

test("image URLs allow absolute HTTP(S) without credentials and reject active schemes",()=>{
  assert.equal(safeMediaUrl("https://images.example/a.webp"),"https://images.example/a.webp");
  for(const value of ["javascript:alert(1)","data:image/png;base64,AA","//images.example/a","https://user:secret@images.example/a","/relative"])assert.equal(safeMediaUrl(value),null);
  assert.equal(safeMediaUrl(null),null);
});

test("file hints enforce supported MIME types and the 10 MiB limit",()=>{
  const file=(type,size)=>({type,size});
  assert.equal(mediaFileError(file("image/jpeg",1024)),null);
  assert.equal(mediaFileError(file("image/svg+xml",1024))?.includes("JPEG"),true);
  assert.equal(mediaFileError(file("image/png",10*1024*1024+1))?.includes("10MiB"),true);
  assert.equal(mediaFileError(file("image/webp",0))?.includes("빈 파일"),true);
});

test("storage outage is a definite failure while lost writes stay uncertain",()=>{
  assert.deepEqual(mediaFailure(new MemberApiError(503,"STORAGE_UNAVAILABLE","disabled")),{message:"이미지 저장소를 사용할 수 없어 미디어를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",uncertain:false});
  assert.equal(mediaFailure(new MemberApiError(0,"NETWORK","offline")).uncertain,true);
});

 test("미디어 표시 순서는 빈 값·지수·소수 표기를 거부한다",async()=>{const {mediaOrder}=await import('../src/features/media/model.ts');assert.equal(mediaOrder('0'),0);for(const value of ['', '01','1e1','1.5','2147483648'])assert.throws(()=>mediaOrder(value));});

 test("이미지 설명은 서버의 300 코드 포인트 제한을 따른다",async()=>{const {validMediaAlt}=await import('../src/features/media/model.ts');assert.equal(validMediaAlt('😀'.repeat(300)),true);assert.equal(validMediaAlt('😀'.repeat(301)),false);assert.equal(validMediaAlt('\u0000'),false);assert.equal(validMediaAlt('\ud800'),false);});
