import {MemberApiError,responseData} from "../../lib/member-api.ts";
import {parseOwnPost} from "../post/api/member-posts.ts";
import {parseOwnProject} from "../project/api/member-projects.ts";
import {parseProjectMedia,type ContentMedia} from "./model.ts";
const invalid=()=>new MemberApiError(0,"INVALID_RESPONSE","콘텐츠 미디어 응답을 확인하지 못했습니다.");
const nullableString=(value:unknown):value is string|null=>value===null||typeof value==="string";
export function parseOwnedMedia(kind:"posts"|"projects",value:unknown,memberId:string,id:string):ContentMedia{
  const data=responseData(value);
  if(kind==="posts"){
    const post=parseOwnPost(value);
    if(post.id!==id||post.author.id!==memberId||!nullableString(data.thumbnailUrl))throw invalid();
    return {postThumbnailUrl:data.thumbnailUrl,projectMedia:[]};
  }
  const project=parseOwnProject(value,memberId,id);
  if(!Array.isArray(data.media))throw invalid();
  const media=data.media.map(parseProjectMedia);
  if(new Set(media.map(item=>item.id)).size!==media.length||media.filter(item=>item.mediaRole==="THUMBNAIL").length>1)throw invalid();
  return {postThumbnailUrl:null,projectMedia:media};
}
