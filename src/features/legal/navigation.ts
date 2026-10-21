const base = "https://pebble.invalid";
const isPolicyPath = (pathname:string) => /^\/(terms|privacy)\/?$/.test(pathname);

export function safePolicyReturnTo(value:string|null):string {
  if(!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]|%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|20)/i.test(value.split(/[?#]/)[0]))return "/";
  try {
    const url = new URL(value,base);
    if(url.origin!==base || isPolicyPath(url.pathname) || /^\/(auth|api)(\/|$)/.test(url.pathname))return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/"; }
}

export function policyReturnTo(pathname:string,search:URLSearchParams):string {
  return safePolicyReturnTo(isPolicyPath(pathname) ? search.get("returnTo") : `${pathname}${search.size?`?${search}`:""}`);
}

export function policyHref(path:"/terms"|"/privacy",returnTo:string):string {
  return `${path}?${new URLSearchParams({returnTo:safePolicyReturnTo(returnTo)})}`;
}
