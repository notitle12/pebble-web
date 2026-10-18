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
 const base=newProjectDocument();for(const doc of [{...base,version:2},{...base,teamSize:0},{...base,role:'x'.repeat(10001)},{...base,sections:[base.sections[0],base.sections[0]]},{...base,sections:[{key:'UNKNOWN',blocks:[]}]}])assert.throws(()=>parseProjectDocument(doc));
});

test('직군별 인원과 복수 역할을 보존하고 잘못된 인원 합계를 거부한다',()=>{
 const doc={...newProjectDocument(),teamSize:4,teamComposition:[{role:'FRONTEND',count:1},{role:'BACKEND',count:2},{role:'DESIGN',count:1}],roles:['백엔드','DB 설계']};
 assert.deepEqual(parseProjectDocument(serializeProjectDocument(doc)).roles,doc.roles);assert.deepEqual(parseProjectDocument(doc).teamComposition,doc.teamComposition);
 for(const invalid of [{...doc,teamSize:5},{...doc,teamComposition:[{role:'BACKEND',count:-1}]},{...doc,roles:['백엔드','백엔드']},{...doc,roles:['x'.repeat(201)]}])assert.throws(()=>parseProjectDocument(invalid));
 const legacy=newProjectDocument();assert.equal(parseProjectDocument(legacy).teamComposition,undefined);
});

test('기존의 긴 자유 입력 역할도 새 역할 선택 이후 보존할 수 있다',()=>{
 const doc={...newProjectDocument(),role:'가'.repeat(150),roles:['가'.repeat(150),'백엔드']};assert.deepEqual(parseProjectDocument(doc).roles,doc.roles);
});

test('직군 이름을 직접 편집하고 빈 인원과 작업 서술을 저장한다',()=>{
 const doc={...newProjectDocument(),teamSize:2,teamComposition:[{role:'백엔드',count:2},{role:'프로덕트 디자인',count:0}],role:'실시간 API 설계 및 배포 자동화\n'.repeat(30)};
 assert.deepEqual(parseProjectDocument(doc).teamComposition,doc.teamComposition);assert.equal(parseProjectDocument(doc).role,doc.role);
});

test('빈 다이어그램 블록은 직렬화 시 제외되고 미완성 다이어그램은 한글 오류 메시지를 발생시킨다',()=>{
 const emptyDb={schemaVersion:1,display:'BOTH',tables:[{id:'t-1',name:'',description:'',position:{x:0,y:0},columns:[{id:'c-1',name:'',dataType:'',nullable:true,primaryKey:false,unique:false,description:'',reference:null}]}]};
 const emptyArch={schemaVersion:1,groups:[],nodes:[{id:'client',type:'CLIENT',label:'클라이언트',icon:'CLIENT',position:{x:56,y:80}}],edges:[]};
 const doc=newProjectDocument();
 doc.sections.find(s=>s.key==='DATABASE').blocks=[{key:'db',type:'DB_SCHEMA',content:JSON.stringify(emptyDb),language:null,title:null,valid:false}];
 doc.sections.find(s=>s.key==='ARCHITECTURE').blocks=[{key:'arch',type:'ARCHITECTURE',content:JSON.stringify(emptyArch),language:null,title:null,valid:true}];

 const serialized=serializeProjectDocument(doc);
 assert.equal(serialized.sections.find(s=>s.key==='DATABASE').blocks.length,0);
 assert.equal(serialized.sections.find(s=>s.key==='ARCHITECTURE').blocks.length,0);

 const incompleteDb={schemaVersion:1,display:'BOTH',tables:[{id:'t-1',name:'users',description:'',position:{x:0,y:0},columns:[{id:'c-1',name:'',dataType:'',nullable:true,primaryKey:false,unique:false,description:'',reference:null}]}]};
 const incompleteDoc=newProjectDocument();
 incompleteDoc.sections.find(s=>s.key==='DATABASE').blocks=[{key:'db',type:'DB_SCHEMA',content:JSON.stringify(incompleteDb),language:null,title:null,valid:false}];
 assert.throws(()=>parseProjectDocument(incompleteDoc),/데이터베이스 설계를 완성해 주세요/);
});


test('작성한 단일 client 노드와 잘못된 다이어그램을 조용히 버리지 않는다',()=>{
 const architecture={schemaVersion:1,groups:[],nodes:[{id:'client',type:'CLIENT',label:'직접 작성한 사용자',icon:'CLIENT',position:{x:56,y:80}}],edges:[]};
 const doc=newProjectDocument();
 doc.sections.find(s=>s.key==='ARCHITECTURE').blocks=[{key:'arch',type:'ARCHITECTURE',content:JSON.stringify(architecture),language:null,title:null,valid:true}];
 assert.equal(serializeProjectDocument(doc).sections.find(s=>s.key==='ARCHITECTURE').blocks.length,1);
 for(const type of ['ARCHITECTURE','DB_SCHEMA']){
  const invalid=newProjectDocument();invalid.sections[0].blocks=[{key:'bad',type,content:'{broken',language:null,title:null,valid:false}];
  assert.throws(()=>serializeProjectDocument(invalid));
 }
 const db={schemaVersion:1,display:'BOTH',tables:[{id:'t',name:'',description:'작성 중인 테이블',position:{x:0,y:0},columns:[]}]};
 const partial=newProjectDocument();partial.sections[0].blocks=[{key:'db',type:'DB_SCHEMA',content:JSON.stringify(db),language:null,title:null,valid:false}];
 assert.throws(()=>serializeProjectDocument(partial),/데이터베이스 설계를 완성/);
});
