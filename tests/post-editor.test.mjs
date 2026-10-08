import test from "node:test";
import assert from "node:assert/strict";
import { buildPostBody, buildPostSaveBody, createEditorBlock, editorValueFromPost, normalizePostSlug, validateEditorValue, validatePostSlug } from "../src/features/post/post-editor-model.ts";

import {parseOwnPost} from "../src/features/post/api/member-posts.ts";

const author = { id: "1", handle: "pebble-user", nickname: "Pebble", blogName: null };
const basePost = { id: "10", urlKey: "first-post", title: "첫 글", summary: null, author, tags: [], publishedAt: null, createdAt: "2026-10-03T00:00:00Z" };

test("editor conversion preserves block order, content and architecture coordinates", () => {
  const blocks = [
    { type: "TEXT", content: "안녕하세요 🌱", language: null, title: null, displayOrder: 0 },
    { type: "ARCHITECTURE", content: JSON.stringify({ schemaVersion: 1, groups: [], nodes: [{ id: "api", type: "APP", label: "API", position: { x: 317, y: 428 } }], edges: [] }), language: null, title: "구성", displayOrder: 1 },
  ];
  const value = editorValueFromPost({ ...basePost, blocks });
  const body = buildPostBody(value);
  assert.deepEqual(body.blocks.map(block => block.type), ["TEXT", "ARCHITECTURE"]);
  assert.equal(body.blocks[0].content, "안녕하세요 🌱");
  assert.equal(body.blocks[0].alignment, "LEFT");
  assert.deepEqual(JSON.parse(body.blocks[1].content).nodes[0].position, { x: 317, y: 428 });
  assert.deepEqual(validateEditorValue(value), []);
});

test("representative image source defaults to the first body image and saves its image id",()=>{
  const first="https://api.example.com/api/v1/posts/10/images/2/content", second="https://api.example.com/api/v1/posts/10/images/3/content";
  const value={title:"글",summary:"",blocks:[{...createEditorBlock("HTML"),content:`<p><img src="${first}"></p><p><img src="${second}"></p>`}]};
  assert.equal(buildPostBody(value).thumbnailImageId,"2");
  assert.equal(buildPostBody({...value,thumbnailImageSrc:second}).thumbnailImageId,"3");
});

test("validation rejects invalid structured references and Unicode title overflow", () => {
  const block = createEditorBlock("ARCHITECTURE");
  block.content = JSON.stringify({ schemaVersion: 1, groups: [], nodes: [{ id: "api", type: "APP", label: "API", groupId: "missing" }], edges: [] });
  const value = { title: "🌋".repeat(201), summary: "", blocks: [block] };
  const errors = validateEditorValue(value);
  assert.ok(errors.some(error => error.includes("200자")));
  assert.ok(errors.some(error => error.includes("구조 블록")));
});

test("body omits editor-only keys while preserving optional block metadata", () => {
  const value = { title: "글", summary: "  요약  ", blocks: [{ ...createEditorBlock("CODE"), content: "const name = 'Pebble';", title: "예제", language: "TYPESCRIPT" }] };
  const body = buildPostBody(value);
  assert.deepEqual(body, { title: "글", thumbnailImageId: null, summary: null, blocks: [{ type: "CODE", content: "const name = 'Pebble';", language: "TYPESCRIPT", title: "예제", alignment: "LEFT" }] });
  assert.equal("key" in body.blocks[0], false);
  assert.equal("valid" in body.blocks[0], false);
  const centered = buildPostBody({ ...value, blocks: [{ ...value.blocks[0], alignment: "CENTER" }] });
  assert.equal(centered.blocks[0].alignment, "CENTER");
});


test("normal saves preserve existing visibility and publication must be explicit",()=>{
  const value={title:"게시할 글",summary:"요약",blocks:[createEditorBlock("TEXT")]};
  assert.equal(buildPostSaveBody(value).visibilityStatus,"HIDDEN");
  assert.equal("visibilityStatus" in buildPostSaveBody(value,{visibilityStatus:"PUBLIC",isBlocked:false}),false);
  assert.equal(buildPostSaveBody(value,{visibilityStatus:"HIDDEN",isBlocked:false},"PUBLIC").visibilityStatus,"PUBLIC");
  assert.equal(buildPostSaveBody(value,{visibilityStatus:"PUBLIC",isBlocked:false},"HIDDEN").visibilityStatus,"HIDDEN");
  const body=buildPostSaveBody(value,undefined,"PUBLIC");assert.equal(body.visibilityStatus,"PUBLIC");
  for(const field of ["isBlocked","categoryId","boardId","projectId","tagIds","slug"])assert.equal(field in body,false);
});
test("blocked publication and invalid content cannot be submitted",()=>{
  const value={title:"차단된 글",summary:"",blocks:[createEditorBlock("TEXT")]};
  const blocked={visibilityStatus:"PUBLIC",isBlocked:true};
  assert.throws(()=>buildPostSaveBody(value,blocked,"PUBLIC"),/차단/);
  assert.equal("visibilityStatus" in buildPostSaveBody(value,blocked),false);
  assert.equal(buildPostSaveBody(value,blocked,"HIDDEN").visibilityStatus,"HIDDEN");
  assert.throws(()=>buildPostSaveBody({...value,title:""},undefined,"PUBLIC"),/제목/);
  assert.throws(()=>buildPostSaveBody(value,undefined,"DELETED"),/공개/);
});


test("classification PATCH omits unchanged links, removes explicitly, and preserves tag order",()=>{
 const base={title:"분류 글",summary:"",blocks:[createEditorBlock("TEXT")]};
 const existing={visibilityStatus:"PUBLIC",isBlocked:false,category:{id:"100"},tags:[{id:"200"},{id:"300"}]};
 const unchanged={...base,categoryId:"100",tagIds:["200","300"]};
 const body=buildPostSaveBody(unchanged,existing);
 assert.equal("categoryId" in body,false);assert.equal("tagIds" in body,false);
 const removed=buildPostSaveBody({...base,categoryId:null,tagIds:[]},existing);
 assert.equal(removed.categoryId,null);assert.deepEqual(removed.tagIds,[]);
 const reordered=buildPostSaveBody({...unchanged,tagIds:["300","200"]},existing);
 assert.deepEqual(reordered.tagIds,["300","200"]);assert.equal("categoryId" in reordered,false);
 const created=buildPostSaveBody(unchanged);assert.equal(created.categoryId,"100");assert.deepEqual(created.tagIds,["200","300"]);
 assert.equal("boardId" in created,false);assert.equal("slug" in created,false);
});
test("classification restores saved ids and rejects duplicate or malformed selection",()=>{
 const post={...basePost,category:{id:"100"},tags:[{id:"300",name:"태그"}],blocks:[{...createEditorBlock("TEXT"),displayOrder:0}]};
 const value=editorValueFromPost(post);assert.equal(value.categoryId,"100");assert.deepEqual(value.tagIds,["300"]);
 assert.throws(()=>buildPostSaveBody({...value,tagIds:["300","300"]}),/태그/);
 assert.throws(()=>buildPostSaveBody({...value,categoryId:"0"}),/카테고리/);
 assert.throws(()=>buildPostSaveBody({...value,tagIds:["9223372036854775808"]}),/태그/);
});

test("own post classification parser preserves inactive links and refuses incomplete metadata",()=>{
 const data={...basePost,boardId:null,projectId:null,visibilityStatus:"HIDDEN",isBlocked:false,category:{id:"100",name:"기존 분류",status:"INACTIVE"},tags:[{id:"200",name:"기존 태그",status:"INACTIVE"}],blocks:[{type:"TEXT",content:"본문",language:null,title:null,displayOrder:0}]};
 const post=parseOwnPost({data});assert.equal(post.category.status,"INACTIVE");assert.equal(post.tags[0].status,"INACTIVE");
 assert.throws(()=>parseOwnPost({data:{...data,category:undefined}}));
 assert.throws(()=>parseOwnPost({data:{...data,tags:[{id:"200",name:"태그"}]}}));
 assert.throws(()=>parseOwnPost({data:{...data,tags:[...data.tags,...data.tags]}}));
});


test("project link restores from own post and defaults missing editor input to null",()=>{
 const blocks=[{...createEditorBlock("TEXT"),displayOrder:0}];
 assert.equal(editorValueFromPost({...basePost,projectId:"9223372036854775807",blocks}).projectId,"9223372036854775807");
 assert.equal(editorValueFromPost({...basePost,projectId:null,blocks}).projectId,null);
 assert.equal(editorValueFromPost({...basePost,blocks}).projectId,null);
});
test("project link saves on create and only sends changed PATCH values",()=>{
 const value={title:"프로젝트 글",summary:"",blocks:[createEditorBlock("TEXT")]};
 assert.equal(buildPostSaveBody({...value,projectId:"9223372036854775807"}).projectId,"9223372036854775807");
 assert.equal(buildPostSaveBody({...value,projectId:null}).projectId,null);
 assert.equal("projectId" in buildPostSaveBody(value),false);
 for(const projectId of ["0","01","9223372036854775808"]) assert.throws(()=>buildPostSaveBody({...value,projectId}),/프로젝트/);
 const existing={visibilityStatus:"HIDDEN",isBlocked:false,projectId:"9007199254740993"};
 assert.equal("projectId" in buildPostSaveBody({...value,projectId:"9007199254740993"},existing),false);
 assert.equal(buildPostSaveBody({...value,projectId:"9223372036854775807"},existing).projectId,"9223372036854775807");
 assert.equal(buildPostSaveBody({...value,projectId:null},existing).projectId,null);
 assert.equal("projectId" in buildPostSaveBody({...value,projectId:undefined},existing),false);
});
test("own post parser requires a nullable valid project id",()=>{
 const data={...basePost,boardId:null,projectId:null,visibilityStatus:"HIDDEN",isBlocked:false,category:null,tags:[],blocks:[{type:"TEXT",content:"본문",language:null,title:null,displayOrder:0}]};
 assert.equal(parseOwnPost({data}).projectId,null);
 assert.equal(parseOwnPost({data:{...data,projectId:"9223372036854775807"}}).projectId,"9223372036854775807");
 for(const projectId of [undefined, "", "0", "01", "9223372036854775808", 123, {}]) {
   const invalid={...data}; delete invalid.projectId;
   if(projectId !== undefined) invalid.projectId=projectId;
   assert.throws(()=>parseOwnPost({data:invalid}));
 }
});

test("draft API field defaults old responses to finalized and accepts explicit draft",()=>{
 const data={...basePost,boardId:null,projectId:null,visibilityStatus:"HIDDEN",isBlocked:false,category:null,tags:[],blocks:[{type:"HTML",content:"<p>body</p>",language:null,title:null,displayOrder:0}]};
 assert.equal(parseOwnPost({data}).draft,false);
 assert.equal(parseOwnPost({data:{...data,draft:true}}).draft,true);
 assert.throws(()=>parseOwnPost({data:{...data,draft:"true"}}));
 assert.equal(editorValueFromPost({...data,blocks:data.blocks}).blocks[0].type,"HTML");
});

test("HTML and Markdown blocks survive save conversion and slug rules are normalized",()=>{
 const value={title:"글",summary:"",blocks:[createEditorBlock("HTML"),{...createEditorBlock("MARKDOWN"),content:"# 제목"}]};
 assert.deepEqual(buildPostBody(value).blocks.map(block=>block.type),["HTML","MARKDOWN"]);
 assert.equal(normalizePostSlug("  My Pebble Blog! "),"my-pebble-blog");
 for(const slug of ["my-post","hello-42"])assert.equal(validatePostSlug(slug),true);
 for(const slug of ["123","search","UPPER","hyphen-","한글"])assert.equal(validatePostSlug(slug),false);
 const draft=buildPostSaveBody(value,undefined,{draft:true,visibility:"HIDDEN"});
 assert.equal(draft.draft,true);assert.equal(draft.visibilityStatus,"HIDDEN");
 assert.equal("slug" in buildPostSaveBody({...value,slug:"first-post"},undefined,{draft:true,visibility:"HIDDEN"}),false);
 assert.equal("slug" in buildPostSaveBody({...value,slug:"search"},undefined,{draft:true,visibility:"HIDDEN"}),false);
 const complete=buildPostSaveBody(value,{visibilityStatus:"HIDDEN",isBlocked:false,draft:true},{draft:false,finalize:true,visibility:"PUBLIC",slug:"First Post"});
 assert.equal(complete.draft,false);assert.equal(complete.slug,"first-post");assert.equal(complete.visibilityStatus,"PUBLIC");
 assert.throws(()=>buildPostSaveBody(value,{visibilityStatus:"PUBLIC",isBlocked:false,draft:false,urlKey:"old-post"},{draft:true}),/되돌릴/);
 assert.throws(()=>buildPostSaveBody(value,{visibilityStatus:"PUBLIC",isBlocked:false,draft:false,urlKey:"old-post"},{slug:"new-post"}),/주소/);
});
