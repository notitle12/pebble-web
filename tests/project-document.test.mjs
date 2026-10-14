import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newProjectDocument,parseProjectDocument,serializeProjectDocument,legacyProjectDocument} from '../src/features/project/project-document.ts';
import {emptyProject,buildProjectSaveBody} from '../src/features/project/project-editor-model.ts';
import {projectImageValue,replaceProjectImageBlocks} from '../src/features/project/project-images.ts';

test('구조화 문서는 편집기 키·미리보기 URL을 저장하지 않고 이미지와 섹션을 보존한다',()=>{
 const document=newProjectDocument();document.teamSize=3;document.role='백엔드';document.sections[0].blocks=[{key:'local',valid:true,type:'HTML',content:'<img src="https://api.example/api/v1/projects/10/media/20/content">',title:null,language:null,imagePreviews:{secret:'blob:local'}}];
 const body=serializeProjectDocument(document);assert.equal(JSON.stringify(body).includes('blob:'),false);assert.equal('key' in body.sections[0].blocks[0],false);
 const parsed=parseProjectDocument(body);assert.equal(parsed.sections[0].blocks[0].content,document.sections[0].blocks[0].content);assert.equal(parsed.teamSize,3);
 const value={...emptyProject(),name:'이름',document};assert.deepEqual(buildProjectSaveBody(value).document,body);
});
test('이전 소개·기술 구성·기능을 새 섹션으로 이어서 편집한다',()=>{
 const doc=legacyProjectDocument({description:'배경',architectureDescription:'구조',features:[{title:'검색',description:'검색 설명'}]});
 assert.equal(doc.sections.find(s=>s.key==='BACKGROUND').blocks[0].content,'배경');assert.equal(doc.sections.find(s=>s.key==='ARCHITECTURE').blocks[0].content,'구조');assert.match(doc.sections.find(s=>s.key==='FEATURES').blocks[0].content,/검색 설명/);
});
test('이미지 업로드 후 원래 섹션 순서와 빈 섹션을 보존한다',()=>{
 const value=emptyProject();value.document.sections[0].blocks=[{key:'a',type:'HTML',content:'pending',title:null,language:null,valid:true}];value.document.sections[3].blocks=[{key:'b',type:'TEXT',content:'DB',title:null,language:null,valid:true}];
 const image=projectImageValue(value);image.blocks=image.blocks.map(b=>({...b,content:b.content.replace('pending','uploaded')}));const replaced=replaceProjectImageBlocks(value,image);
 assert.equal(replaced.document.sections[0].blocks[0].content,'uploaded');assert.equal(replaced.document.sections[1].blocks.length,0);assert.equal(replaced.document.sections[3].blocks[0].content,'DB');
});
test('잘못된 섹션·중복·인원·긴 역할을 거부한다',()=>{
 const base=newProjectDocument();for(const doc of [{...base,version:2},{...base,teamSize:0},{...base,role:'x'.repeat(201)},{...base,sections:[base.sections[0],base.sections[0]]},{...base,sections:[{key:'UNKNOWN',blocks:[]}]}])assert.throws(()=>parseProjectDocument(doc));
});
