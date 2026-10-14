import type {EditorBlock} from '../post/post-editor-model.ts';
import {parsePostBlocks} from '../post/api/post-list.ts';
export const PROJECT_SECTIONS=[{key:'BACKGROUND',label:'배경 및 목적'},{key:'FEATURES',label:'핵심 기능'},{key:'ARCHITECTURE',label:'아키텍처'},{key:'DATABASE',label:'데이터베이스 설계'},{key:'OUTCOMES',label:'핵심 성과 및 트러블슈팅'},{key:'RETROSPECTIVE',label:'프로젝트 회고'}] as const;
export type ProjectSectionKey=typeof PROJECT_SECTIONS[number]['key'];
export type ProjectDocument={version:1;teamSize:number|null;role:string;sections:{key:ProjectSectionKey;blocks:EditorBlock[]}[]};
export function newProjectDocument():ProjectDocument{return {version:1,teamSize:null,role:'',sections:PROJECT_SECTIONS.map(({key})=>({key,blocks:[]}))};}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function parseProjectDocument(value:unknown):ProjectDocument{
 if(!object(value)||value.version!==1||JSON.stringify(value).length>350000||!(value.teamSize===null||Number.isInteger(value.teamSize)&&(value.teamSize as number)>=1&&(value.teamSize as number)<=10000)||typeof value.role!=='string'||Array.from(value.role).length>200||!Array.isArray(value.sections)||value.sections.length>6)throw new Error('프로젝트 문서를 확인해 주세요.');
 const seen=new Set<string>();
 const sections=value.sections.map(section=>{
  if(!object(section)||!PROJECT_SECTIONS.some(item=>item.key===section.key)||seen.has(section.key as string)||!Array.isArray(section.blocks)||section.blocks.length>100)throw new Error('프로젝트 섹션을 확인해 주세요.');
  const key=section.key as ProjectSectionKey;seen.add(key);
  const blocks=parsePostBlocks(section.blocks.map((block,index)=>{if(!object(block))throw new Error('본문을 확인해 주세요.');return {...block,title:block.title??null,language:block.language??null,displayOrder:index};})).map((block,index)=>({...block,key:`${key}-${index}`,valid:true}));
  return {key,blocks};
 });
 return {version:1,teamSize:value.teamSize as number|null,role:value.role,sections};
}
export function serializeProjectDocument(value:ProjectDocument){
 const document={...value,sections:value.sections.map(section=>({...section,blocks:section.blocks.map(({type,content,language,title,alignment})=>({type,content,language,title,alignment:alignment??'LEFT'}))}))};
 parseProjectDocument(document);return document;
}
export function legacyProjectDocument(project:{description?:string|null;architectureDescription?:string|null;features?:{title:string;description:string|null}[]}):ProjectDocument{
 const document=newProjectDocument();
 const texts:Partial<Record<ProjectSectionKey,string>>={BACKGROUND:project.description??'',ARCHITECTURE:project.architectureDescription??'',FEATURES:project.features?.map(f=>`${f.title}\n${f.description??''}`).join('\n\n')??''};
 document.sections.forEach(section=>{const content=texts[section.key];if(content)section.blocks=[{key:section.key,type:'TEXT',content,language:null,title:null,valid:true}];});
 return document;
}
