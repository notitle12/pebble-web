const destinations = new Set(["/", "/posts", "/search", "/projects", "/tech-stacks", "/categories", "/me/blog", "/me/posts", "/posts/new", "/me/projects","/me/boards", "/settings/profile", "/settings/blog", "/settings/blog/home", "/settings/blog/links", "/settings/blog/stones", "/settings/account", "/agreements", "/projects/new"]);
const positiveId=(value:string)=>/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n;
export function loginDestination(value: string | null): string {
  if(!value)return "/me/posts";
  if(destinations.has(value))return value;
  const ownPost=/^\/posts\/([1-9]\d{0,18})\/(?:edit|view)$/.exec(value);
  if(ownPost&&positiveId(ownPost[1]))return value;
  const project=/^\/projects\/([1-9]\d{0,18})(?:\/(?:edit|view))?$/.exec(value);
  if(project&&positiveId(project[1]))return value;
  const blog=/^\/blogs\/([a-z][a-z0-9_-]{1,28}[a-z0-9_])(?:\/projects)?$/.exec(value);
  if(blog)return value;
  const post=/^\/blogs\/[a-z][a-z0-9_-]{1,28}[a-z0-9_]\/posts\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(value);
  if(post&&post[1].length<=200&&post[1]!=="search"&&(!/^\d+$/.test(post[1])||positiveId(post[1])))return value;
  return "/me/posts";
}

export function memberActionDestination(destination:string,member:{agreementsAccepted:boolean;profileCompleted:boolean;handle?:string|null}):string {
  const safe=loginDestination(destination);
  if(!member.agreementsAccepted)return `/agreements?returnTo=${encodeURIComponent(safe)}`;
  if(!member.profileCompleted)return `/settings/profile?returnTo=${encodeURIComponent(safe)}`;
  if(safe==="/me/blog"&&member.handle&&/^[a-z][a-z0-9_-]{1,28}[a-z0-9_]$/.test(member.handle))return `/blogs/${encodeURIComponent(member.handle)}`;
  return safe;
}
