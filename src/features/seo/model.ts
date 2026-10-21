import type {Metadata} from 'next';
import {parseDocument} from 'htmlparser2';
import type {ChildNode} from 'domhandler';
import sanitizeHtml from 'sanitize-html';
import {marked} from 'marked';
import type {PostDetail,PostBlock} from '../post/api/post-list.ts';
import type {ProjectDetail} from '../project/api/project-list.ts';
export const SITE_ORIGIN='https://www.pebble-log.com';
export const API_ORIGIN='https://api.pebble-log.com/api/v1';
export const SITE_DESCRIPTION='개발 기록과 프로젝트, 아키텍처와 데이터베이스 설계를 함께 나누는 Pebble입니다.';
export const SHARE_IMAGE=`${SITE_ORIGIN}/og/pebble.png`;
export function siteUrl(path:string){if(!path.startsWith('/')||path.startsWith('//')||path.includes('\\'))throw new Error('Invalid site path');const u=new URL(path,SITE_ORIGIN);if(u.origin!==SITE_ORIGIN)throw new Error('Invalid site origin');return u.href;}
const nodeText=(nodes:ChildNode[]):string=>nodes.map(n=>n.type==='text'?n.data:'children' in n?nodeText(n.children):'').join(' ');
export function plainDescription(value:string,markdown=false){const html=markdown?marked.parse(value,{async:false}):value;return nodeText(parseDocument(sanitizeHtml(html,{allowedTags:["p","div","br","li","ul","ol","h1","h2","h3","h4","h5","h6","blockquote","pre"],allowedAttributes:{}})).children).replace(/\s+/g,' ').trim();}
export function description(summary:string|null|undefined,blocks:readonly Pick<PostBlock,'type'|'content'>[]=[],fallback=SITE_DESCRIPTION){
 let text=summary?.trim()?plainDescription(summary):'';
 if(!text)for(const b of blocks){if(!['HTML','MARKDOWN','TEXT'].includes(b.type))continue;text=b.type==='TEXT'?b.content.replace(/\s+/g,' ').trim():plainDescription(b.content,b.type==='MARKDOWN');if(text)break;}
 const chars=Array.from(text||fallback);return chars.length>160?chars.slice(0,159).join('')+'…':chars.join('');
}
export function publicContent(value:unknown){if(!value||typeof value!=='object')return false;const v=value as Record<string,unknown>;return (v.visibilityStatus===undefined||v.visibilityStatus==='PUBLIC')&&(v.draft===undefined||v.draft===false)&&(v.isBlocked===undefined||v.isBlocked===false);}
export function jsonLd(value:unknown){return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,c=>`\\u${c.charCodeAt(0).toString(16).padStart(4,'0')}`);}
export function pageMetadata({path,title,description:desc=SITE_DESCRIPTION,image=SHARE_IMAGE,noIndex=false,article}:{path:string;title:string;description?:string;image?:string;noIndex?:boolean;article?:{publishedTime:string;modifiedTime?:string;authors:string[];tags:string[]}}):Metadata{
 const url=siteUrl(path);return {title,description:desc,alternates:{canonical:url},robots:{index:!noIndex,follow:true},openGraph:{type:article?'article':'website',siteName:'Pebble',locale:'ko_KR',url,title,description:desc,images:[{url:image,alt:title}],...(article??{})},twitter:{card:'summary_large_image',title,description:desc,images:[image]}};
}
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v);
export function postImage(post:PostDetail){return validId(post.thumbnailImageId)?`${API_ORIGIN}/posts/${post.id}/images/${post.thumbnailImageId}/content`:SHARE_IMAGE;}
export function projectImage(p:ProjectDetail){const thumbnail=p.media.find(m=>m.mediaRole==='THUMBNAIL');return thumbnail?`${API_ORIGIN}/projects/${p.id}/media/${thumbnail.id}/content`:SHARE_IMAGE;}
export function postSearchData(post:PostDetail){
 if(!publicContent(post))throw new Error('Private content');
 const path=`/blogs/${post.author.handle}/posts/${post.urlKey}`,url=siteUrl(path),desc=description(post.summary,post.blocks),image=postImage(post),authorUrl=siteUrl(`/blogs/${post.author.handle}`),datePublished=post.publishedAt??post.createdAt;
 const title=`${post.title} | ${post.author.blogName||post.author.nickname}`;
 return {metadata:{...pageMetadata({path,title,description:desc,image,article:{publishedTime:datePublished,...(post.updatedAt?{modifiedTime:post.updatedAt}:{}),authors:[authorUrl],tags:post.tags}}),title:{absolute:title}},schema:{'@context':'https://schema.org','@type':'BlogPosting','@id':url+'#article',url,mainEntityOfPage:{'@type':'WebPage','@id':url},headline:post.title,description:desc,image,author:{'@type':'Person',name:post.author.nickname,url:authorUrl},datePublished,...(post.updatedAt?{dateModified:post.updatedAt}:{}),inLanguage:'ko-KR',keywords:post.tags.join(', '),isPartOf:{'@type':'Blog',name:post.author.blogName||post.author.nickname,url:authorUrl}}};
}
export function projectSearchData(p:ProjectDetail){
 if(!publicContent(p))throw new Error('Private content');
 const path=`/projects/${p.id}`,url=siteUrl(path),blocks=p.document?.sections.flatMap(s=>s.blocks)??[],desc=description(p.summary,blocks,p.description?description(p.description):SITE_DESCRIPTION),image=projectImage(p);
 return {metadata:pageMetadata({path,title:p.name,description:desc,image}),schema:{'@context':'https://schema.org','@type':'CreativeWork','@id':url+'#project',url,name:p.name,description:desc,image,author:{'@type':'Person',name:p.owner.nickname},datePublished:p.publishedAt??p.createdAt,...(p.updatedAt?{dateModified:p.updatedAt}:{}),inLanguage:'ko-KR',keywords:p.techStacks.map(t=>t.name).join(', ')}};
}
