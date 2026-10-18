import {GuestApiError} from "../../../lib/public-api.ts";
import {MemberApiError,responseData} from "../../../lib/member-api.ts";
import {parseProjectDetail,parseProjectPage,type ProjectDetail,type ProjectPage,type ProjectSummary} from "./project-list.ts";
import {validId} from "../../../lib/list-query.ts";
export type ProjectTechStack={id:string;name:string;status:"ACTIVE"|"INACTIVE"};
export type OwnProject=ProjectDetail&{visibilityStatus:"PUBLIC"|"HIDDEN";isBlocked:boolean;techStacks:ProjectTechStack[]};
export type OwnProjectSummary=ProjectSummary&{displayOrder:number;visibilityStatus:"PUBLIC"|"HIDDEN";isBlocked:boolean};
export type OwnProjectPage=Omit<ProjectPage,"content">&{content:OwnProjectSummary[]};
const invalid=()=>new MemberApiError(0,"INVALID_RESPONSE","본인 프로젝트 응답을 확인하지 못했습니다.");
export function projectId(value:string) {if(!validId(value))throw new MemberApiError(400,"INVALID_REQUEST","프로젝트 주소를 확인해 주세요.");return value;}
function own(d:Record<string,unknown>,memberId:string){
  if(typeof d.owner!=="object"||d.owner===null||!("id" in d.owner)||d.owner.id!==memberId||!["PUBLIC","HIDDEN"].includes(String(d.visibilityStatus))||typeof d.isBlocked!=="boolean")throw invalid();
}
export function parseOwnProject(value:unknown,memberId:string,expectedId?:string):OwnProject {
  const project=parseProjectDetail(value),d=responseData(value);own(d,memberId);
  if(expectedId!==undefined&&project.id!==expectedId)throw invalid();
  if(!Array.isArray(d.techStacks)||!d.techStacks.every(tag=>typeof tag==="object"&&tag!==null&&"status" in tag&&["ACTIVE","INACTIVE"].includes(String(tag.status)))||new Set(project.techStacks.map(t=>t.id)).size!==project.techStacks.length)throw invalid();
  return {...project,visibilityStatus:d.visibilityStatus as OwnProject["visibilityStatus"],isBlocked:d.isBlocked as boolean,techStacks:d.techStacks as ProjectTechStack[]};
}
export function parseOwnProjects(value:unknown,page:number,memberId:string):OwnProjectPage {
  const parsed=parseProjectPage(value,page);
  for(const project of parsed.content){
    const row=project as unknown as Record<string,unknown>;own(row,memberId);
    if(typeof row.displayOrder!=="number"||!Number.isSafeInteger(row.displayOrder)||row.displayOrder<0)throw invalid();
  }
  if(new Set(parsed.content.map(p=>p.id)).size!==parsed.content.length)throw invalid();
  return parsed as OwnProjectPage;
}
export function projectWriteFailure(error:unknown) {
  if(error instanceof MemberApiError&&error.status===0)return "저장 결과를 확인하지 못했습니다. 입력은 유지됩니다. 다시 저장하기 전에 내 프로젝트에서 저장 여부를 확인해 주세요.";
  if(error instanceof MemberApiError&&error.status===404)return "프로젝트가 없거나 본인 프로젝트가 아닙니다.";
  if(error instanceof GuestApiError)return "프로젝트 입력 내용을 확인해 주세요.";
  if(error instanceof Error&&error.message==="response")return "프로젝트 입력 내용을 확인해 주세요.";
  return error instanceof Error?error.message:"프로젝트를 처리하지 못했습니다.";
}
