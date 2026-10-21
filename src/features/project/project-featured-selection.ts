import {getMyBlogHome,saveMyBlogHome,type BlogHomeSettings} from '../blog-home/api/blog-home.ts';

export type FeaturedSelection = {featured:boolean;removedIds:string[]};

/** Apply explicit removals to the latest settings, preserving unrelated changes. */
export function selectedFeaturedIds(home:BlogHomeSettings,projectId:string,selection:FeaturedSelection,publicProject:boolean):string[]{
 const ids=home.featuredProjectIds.filter(id=>id!==projectId&&!selection.removedIds.includes(id));
 if(selection.featured&&publicProject)ids.push(projectId);
 // Existing projects retain their order when the selection has not changed.
 if(selection.featured&&publicProject&&home.featuredProjectIds.includes(projectId)){
  const position=home.featuredProjectIds.filter(id=>!selection.removedIds.includes(id)).indexOf(projectId);
  ids.splice(ids.indexOf(projectId),1);ids.splice(position,0,projectId);
 }
 if(selection.featured&&publicProject&&ids.length>home.featuredProjectLimit)throw new Error(`대표 프로젝트는 ${home.featuredProjectLimit}개까지 표시할 수 있어요. 기존 목록에서 하나 이상 해제해 주세요.`);
 return ids;
}

/** Finish the independent home-setting write after this project has already been saved. */
export async function saveProjectFeaturedSelection(project:{id:string;visibilityStatus:'PUBLIC'|'HIDDEN';isBlocked:boolean},selection:FeaturedSelection,request:(path:string,options?:{method:string;body:unknown})=>Promise<unknown>,current:()=>boolean):Promise<BlogHomeSettings|null>{
 const latest=await getMyBlogHome(path=>request(path));
 if(!current())return null;
 const featuredProjectIds=selectedFeaturedIds(latest,project.id,selection,project.visibilityStatus==='PUBLIC'&&!project.isBlocked);
 if(featuredProjectIds.join(',')===latest.featuredProjectIds.join(','))return latest;
 const updated=await saveMyBlogHome({...latest,featuredProjectIds},(path,options)=>request(path,options));
 if(!current())return null;
 if(updated.featuredProjectIds.join(',')!==featuredProjectIds.join(','))throw new Error('대표 설정 저장 결과가 일치하지 않습니다.');
 return updated;
}
