import {MemberApiError} from "../../lib/member-api.ts";
import {validTagId} from "../../lib/list-query.ts";
export function contentPath(kind:"posts"|"projects",id:string):string {
  if(!["posts","projects"].includes(kind)||!validTagId(id))throw new MemberApiError(400,"INVALID_REQUEST","콘텐츠 주소를 확인해 주세요.");
  return `/${kind}/${id}`;
}
export function postPosition(value:string,total:number):number {
  if(!/^[1-9]\d*$/.test(value))throw new Error("1부터 전체 글 수 사이의 순서를 입력해 주세요.");
  const position=Number(value);
  if(!Number.isSafeInteger(position)||position>total||position>2147483647)throw new Error("전체 글 수 안의 순서를 입력해 주세요.");
  return position-1;
}
export function confirmDeletion(value:unknown):void {
  if(value!==null)throw new MemberApiError(0,"INVALID_RESPONSE","삭제 결과를 확인하지 못했습니다. 목록을 다시 불러와 주세요.");
}
