import {validTagId} from "../../lib/list-query.ts";
import type {OwnProject} from "./api/member-projects.ts";
export type ProjectVisibility="PUBLIC"|"HIDDEN";
export type ProjectLifecycle="IN_PROGRESS"|"COMPLETED";
export type FeatureInput={title:string;description:string};
export type LinkInput={linkType:"GITHUB"|"DEPLOYMENT"|"DOWNLOAD"|"OTHER";label:string;url:string;displayOrder:number};
export type ProjectEditorValue={name:string;summary:string;description:string;architectureDescription:string;executionInstructions:string;lifecycleStatus:ProjectLifecycle;startedOn:string;completedOn:string;tagIds:string[];features:FeatureInput[];links:LinkInput[]};
export function emptyProject():ProjectEditorValue {return {name:"",summary:"",description:"",architectureDescription:"",executionInstructions:"",lifecycleStatus:"IN_PROGRESS",startedOn:"",completedOn:"",tagIds:[],features:[],links:[]};}
export function projectEditorValue(project:OwnProject):ProjectEditorValue {
  return {name:project.name,summary:project.summary??"",description:project.description??"",architectureDescription:project.architectureDescription??"",executionInstructions:project.executionInstructions??"",lifecycleStatus:project.lifecycleStatus,startedOn:project.startedOn??"",completedOn:project.completedOn??"",tagIds:project.tags.map(t=>t.id),features:project.features.map(f=>({title:f.title,description:f.description??""})),links:project.links.map(l=>({linkType:l.linkType as LinkInput["linkType"],label:l.label??"",url:l.url,displayOrder:l.displayOrder}))};
}
const safe=(v:string)=>!(/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v));
const length=(v:string)=>Array.from(v).length;
function text(v:string,max:number,label:string,required=false) {if(!safe(v)||length(v)>max||(required&&!v.trim()))throw new Error(`${label}: ${required?"빈 내용 없이 ":""}${max.toLocaleString("ko-KR")}자 이내로 입력해 주세요.`);}
function date(v:string,label:string) {if(v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))throw new Error(`${label}은 YYYY-MM-DD 날짜로 입력해 주세요.`);}
function linkUrl(v:string) {
  try {const url=new URL(v);return /^https?:\/\//i.test(v)&&url.hostname&&!/[\s<>"{}|^`]/u.test(v)&&!/%(?![0-9a-f]{2})/i.test(v)&&/^[\x21-\x7e]+$/.test(v.split("/")[2]??"")&&!url.username&&!url.password&&!v.includes("\\");}catch{return false;}
}
export function validateProject(value:ProjectEditorValue) {
  text(value.name,120,"프로젝트 이름",true);text(value.summary,500,"요약");text(value.description,20000,"프로젝트 소개");text(value.architectureDescription,20000,"기술 구성");text(value.executionInstructions,10000,"실행 방법");
  if(!["IN_PROGRESS","COMPLETED"].includes(value.lifecycleStatus))throw new Error("진행 중 또는 완료를 선택해 주세요.");
  date(value.startedOn,"시작일");date(value.completedOn,"완료일");
  if(value.tagIds.some(id=>!validTagId(id))||new Set(value.tagIds).size!==value.tagIds.length)throw new Error("기술 태그를 중복 없이 선택해 주세요.");
  for(const [i,f] of value.features.entries()){text(f.title,100,`${i+1}번째 기능 이름`,true);text(f.description,2000,`${i+1}번째 기능 설명`);}
  for(const [i,l] of value.links.entries()){
    text(l.label,100,`${i+1}번째 링크 이름`);text(l.url,2048,`${i+1}번째 링크 주소`,true);
    if(!["GITHUB","DEPLOYMENT","DOWNLOAD","OTHER"].includes(l.linkType)||!linkUrl(l.url)||!Number.isInteger(l.displayOrder)||l.displayOrder<0||l.displayOrder>2147483647)throw new Error(`${i+1}번째 링크는 사용자 정보가 없는 올바른 HTTP(S) 주소와 순서를 사용해 주세요.`);
  }
}
export function buildProjectSaveBody(value:ProjectEditorValue,existing?:OwnProject,visibility:ProjectVisibility=existing?.visibilityStatus??"HIDDEN") {
  validateProject(value);
  if(!["PUBLIC","HIDDEN"].includes(visibility))throw new Error("공개 또는 비공개를 선택해 주세요.");
  if(existing?.isBlocked&&visibility==="PUBLIC"&&existing.visibilityStatus!=="PUBLIC")throw new Error("차단된 프로젝트를 공개로 전환할 수 없습니다.");
  const nullable=(s:string)=>s===""?null:s;
  const body={name:value.name,summary:nullable(value.summary),description:nullable(value.description),architectureDescription:nullable(value.architectureDescription),executionInstructions:nullable(value.executionInstructions),lifecycleStatus:value.lifecycleStatus,startedOn:nullable(value.startedOn),completedOn:nullable(value.completedOn),tagIds:[...value.tagIds],features:value.features.map(f=>({...f})),links:value.links.map(l=>({...l,label:nullable(l.label)})),visibilityStatus:visibility};
  if(!existing)return body;
  const before=projectEditorValue(existing),patch:Record<string,unknown>={};
  for(const key of Object.keys(value) as (keyof ProjectEditorValue)[])if(JSON.stringify(value[key])!==JSON.stringify(before[key]))patch[key]=body[key];
  if(visibility!==existing.visibilityStatus)patch.visibilityStatus=visibility;
  return patch;
}
