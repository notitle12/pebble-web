import {MemberApiError,responseData} from "../../lib/member-api.ts";

export type MediaRole="THUMBNAIL"|"SCREENSHOT";
export type ProjectMedia={id:string;mediaRole:MediaRole;altText:string|null;displayOrder:number;url:string|null;thumbnailUrl:string|null;createdAt:string};
export type ContentMedia={postThumbnailUrl:string|null;projectMedia:ProjectMedia[]};
const invalid=()=>new MemberApiError(0,"INVALID_RESPONSE","콘텐츠 미디어 응답을 확인하지 못했습니다. 다시 조회해 주세요.");
const record=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null&&!Array.isArray(value);
const validId=(value:unknown):value is string=>typeof value==="string"&&/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n;
const nullableString=(value:unknown):value is string|null=>value===null||typeof value==="string";
const instant=(value:unknown):value is string=>typeof value==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
export function safeMediaUrl(value:string|null):string|null{
  if(value===null)return null;
  try{const url=new URL(value);return ["https:","http:"].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
export function parseProjectMedia(value:unknown):ProjectMedia{
  if(!record(value)||!validId(value.id)||!(value.mediaRole==="THUMBNAIL"||value.mediaRole==="SCREENSHOT")||!nullableString(value.altText)||!Number.isInteger(value.displayOrder)||typeof value.displayOrder!=="number"||value.displayOrder<0||value.displayOrder>2147483647||!nullableString(value.url)||!nullableString(value.thumbnailUrl)||!instant(value.createdAt))throw invalid();
  return {id:value.id,mediaRole:value.mediaRole,altText:value.altText,displayOrder:value.displayOrder,url:value.url,thumbnailUrl:value.thumbnailUrl,createdAt:value.createdAt};
}
export function mediaFileError(file:File):string|null{
  if(!["image/jpeg","image/png","image/webp"].includes(file.type))return "JPEG, PNG, WebP 파일만 업로드할 수 있습니다.";
  if(file.size>10*1024*1024)return "이미지는 10MiB 이하만 업로드할 수 있습니다.";
  if(file.size===0)return "빈 파일은 업로드할 수 없습니다.";
  return null;
}
export function mediaFailure(error:unknown):{message:string;uncertain:boolean}{
  if(error instanceof MemberApiError&&error.code==="STORAGE_UNAVAILABLE")return {message:"이미지 저장소를 사용할 수 없어 미디어를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",uncertain:false};
  if(error instanceof MemberApiError&&(error.status===0||error.status>=500))return {message:"요청 결과를 확인하지 못했습니다. 중복 변경을 막기 위해 미디어를 다시 조회한 뒤 작업을 재개해 주세요.",uncertain:true};
  if(error instanceof MemberApiError&&error.status===413)return {message:"이미지가 너무 큽니다. 10MiB 이하 파일을 선택해 주세요.",uncertain:false};
  if(error instanceof MemberApiError&&error.status===415)return {message:"JPEG, PNG, WebP 파일만 업로드할 수 있습니다.",uncertain:false};
  if(error instanceof MemberApiError&&error.status===404)return {message:"콘텐츠가 없거나 본인 소유가 아닙니다.",uncertain:false};
  return {message:error instanceof Error?error.message:"미디어를 처리하지 못했습니다.",uncertain:false};
}

export function parseThumbnailResponse(value:unknown):string|null {
 const data=responseData(value);if(!nullableString(data.thumbnailUrl))throw invalid();return data.thumbnailUrl;
}
export function parseMediaResponse(value:unknown,expectedId?:string):ProjectMedia {
 const media=parseProjectMedia(responseData(value));if(expectedId!==undefined&&media.id!==expectedId)throw invalid();return media;
}
export function mediaOrder(value:string):number {
 if(!/^(0|[1-9]\d*)$/.test(value)||Number(value)>2147483647)throw new Error("표시 순서는 0 이상의 정수를 입력해 주세요.");return Number(value);
}
export function validMediaOrder(value:string):boolean {try{mediaOrder(value);return true;}catch{return false;}}

export function validMediaAlt(value:string):boolean {
 return Array.from(value.trim()).length<=300&&!/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value);
}
