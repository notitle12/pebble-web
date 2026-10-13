import {apiUrl,MemberApiError} from '../../../lib/member-api.ts';
import {validId} from '../../../lib/list-query.ts';
import {safeMediaUrl} from '../../media/model.ts';
export function ownerPostImages(value:unknown,id:string):Record<string,string>{
 if(!validId(id)||typeof value!=="object"||value===null||!("data" in value)||!Array.isArray(value.data))throw new MemberApiError(0,"INVALID_RESPONSE","글 이미지를 확인하지 못했어요.");
 const result:Record<string,string>={};
 for(const row of value.data){if(typeof row!=="object"||row===null||typeof row.id!=="string"||!validId(row.id)||typeof row.url!=="string")throw new MemberApiError(0,"INVALID_RESPONSE","이미지 주소를 확인하지 못했어요.");const url=safeMediaUrl(row.url);if(url)result[apiUrl(`/posts/${id}/images/${row.id}/content`).href]=url;}
 return result;
}
