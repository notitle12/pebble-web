const destinations = new Set(["/me/blog", "/me/posts", "/posts/new"]);
const positiveId=(value:string)=>/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n;
export function loginDestination(value: string | null): string {
  if(!value)return "/me/posts";
  if(destinations.has(value))return value;
  const project=/^\/projects\/([1-9]\d{0,18})$/.exec(value);
  if(project&&positiveId(project[1]))return value;
  const post=/^\/blogs\/[a-z][a-z0-9-]{1,28}[a-z0-9]\/posts\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(value);
  if(post&&post[1].length<=200&&post[1]!=="search"&&(!/^\d+$/.test(post[1])||positiveId(post[1])))return value;
  return "/me/posts";
}
