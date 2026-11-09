import test from 'node:test';
import assert from 'node:assert/strict';
import {clampDiagramWidth,resizedDiagramWidth} from '../src/features/post/diagram-width.ts';
import {parseArchitectureSpec} from '../src/features/post/api/post-list.ts';
import {parseDatabaseSchema} from '../src/features/post/database-schema.ts';
import {newProjectDocument,parseProjectDocument,serializeProjectDocument} from '../src/features/project/project-document.ts';
import {blocksToDocument,documentToBlocks} from '../src/features/post/writer-document.ts';
import {readMermaidSource,writeMermaidSource} from '../src/features/post/mermaid-source.ts';

const architecture={schemaVersion:1,groups:[],nodes:[{id:'client',type:'CLIENT',label:'Client'}],edges:[]};
const database={schemaVersion:1,display:'ERD',tables:[{id:'members',name:'members',description:'',position:{x:0,y:0},columns:[{id:'id',name:'id',dataType:'BIGINT',nullable:false,primaryKey:true,unique:true,description:'',reference:null}]}]};

test('diagram width is an optional 25 to 100 percent value in both structured contracts',()=>{
  assert.equal(parseArchitectureSpec(architecture).displayWidth,undefined);
  assert.equal(parseDatabaseSchema(database).displayWidth,undefined);
  assert.equal(parseArchitectureSpec({...architecture,displayWidth:64}).displayWidth,64);
  assert.equal(parseDatabaseSchema({...database,displayWidth:72}).displayWidth,72);
  for(const bad of [24,101,1.5,'80',true]){
    assert.throws(()=>parseArchitectureSpec({...architecture,displayWidth:bad}));
    assert.throws(()=>parseDatabaseSchema({...database,displayWidth:bad}));
  }
});

test('drag width uses integer percentage and clamps to responsive bounds',()=>{
  assert.equal(clampDiagramWidth(50.6),51);
  assert.equal(resizedDiagramWidth(50,100,500),70);
  assert.equal(resizedDiagramWidth(30,-500,500),25);
  assert.equal(resizedDiagramWidth(95,500,500),100);
});

test('project document round-trips diagram display width in structured content',()=>{
  const document=newProjectDocument();
  const spec={...architecture,displayWidth:64};
  document.sections.find(section=>section.key==='ARCHITECTURE').blocks=[{key:'architecture',type:'ARCHITECTURE',content:JSON.stringify(spec),language:null,title:null,valid:true}];
  const saved=serializeProjectDocument(parseProjectDocument(document));
  assert.equal(JSON.parse(saved.sections.find(section=>section.key==='ARCHITECTURE').blocks[0].content).displayWidth,64);
});

test('Mermaid keeps its source and width across editor and project document saves',()=>{
  const source='sequenceDiagram\n  actor User as 사용자\n  User->>API: 요청';
  const legacy={key:'mermaid',type:'CODE',language:'MERMAID',content:source,title:null,valid:true};
  const rich=blocksToDocument([legacy],()=>{throw new Error('Mermaid is a diagram node');});
  assert.equal(rich.content[0].type,'mermaidDiagram');
  assert.deepEqual(readMermaidSource(legacy.content),{source,width:100});
  rich.content[0].attrs.width=63;
  const [saved]=documentToBlocks(rich,()=>{throw new Error('Mermaid keeps the CODE API format');});
  assert.equal(saved.language,'MERMAID');
  assert.deepEqual(readMermaidSource(saved.content),{source,width:63});
  assert.equal(writeMermaidSource(source,100),source);
  const project=newProjectDocument();
  project.sections.find(section=>section.key==='ARCHITECTURE').blocks=[saved];
  const [roundTrip]=parseProjectDocument(serializeProjectDocument(project)).sections.find(section=>section.key==='ARCHITECTURE').blocks;
  assert.deepEqual(readMermaidSource(roundTrip.content),{source,width:63});
});
