import type {EditorBlock} from '../post/post-editor-model.ts';
import {parsePostBlocks,parseArchitectureSpec,parseTableSpec} from '../post/api/post-list.ts';
import {parseDatabaseSchema,isDatabaseSchemaEmpty} from '../post/database-schema.ts';
export const PROJECT_SECTIONS=[{key:'BACKGROUND',label:'배경 및 목적'},{key:'FEATURES',label:'핵심 기능'},{key:'ARCHITECTURE',label:'아키텍처'},{key:'DATABASE',label:'데이터베이스 설계'},{key:'OUTCOMES',label:'핵심 성과 및 트러블슈팅'},{key:'RETROSPECTIVE',label:'프로젝트 회고'}] as const;
export type ProjectSectionKey=typeof PROJECT_SECTIONS[number]['key'];
export const PROJECT_TEAM_ROLES=[{key:'FRONTEND',label:'프론트엔드'},{key:'BACKEND',label:'백엔드'},{key:'DESIGN',label:'디자이너'},{key:'PLANNING',label:'기획자'},{key:'MOBILE',label:'모바일'},{key:'AI_DATA',label:'AI·데이터'},{key:'DEVOPS',label:'DevOps·인프라'},{key:'QA',label:'QA'},{key:'PM',label:'PM'},{key:'OTHER',label:'기타'}] as const;
export type TeamRole=typeof PROJECT_TEAM_ROLES[number]['key'];
export type ProjectDocument={version:1;teamSize:number|null;role:string;teamComposition?:{role:string;count:number}[];roles?:string[];sections:{key:ProjectSectionKey;blocks:EditorBlock[]}[]};
export function newProjectDocument():ProjectDocument{return {version:1,teamSize:null,role:'',sections:PROJECT_SECTIONS.map(({key})=>({key,blocks:[]}))};}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function parseProjectDocument(value:unknown):ProjectDocument{
 if(!object(value)||value.version!==1||JSON.stringify(value).length>350000||!(value.teamSize===null||Number.isInteger(value.teamSize)&&(value.teamSize as number)>=1&&(value.teamSize as number)<=10000)||typeof value.role!=='string'||Array.from(value.role).length>10000||!Array.isArray(value.sections)||value.sections.length>6)throw new Error('프로젝트 문서를 확인해 주세요.');
 if(value.teamComposition!==undefined){
  if(!Array.isArray(value.teamComposition)||value.teamComposition.length>20)throw new Error('직군별 인원을 확인해 주세요.');
  const jobs=new Set<string>();let total=0;
  for(const item of value.teamComposition){if(!object(item)||typeof item.role!=="string"||!item.role.trim()||item.role!==item.role.trim()||Array.from(item.role).length>40||jobs.has(item.role.toLowerCase())||!Number.isInteger(item.count)||(item.count as number)<0||(item.count as number)>10000)throw new Error('직군별 인원은 중복 없이 0명 이상 입력해 주세요.');jobs.add((item.role as string).toLowerCase());total+=item.count as number;}
  if(total>10000||value.teamSize!==(total||null))throw new Error('직군별 인원 합계를 확인해 주세요.');
 }
 if(value.roles!==undefined&&(!Array.isArray(value.roles)||value.roles.length>10||new Set(value.roles).size!==value.roles.length||value.roles.some(role=>typeof role!=='string'||!role.trim()||role!==role.trim()||Array.from(role).length>200)))throw new Error('나의 역할은 중복 없이 10개, 각 200자 이내로 선택해 주세요.');
 const seen=new Set<string>();
 const sections=value.sections.map(section=>{
  if(!object(section)||!PROJECT_SECTIONS.some(item=>item.key===section.key)||seen.has(section.key as string)||!Array.isArray(section.blocks)||section.blocks.length>100)throw new Error('프로젝트 섹션을 확인해 주세요.');
  const key=section.key as ProjectSectionKey;seen.add(key);
  for (const block of section.blocks) {
   if (object(block) && typeof block.content === "string") {
    if (block.type === "DB_SCHEMA") {
     try { parseDatabaseSchema(JSON.parse(block.content)); } catch { throw new Error("데이터베이스 설계를 완성해 주세요. (테이블명, 컬럼명, 자료형 입력 필요)"); }
    } else if (block.type === "ARCHITECTURE") {
     try { parseArchitectureSpec(JSON.parse(block.content)); } catch { throw new Error("아키텍처 다이어그램을 완성해 주세요."); }
    } else if (block.type === "TABLE") {
     try { parseTableSpec(JSON.parse(block.content)); } catch { throw new Error("테이블 명세를 완성해 주세요."); }
    }
   }
  }
  const blocks=parsePostBlocks(section.blocks.map((block,index)=>{if(!object(block))throw new Error('본문을 확인해 주세요.');return {...block,title:block.title??null,language:block.language??null,displayOrder:index};})).map((block,index)=>({...block,key:`${key}-${index}`,valid:true}));
  return {key,blocks};
 });
 return {version:1,teamSize:value.teamSize as number|null,role:value.role,...(value.teamComposition!==undefined?{teamComposition:value.teamComposition as ProjectDocument["teamComposition"]}:{}),...(value.roles!==undefined?{roles:value.roles as string[]}:{}),sections};
}
export function isProjectArchitectureEmpty(value: unknown): boolean {
 if (!object(value) || value.schemaVersion !== 1 || !Array.isArray(value.groups) || !Array.isArray(value.edges) || !Array.isArray(value.nodes)) return false;
 if (value.groups.length || value.edges.length) return false;
 if (value.nodes.length === 0) return true;
 if (value.nodes.length !== 1 || !object(value.nodes[0])) return false;
 const node = value.nodes[0];
 return node.id === 'client' && node.type === 'CLIENT' && node.label === '클라이언트' && node.icon === 'CLIENT'
  && (node.description == null || node.description === '') && node.groupId == null && node.typeLabel == null && object(node.position) && node.position.x === 56 && node.position.y === 80;
}
export function serializeProjectDocument(value:ProjectDocument){
 const document={
  ...value,
  sections: value.sections.map(section => ({
   ...section,
   blocks: section.blocks
    .filter(block => {
     if (block.type === 'DB_SCHEMA') {
      try { return !isDatabaseSchemaEmpty(JSON.parse(block.content)); } catch { return true; }
     }
     if (block.type === 'ARCHITECTURE') {
      try { return !isProjectArchitectureEmpty(JSON.parse(block.content)); } catch { return true; }
     }
     return true;
    })
    .map(({type,content,language,title,alignment})=>({type,content,language,title,alignment:alignment??'LEFT'}))
  }))
 };
 parseProjectDocument(document);
 return document;
}
export function legacyProjectDocument(project:{description?:string|null;architectureDescription?:string|null;features?:{title:string;description:string|null}[]}):ProjectDocument{
 const document=newProjectDocument();
 const texts:Partial<Record<ProjectSectionKey,string>>={BACKGROUND:project.description??'',ARCHITECTURE:project.architectureDescription??'',FEATURES:project.features?.map(f=>`${f.title}\n${f.description??''}`).join('\n\n')??''};
 document.sections.forEach(section=>{const content=texts[section.key];if(content)section.blocks=[{key:section.key,type:'TEXT',content,language:null,title:null,valid:true}];});
 return document;
}
