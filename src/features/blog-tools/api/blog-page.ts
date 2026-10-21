import {GuestApiError} from '../../../lib/public-api.ts';
import {getPublicBlogProfile,getPublicBlogPosts} from '../../post/api/public-blog.ts';
import {getPublicBoards,getBoardPosts,flattenBoards} from '../../board/api/boards.ts';
import {getPublicMemberProjects} from '../../project/api/project-list.ts';
import {getPublicBlogHome} from '../../blog-home/api/blog-home.ts';
import {getPublicBlogLinks} from './blog-tools.ts';

type Query={handle:string;page:number;homeView:boolean;projectView:boolean;selected?:string;q?:string};
export async function loadBlogPageData({handle,page,homeView,projectView,selected,q}:Query,base=process.env.NEXT_PUBLIC_API_BASE_URL,request:typeof fetch=fetch) {
  const author=await getPublicBlogProfile(handle,base,request);
  // These public reads are independent once the blog owner is known.
  const sidebarProjectsRequest=getPublicMemberProjects(author.id,0,base,request);
  const [linksResult,boardsResult,sidebarResult,homeResult,postsResult,projectsResult]=await Promise.allSettled([
    getPublicBlogLinks(handle,base,request),
    getPublicBoards(author.id,base,request),
    sidebarProjectsRequest,
    homeView?getPublicBlogHome(handle,base,request):Promise.resolve(null),
    homeView||projectView?Promise.resolve(undefined):selected?getBoardPosts(author.id,selected,page,base,request):getPublicBlogPosts(handle,page,base,request,q),
    projectView?(page===0?sidebarProjectsRequest:getPublicMemberProjects(author.id,page,base,request)):Promise.resolve(undefined),
  ]);
  if(selected&&boardsResult.status==='rejected')throw boardsResult.reason;
  const boards=boardsResult.status==='fulfilled'?boardsResult.value:[];
  if(selected&&!flattenBoards(boards).some(board=>board.id===selected))throw new GuestApiError('not-found');
  if(postsResult.status==='rejected')throw postsResult.reason;
  return {
    author,boards,boardError:boardsResult.status==='rejected',
    links:linksResult.status==='fulfilled'?linksResult.value:null,linksError:linksResult.status==='rejected',
    sidebarProjects:sidebarResult.status==='fulfilled'?sidebarResult.value:undefined,projectError:sidebarResult.status==='rejected',
    home:homeResult.status==='fulfilled'?homeResult.value:null,homeError:homeResult.status==='rejected',
    result:postsResult.value,
    projectsResult:projectsResult.status==='fulfilled'?projectsResult.value:undefined,projectsError:projectsResult.status==='rejected',
  };
}
