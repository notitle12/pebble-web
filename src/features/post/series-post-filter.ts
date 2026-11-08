import type {OwnPostPage} from "./api/member-posts.ts";
export type SeriesPostState="all"|"public"|"hidden"|"draft"|"blocked";
export function filterSeriesCandidates(rows:OwnPostPage["content"],seriesId:string,query:string,state:SeriesPostState,connection:string,board="all"){
 const term=query.trim().normalize("NFC").toLocaleLowerCase();
 return rows.filter(post=>post.seriesId!==seriesId&&(!term||post.title.normalize("NFC").toLocaleLowerCase().includes(term))
  &&(state==="all"||state==="draft"&&post.draft||state==="blocked"&&post.isBlocked||state==="public"&&!post.draft&&!post.isBlocked&&post.visibilityStatus==="PUBLIC"||state==="hidden"&&!post.draft&&!post.isBlocked&&post.visibilityStatus==="HIDDEN")
  &&(connection==="all"||(connection==="none"?!post.seriesId:post.seriesId===connection))
  &&(board==="all"||(board==="none"?post.boardId===null:post.boardId===board)));
}
