import {guestJson,GuestApiError} from "../../../lib/public-api.ts";
import {parsePage,validTagId} from "../../../lib/list-query.ts";
import {parsePostPage,type PostPage} from "../../post/api/post-list.ts";
export async function getProjectPosts(id:string,page:number,baseUrl=process.env.NEXT_PUBLIC_API_BASE_URL,request:typeof fetch=fetch):Promise<PostPage> {
  if(!validTagId(id) || parsePage(String(page))===null) throw new GuestApiError("response");
  return parsePostPage(await guestJson(`projects/${id}/posts`,new URLSearchParams({page:String(page),size:"20"}),baseUrl,request),page);
}
