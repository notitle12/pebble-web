import type {OwnPost} from "./api/member-posts.ts";
import {validId} from "../../lib/list-query.ts";

export function postEditorExitHref(post:Pick<OwnPost,"id"|"draft"|"visibilityStatus"|"isBlocked"|"author"|"urlKey">|null):string {
  if(!post||!validId(post.id))return "/me/posts";
  if(!post.draft&&post.visibilityStatus==="PUBLIC"&&!post.isBlocked)return `/blogs/${encodeURIComponent(post.author.handle)}/posts/${encodeURIComponent(post.urlKey)}`;
  return `/posts/${post.id}/view`;
}
