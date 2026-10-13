import {guestJson,GuestApiError} from "../../../lib/public-api.ts";
import {parseStonePost,parseStoneView,type Stone,type StoneView} from "../stones.ts";
export async function getPublicStones(handle:string){if(!/^[a-z][a-z0-9_-]{1,28}[a-z0-9_]$/.test(handle))throw new GuestApiError("response");return parseStoneView(await guestJson(`blogs/${encodeURIComponent(handle)}/stones`,new URLSearchParams(),process.env.NEXT_PUBLIC_API_BASE_URL,fetch));}
export async function getMyStones(request:(path:string)=>Promise<unknown>){return parseStoneView(await request("/members/me/blog-stones"));}
export async function saveMyStones(view:Pick<StoneView,"version">&{stones:Stone[]},request:(path:string,options:{method:string;body:unknown})=>Promise<unknown>){return parseStoneView(await request("/members/me/blog-stones",{method:"PUT",body:{version:view.version,stones:view.stones}}));}
export async function getStonePosts(page:number,request:(path:string)=>Promise<unknown>){
 const result=await request(`/members/me/blog-stones/posts?page=${page}`) as {data?:{page?:number;content?:unknown[];hasNext?:boolean}};
 const data=result?.data;if(!data||data.page!==page||!Array.isArray(data.content)||data.content.length>100||typeof data.hasNext!=="boolean")throw new GuestApiError("response");
 return {content:data.content.map(parseStonePost),hasNext:data.hasNext};
}
