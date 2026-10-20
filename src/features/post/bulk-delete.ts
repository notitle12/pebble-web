import {contentPath,confirmDeletion} from "../content/management-model.ts";

/** Delete only the explicitly selected visible IDs, stopping on failure or session change. */
export async function deleteSelectedPosts(ids:string[],request:(path:string,options:{method:string})=>Promise<unknown>,current:()=>boolean){
 const unique=[...new Set(ids)];
 if(!unique.length||unique.length>20)throw new Error("이 페이지에서 삭제할 글을 선택해 주세요.");
 const paths=unique.map(id=>contentPath("posts",id));
 const deleted:string[]=[];
 for(let index=0;index<unique.length;index++){
  if(!current())return {deleted,interrupted:true,error:undefined};
  try{confirmDeletion(await request(paths[index],{method:"DELETE"}));deleted.push(unique[index]);}
  catch(error){return {deleted,interrupted:false,error};}
 }
 return {deleted,interrupted:false,error:undefined};
}
