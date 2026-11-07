import {GuestApiError} from '../../../lib/public-api.ts';
import {getPopularPublicBlogPosts,getPublicBlogProfile,getPublicBlogPosts} from '../../post/api/public-blog.ts';
import {getPublicBoards,getBoardPosts,flattenBoards} from '../../board/api/boards.ts';
import {getPublicMemberProjects,getPublicProject} from '../../project/api/project-list.ts';
import {getPublicBlogHome,visibleHomeDataLoads,featuredProjectIdsForHome} from '../../blog-home/api/blog-home.ts';
import {getPublicBlogLinks} from './blog-tools.ts';

type Query={handle:string;page:number;homeView:boolean;projectView:boolean;selected?:string;q?:string};
// Attach rejection handlers immediately, including when a missing profile ends the render.
const settled = async <T>(request: Promise<T>) => (await Promise.allSettled([request]))[0];

export async function loadBlogPageData({handle,page,homeView,projectView,selected,q}:Query,base=process.env.NEXT_PUBLIC_API_BASE_URL,request:typeof fetch=fetch) {
  const profileRequest=getPublicBlogProfile(handle,base,request);
  // Handle-based reads do not depend on the profile or the sidebar.
  const linksRequest=settled(getPublicBlogLinks(handle,base,request));
  const homeRequest=settled(homeView?getPublicBlogHome(handle,base,request):Promise.resolve(null));
  const postsRequest=!homeView&&!projectView&&!selected
    ?settled(getPublicBlogPosts(handle,page,base,request,q)):null;
  const author=await profileRequest;
  const boardsRequest=settled(getPublicBoards(author.id,base,request));
  const sidebarProjectsRequest=settled(getPublicMemberProjects(author.id,0,base,request));
  const boardPostsRequest=!homeView&&!projectView&&selected
    ?settled(getBoardPosts(author.id,selected,page,base,request)):null;

  // The page can stream the sidebar without holding up the main content.
  const sidebar=Promise.all([linksRequest,boardsRequest,sidebarProjectsRequest]).then(([links,boards,projects])=>({
    links:links.status==='fulfilled'?links.value:null,linksError:links.status==='rejected',
    boards:boards.status==='fulfilled'?boards.value:[],boardError:boards.status==='rejected',
    sidebarProjects:projects.status==='fulfilled'?projects.value:undefined,projectError:projects.status==='rejected',
  }));

  // Home sections start as soon as their settings are available. Popular posts
  // and featured projects stream independently and hidden sections do no work.
  const home=homeRequest.then(result=>{
    if(result.status==='rejected'||!result.value)return null;
    const settings=result.value;
    const visible=visibleHomeDataLoads(settings);
    const posts=settled(visible.recentPosts
      ?getPopularPublicBlogPosts(handle,base,request):Promise.resolve(null))
      .then(result=>({posts:result.status==='fulfilled'?result.value:null,failed:result.status==='rejected'}));
    const projects=Promise.allSettled(visible.featuredProjects?featuredProjectIdsForHome(settings).map(id=>
      getPublicProject(id,base,request).then(project=>{
        if(project.owner.id!==author.id)throw new GuestApiError('response');
        return project;
      })):[]).then(results=>({
        projects:results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]),
        errors:results.filter(result=>result.status==='rejected').length,
      }));
    return {settings,posts,projects};
  });

  // Keep essential not-found checks ahead of the new streaming boundaries.
  // The existing route-level loading boundary controls the final HTTP status.
  let boards:Awaited<ReturnType<typeof getPublicBoards>>=[];
  if(selected){
    const result=await boardsRequest;
    if(result.status==='rejected')throw result.reason;
    boards=result.value;
    if(!flattenBoards(boards).some(board=>board.id===selected))throw new GuestApiError('not-found');
  }
  const postsResult=await (postsRequest??boardPostsRequest);
  if(postsResult?.status==='rejected')throw postsResult.reason;
  const projectsResult=projectView
    ?await (page===0?sidebarProjectsRequest:settled(getPublicMemberProjects(author.id,page,base,request))):null;
  return {
    author,sidebar,home,boards,
    result:postsResult?.status==='fulfilled'?postsResult.value:undefined,
    projectsResult:projectsResult?.status==='fulfilled'?projectsResult.value:undefined,
    projectsError:projectsResult?.status==='rejected',
  };
}

export type BlogPageData=Awaited<ReturnType<typeof loadBlogPageData>>;
