import {GuestApiError} from "../../../lib/public-api.ts";
import {MemberApiError,responseData} from "../../../lib/member-api.ts";
import {parseProjectDetail,parseProjectPage,type ProjectDetail,type ProjectPage,type ProjectSummary} from "./project-list.ts";
import {validTagId} from "../../../lib/list-query.ts";
export type ProjectTag={id:string;name:string;status:"ACTIVE"|"INACTIVE"};
export type OwnProject=ProjectDetail&{visibilityStatus:"PUBLIC"|"HIDDEN";isBlocked:boolean;tags:ProjectTag[]};
export type OwnProjectSummary=ProjectSummary&{visibilityStatus:"PUBLIC"|"HIDDEN";isBlocked:boolean};
export type OwnProjectPage=Omit<ProjectPage,"content">&{content:OwnProjectSummary[]};
const invalid=()=>new MemberApiError(0,"INVALID_RESPONSE","본인 프로젝트 응답을 확인하지 못했습니다.");
export function projectId(value:string) {if(!validTagId(value))throw new MemberApiError(400,"INVALID_REQUEST","프로젝트 주소를 확인해 주세요.");return value;}
function own(d:Record<string,unknown>,memberId:string){
  if(typeof d.owner!=="object"||d.owner===null||!("id" in d.owner)||d.owner.id!==memberId||!["PUBLIC","HIDDEN"].includes(String(d.visibilityStatus))||typeof d.isBlocked!=="boolean")throw invalid();
}
export function parseOwnProject(value:unknown,memberId:string,expectedId?:string):OwnProject {
  const project=parseProjectDetail(value),d=responseData(value);own(d,memberId);
  if(expectedId!==undefined&&project.id!==expectedId)throw invalid();
  if(!Array.isArray(d.tags)||!d.tags.every(tag=>typeof tag==="object"&&tag!==null&&"status" in tag&&["ACTIVE","INACTIVE"].includes(String(tag.status)))||new Set(project.tags.map(t=>t.id)).size!==project.tags.length)throw invalid();
  return {...project,visibilityStatus:d.visibilityStatus as OwnProject["visibilityStatus"],isBlocked:d.isBlocked as boolean,tags:d.tags as ProjectTag[]};
}
export function parseOwnProjects(value:unknown,page:number,memberId:string):OwnProjectPage {
  const parsed=parseProjectPage(value,page);
  for(const project of parsed.content)own(project as unknown as Record<string,unknown>,memberId);
  if(new Set(parsed.content.map(p=>p.id)).size!==parsed.content.length)throw invalid();
  return parsed as OwnProjectPage;
}
export function projectWriteFailure(error:unknown) {
  if(error instanceof MemberApiError&&error.status===0)return "저장 결과를 확인하지 못했습니다. 입력은 유지됩니다. 다시 저장하기 전에 내 프로젝트에서 저장 여부를 확인해 주세요.";
  if(error instanceof MemberApiError&&error.status===404)return "프로젝트가 없거나 본인 프로젝트가 아닙니다.";
  if(error instanceof GuestApiError)return "프로젝트 응답을 확인하지 못했습니다. 다시 불러와 주세요.";
  return error instanceof Error?error.message:"프로젝트를 처리하지 못했습니다.";
}
