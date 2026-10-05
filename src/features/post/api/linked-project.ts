import {getPublicProject,type ProjectDetail} from "../../project/api/project-list.ts";
import {GuestApiError} from "../../../lib/public-api.ts";
import {validTagId} from "../../../lib/list-query.ts";

export type LinkedProject = {status:"visible";project:ProjectDetail}|{status:"absent"}|{status:"error"};
export async function readLinkedProject(id:string|null|undefined,baseUrl=process.env.NEXT_PUBLIC_API_BASE_URL,request:typeof fetch=fetch):Promise<LinkedProject>{
  if(id==null)return {status:"absent"};
  if(typeof id!=="string"||!validTagId(id))return {status:"error"};
  try{return {status:"visible",project:await getPublicProject(id,baseUrl,request)};}
  catch(error){return error instanceof GuestApiError&&error.kind==="not-found"?{status:"absent"}:{status:"error"};}
}
