import type {EditorBlock} from '../post/post-editor-model.ts';
import {parsePostBlocks} from '../post/api/post-list.ts';
export const PROJECT_SECTIONS=[{key:'BACKGROUND',label:'배경 및 목적'},{key:'FEATURES',label:'핵심 기능'},{key:'ARCHITECTURE',label:'아키텍처'},{key:'DATABASE',label:'데이터베이스 설계'},{key:'OUTCOMES',label:'핵심 성과 및 트러블슈팅'},{key:'RETROSPECTIVE',label:'프로젝트 회고'}] as const;
export type ProjectSectionKey=typeof PROJECT_SECTIONS[number]['key'];
export const PROJECT_TEAM_ROLES=[{key:'FRONTEND',label:'프론트엔드'},{key:'BACKEND',label:'백엔드'},{key:'DESIGN',label:'디자이너'},{key:'PLANNING',label:'기획자'},{key:'MOBILE',label:'모바일'},{key:'AI_DATA',label:'AI·데이터'},{key:'DEVOPS',label:'DevOps·인프라'},{key:'QA',label:'QA'},{key:'PM',label:'PM'},{key:'OTHER',label:'기타'}] as const;
export const PROJECT_ROLE_OPTIONS=['프론트엔드','백엔드','풀스택','모바일','UI/UX 디자인','기획','PM','DevOps·인프라','DB 설계','QA','AI·데이터'] as const;
export type TeamRole=typeof PROJECT_TEAM_ROLES[number]['key'];
export type ProjectDocument={version:1;teamSize:number|null;role:string;teamComposition?:{role:TeamRole;count:number}[];roles?:string[];sections:{key:ProjectSectionKey;blocks:EditorBlock[]}[]};
export function newProjectDocument():ProjectDocument{return {version:1,teamSize:null,role:'',sections:PROJECT_SECTIONS.map(({key})=>({key,blocks:[]}))};}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function parseProjectDocument(value:unknown):ProjectDocument{
 if(!object(value)||value.version!==1||JSON.stringify(value).length>350000||!(value.teamSize===null||Number.isInteger(value.teamSize)&&(value.teamSize as number)>=1&&(value.teamSize as number)<=10000)||typeof value.role!=='string'||Array.from(value.role).length>200||!Array.isArray(value.sections)||value.sections.length>6)throw new Error('프로젝트 문서를 확인해 주세요.');
 if(value.teamComposition!==undefined){
  if(!Array.isArray(value.teamComposition)||value.teamComposition.length>10)throw new Error('직군별 인원을 확인해 주세요.');
  const jobs=new Set<string>();let total=0;
  for(const item of value.teamComposition){if(!object(item)||!PROJECT_TEAM_ROLES.some(job=>job.key===item.role)||jobs.has(item.role as string)||!Number.isInteger(item.count)||(item.count as number)<1||(item.count as number)>10000)throw new Error('직군별 인원은 중복 없이 1명 이상 입력해 주세요.');jobs.add(item.role as string);total+=item.count as number;}
  if(total>10000||value.teamSize!==(total||null))throw new Error('직군별 인원 합계를 확인해 주세요.');
 }
 if(value.roles!==undefined&&(!Array.isArray(value.roles)||value.roles.length>10||new Set(value.roles).size!==value.roles.length||value.roles.some(role=>typeof role!=='string'||!role.trim()||role!==role.trim()||Array.from(role).length>40)))throw new Error('나의 역할은 중복 없이 10개, 각 40자 이내로 선택해 주세요.');
 const seen=new Set<string>();
 const sections=value.sections.map(section=>{
  if(!object(section)||!PROJECT_SECTIONS.some(item=>item.key===section.key)||seen.has(section.key as string)||!Array.isArray(section.blocks)||section.blocks.length>100)throw new Error('프로젝트 섹션을 확인해 주세요.');
  const key=section.key as ProjectSectionKey;seen.add(key);
  const blocks=parsePostBlocks(section.blocks.map((block,index)=>{if(!object(block))throw new Error('본문을 확인해 주세요.');return {...block,title:block.title??null,language:block.language??null,displayOrder:index};})).map((block,index)=>({...block,key:`${key}-${index}`,valid:true}));
  return {key,blocks};
 });
 return {version:1,teamSize:value.teamSize as number|null,role:value.role,...(value.teamComposition!==undefined?{teamComposition:value.teamComposition as ProjectDocument["teamComposition"]}:{}),...(value.roles!==undefined?{roles:value.roles as string[]}:{}),sections};
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
