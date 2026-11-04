import test from 'node:test';
import assert from 'node:assert/strict';
import {validDraftValue,cleanDraftValue,matchesDraft,draftKey} from '../src/lib/writer-drafts.ts';
import {emptyProject} from '../src/features/project/project-editor-model.ts';
import {createPendingImages,pendingImagePrefix} from '../src/features/post/pending-images.ts';
const block=()=>({key:'draft',type:'DB_SCHEMA',content:'{"unfinished":true}',valid:false,title:null,language:null,imagePreviews:{secret:'blob:expired'},editorTab:'SPEC'});
const value=()=>({title:'아직 작성 중',summary:'',tags:['Java'],blocks:[block()]});
test('drafts accept unfinished diagrams and invalid form values but reject corrupt structure',()=>{
 assert.equal(validDraftValue('post',value()),true);
 const project=emptyProject();project.name='';project.startedOn='2026-';project.document.sections[0].blocks=[block()];
 assert.equal(validDraftValue('project',project),true);
 assert.equal(validDraftValue('post',{...value(),blocks:[{...block(),content:null}]}),false);
 assert.equal(validDraftValue('post',{...value(),tags:[42]}),false);
 assert.equal(validDraftValue('project',{...project,document:null}),false);
 const cleaned=cleanDraftValue(project);assert.equal(cleaned.document.sections[0].blocks[0].imagePreviews,undefined);assert.equal(cleaned.document.sections[0].blocks[0].valid,false);assert.equal(cleaned.document.sections[0].blocks[0].editorTab,'SPEC');
 assert.ok(project.document.sections[0].blocks[0].imagePreviews);
});
test('account, content type and document scopes isolate recovery; new drafts follow their created server ID',()=>{
 const scope={memberId:'1',kind:'post'};
 const record={...scope,version:1,key:draftKey(scope,'tab1'),savedAt:1,value:value(),images:[],contentId:'99'};
 assert.equal(matchesDraft(scope,record),true);assert.equal(matchesDraft({...scope,targetId:'99'},record),true);
 for(const other of [{...scope,memberId:'2'},{...scope,kind:'project'},{...scope,targetId:'100'}])assert.equal(matchesDraft(other,record),false);
 assert.notEqual(draftKey(scope,'tab1'),draftKey(scope,'tab2'));
});
test('image files survive a durable clone, receive fresh blob URLs and remain uploadable',async()=>{
 const original=createPendingImages(()=> 'blob:old',()=>{});const file=new File(['file-bytes'],'photo.jpg',{type:'image/jpeg',lastModified:123});const staged=original.stage(file);
 const draft={...value(),thumbnailImageSrc:staged.src,blocks:[{...block(),type:'HTML',content:`<img src="${staged.src}">`}]};
 const records=structuredClone(original.snapshot(draft));original.dispose();
 const restored=createPendingImages(()=> 'blob:new',()=>{});const previews=restored.restore(records);
 assert.equal(previews[staged.src],'blob:new');assert.equal(await restored.getFile(staged.src).text(),'file-bytes');assert.equal(restored.getFile(staged.src).name,'photo.jpg');
 const uploaded=await restored.resolve(draft,async file=>{assert.equal(file.type,'image/jpeg');return {src:'https://api.example.com/1',previewUrl:'https://cdn.example.com/1'};});
 assert.ok(!uploaded.blocks[0].content.includes(pendingImagePrefix));assert.equal(uploaded.thumbnailImageSrc,'https://api.example.com/1');
 restored.dispose();
});
test('completed uploads survive recovery and are not uploaded twice after a failed save',async()=>{
 const before=createPendingImages(()=> 'blob:one',()=>{});const image=before.stage(new File(['x'],'x.jpg',{type:'image/jpeg'}));const draft={...value(),blocks:[{...block(),content:image.src}]};
 await before.resolve(draft,async()=>({src:'https://api.example.com/uploaded',previewUrl:'https://cdn.example.com/signed'}));
 const after=createPendingImages(()=> 'blob:two',()=>{});after.restore(structuredClone(before.snapshot(draft)));
 const result=await after.resolve(draft,async()=>{throw Error('must not upload again');});assert.equal(result.blocks[0].content,'https://api.example.com/uploaded');before.dispose();after.dispose();
});

test('only the newest document checkpoint survives a delayed write from another tab',async()=>{
 const {newestDraft}=await import('../src/lib/writer-drafts.ts');
 const base={memberId:'member',kind:'post',targetId:'post-1',key:'tab-a',savedAt:100,value:{title:'a',summary:'',blocks:[]},images:[],version:1};
 const recent={...base,key:'tab-b',savedAt:200};
 assert.equal(newestDraft([recent],base),recent);
 assert.equal(newestDraft([base],recent),recent);
 assert.equal(newestDraft([{...recent,targetId:'post-2'},{...recent,memberId:'other'},{...recent,kind:'project'}],base),base);
 assert.equal(newestDraft([{...recent,targetId:undefined,contentId:'post-1'}],base).key,'tab-b');
});
