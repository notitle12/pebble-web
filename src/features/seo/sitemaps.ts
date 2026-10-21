import {getPublicPosts,postHref} from '../post/api/post-list.ts';
import {getPublicProjects} from '../project/api/project-list.ts';
import {siteUrl,publicContent} from './model.ts';
export const PAGES_PER_SHARD=10;
const SHARD_LIMIT=49999;
type Kind='posts'|'projects';
type Entry={url:string;lastModified?:string};
export const xmlEscape=(v:string)=>v.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
const xml=(tag:string,items:string[])=>`<?xml version="1.0" encoding="UTF-8"?><${tag} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items.join('')}</${tag}>`;
export const sitemapXml=(entries:Entry[])=>xml('urlset',[...new Map(entries.map(e=>[e.url,e])).values()].map(e=>`<url><loc>${xmlEscape(e.url)}</loc>${e.lastModified?`<lastmod>${xmlEscape(e.lastModified)}</lastmod>`:''}</url>`));
export const sitemapIndexXml=(urls:string[])=>xml('sitemapindex',urls.map(url=>`<sitemap><loc>${xmlEscape(url)}</loc></sitemap>`));
export function parseShard(value:string){if(!/^(0|[1-9]\d*)\.xml$/.test(value))return null;const n=Number(value.slice(0,-4));return Number.isSafeInteger(n)&&n<SHARD_LIMIT?n:null;}
export const sitemapResponse=(body:string,status=200)=>new Response(body,{status,headers:{'Content-Type':status===200?'application/xml; charset=utf-8':'text/plain; charset=utf-8','Cache-Control':'no-store',...(status===503?{'Retry-After':'300'}:{})}});
const readers={posts:(page:number)=>getPublicPosts(page),projects:(page:number)=>getPublicProjects({page})};
export async function sitemapIndex(load=readers){const [posts,projects]=await Promise.all([load.posts(0),load.projects(0)]);const counts=[posts.totalPages,projects.totalPages].map(n=>Math.ceil(n/PAGES_PER_SHARD));if(counts.reduce((a,b)=>a+b,1)>50000)throw new Error('Sitemap index capacity');return sitemapIndexXml([siteUrl('/sitemaps/static.xml'),...(['posts','projects'] as const).flatMap((kind,i)=>Array.from({length:counts[i]},(_,id)=>siteUrl(`/sitemaps/${kind}/${id}.xml`)))]);}
export async function sitemapShard(kind:Kind,shard:number,load=readers){
 if(!Number.isSafeInteger(shard)||shard<0||shard>=SHARD_LIMIT) return null;
 const start=shard*PAGES_PER_SHARD,first=await load[kind](start);if(start>=first.totalPages)return null;
 const pages=[first];const end=Math.min(start+PAGES_PER_SHARD,first.totalPages);
 for(let offset=start+1;offset<end;offset+=3){pages.push(...await Promise.all(Array.from({length:Math.min(3,end-offset)},(_,i)=>load[kind](offset+i))));}
 const entries:Entry[]=[];
 for(const page of pages)for(const item of page.content){if(!publicContent(item))continue;if(kind==='posts'&&'author' in item){const href=postHref(item.author.handle,item.urlKey);if(!href)throw new Error('Invalid public post');entries.push({url:siteUrl(href),...(item.updatedAt?{lastModified:item.updatedAt}:{})},{url:siteUrl(`/blogs/${item.author.handle}`)});}else if(kind==='projects'&&'owner' in item){entries.push({url:siteUrl(`/projects/${item.id}`),...(item.updatedAt?{lastModified:item.updatedAt}:{})});}else throw new Error('Invalid sitemap content');}
 return sitemapXml(entries);
}
export const staticSitemap=()=>sitemapXml(['/','/posts','/projects','/categories'].map(path=>({url:siteUrl(path)})));
