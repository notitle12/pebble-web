import { guestJson, GuestApiError } from "../../../lib/public-api.ts";
import { parseListQuery, validTagId } from "../../../lib/list-query.ts";
export type ProjectQuery = { page: number; q?: string; tagId?: string; lifecycleStatus?: "IN_PROGRESS" | "COMPLETED" };
export type ProjectSummary = { id: string; name: string; summary: string | null; owner: { id: string; nickname: string }; tags: {id: string; name: string}[]; lifecycleStatus: "IN_PROGRESS" | "COMPLETED"; publishedAt: string | null; createdAt: string };
export type ProjectPage = { content: ProjectSummary[]; page: number; size: number; totalElements: number; totalPages: number; hasNext: boolean; hasPrevious: boolean };
export function parseProjectQuery(params: Record<string,string|string[]|undefined>): ProjectQuery | null {
  const { lifecycleStatus, ...rest } = params;
  const query = parseListQuery(rest);
  if (!query || Array.isArray(lifecycleStatus) || (lifecycleStatus && !["IN_PROGRESS","COMPLETED"].includes(lifecycleStatus))) return null;
  return { ...query, lifecycleStatus: (lifecycleStatus || undefined) as ProjectQuery["lifecycleStatus"] };
}
export function projectPageHref(page: number, query: Partial<ProjectQuery> = {}): string {
  const params = new URLSearchParams();
  if(query.q) params.set("q",query.q);
  if(query.tagId) params.set("tagId",query.tagId);
  if(query.lifecycleStatus) params.set("lifecycleStatus",query.lifecycleStatus);
  if(page>0) params.set("page",String(page));
  return params.size ? `/projects?${params}` : "/projects";
}
const record = (value: unknown): value is Record<string,unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
function isProject(value: unknown): value is ProjectSummary & Record<string,unknown> {
  return record(value) && typeof value.id === "string" && validTagId(value.id) && typeof value.name === "string"
    && (value.summary === null || typeof value.summary === "string") && record(value.owner)
    && typeof value.owner.id === "string" && validTagId(value.owner.id) && typeof value.owner.nickname === "string"
    && ["IN_PROGRESS","COMPLETED"].includes(String(value.lifecycleStatus))
    && Array.isArray(value.tags) && value.tags.every(tag=>record(tag) && typeof tag.id === "string" && validTagId(tag.id) && typeof tag.name === "string")
    && (value.publishedAt === null || timestamp(value.publishedAt)) && timestamp(value.createdAt);
}
export function parseProjectPage(value: unknown, page: number): ProjectPage {
  if(!record(value) || !record(value.data)) throw new GuestApiError("response");
  const data = value.data;
  if(!Array.isArray(data.content) || !data.content.every(isProject) || data.content.length>20 || data.page!==page || data.size!==20
    || !count(data.totalElements) || !count(data.totalPages) || data.totalPages!==Math.ceil(data.totalElements/20)
    || data.hasNext!==(page+1<data.totalPages) || data.hasPrevious!==(page>0)) throw new GuestApiError("response");
  return {content:data.content,page,size:20,totalElements:data.totalElements,totalPages:data.totalPages,hasNext:data.hasNext,hasPrevious:data.hasPrevious};
}
export async function getPublicProjects(query: ProjectQuery, baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL, request: typeof fetch = fetch): Promise<ProjectPage> {
  const validated = parseProjectQuery({...query,page:String(query.page)});
  if(!validated) throw new GuestApiError("response");
  const params = new URLSearchParams({page:String(query.page),size:"20"});
  if(validated.q) params.set("q",validated.q);
  if(validated.tagId) params.set("tagId",validated.tagId);
  if(validated.lifecycleStatus) params.set("lifecycleStatus",validated.lifecycleStatus);
  return parseProjectPage(await guestJson(validated.q ? "projects/search" : "projects",params,baseUrl,request),query.page);
}

export type ProjectFeature = {id:string;title:string;description:string|null;displayOrder:number};
export type ProjectLink = {id:string;linkType:string;label:string|null;url:string;displayOrder:number};
export type ProjectDetail = ProjectSummary & {likeCount?:number;likedByMe?:boolean;description:string|null;architectureDescription:string|null;executionInstructions:string|null;startedOn:string|null;completedOn:string|null;features:ProjectFeature[];links:ProjectLink[]};
const nullableText = (value:unknown) => value===null || value===undefined || typeof value==="string";
const dateOnly = (value:unknown) => value===null || (typeof value==="string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value);
export function projectHref(id:string,page=0):string|null {
  return validTagId(id) ? `/projects/${id}${page>0 ? `?page=${page}` : ""}` : null;
}
export function safeExternalUrl(value:string):string|null {
  try {const url=new URL(value);return ["http:","https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;} catch {return null;}
}
export function parseProjectDetail(value:unknown):ProjectDetail {
  if(!record(value) || !isProject(value.data)) throw new GuestApiError("response");
  const data=value.data;
  if(data.likeCount!==undefined && (typeof data.likeCount!=="number" || !Number.isSafeInteger(data.likeCount) || data.likeCount<0) || data.likedByMe!==undefined && typeof data.likedByMe!=="boolean") throw new GuestApiError("response");
  if(![data.description,data.architectureDescription,data.executionInstructions].every(nullableText) || !dateOnly(data.startedOn) || !dateOnly(data.completedOn)
    || !Array.isArray(data.features) || !data.features.every(feature=>record(feature) && typeof feature.id==="string" && validTagId(feature.id) && typeof feature.title==="string" && nullableText(feature.description) && count(feature.displayOrder))
    || !Array.isArray(data.links) || !data.links.every(link=>record(link) && typeof link.id==="string" && validTagId(link.id) && ["GITHUB","DEPLOYMENT","DOWNLOAD","OTHER"].includes(String(link.linkType)) && nullableText(link.label) && typeof link.url==="string" && count(link.displayOrder))) throw new GuestApiError("response");
  return {...data,description:data.description??null,architectureDescription:data.architectureDescription??null,executionInstructions:data.executionInstructions??null} as ProjectDetail;
}
export async function getPublicProject(id:string,baseUrl=process.env.NEXT_PUBLIC_API_BASE_URL,request:typeof fetch=fetch):Promise<ProjectDetail> {
  if(!projectHref(id)) throw new GuestApiError("not-found");
  const project=parseProjectDetail(await guestJson(`projects/${id}`,new URLSearchParams(),baseUrl,request));
  if(project.id!==id) throw new GuestApiError("response");
  return project;
}
