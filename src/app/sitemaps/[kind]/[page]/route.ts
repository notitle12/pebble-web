import {sitemapShard,sitemapResponse,parseShard} from '@/features/seo/sitemaps';
export const dynamic='force-dynamic';
export async function GET(_:Request,{params}:{params:Promise<{kind:string;page:string}>}){const {kind,page}=await params;const id=parseShard(page);if(!['posts','projects'].includes(kind)||id===null)return sitemapResponse('Not found',404);try{const body=await sitemapShard(kind as 'posts'|'projects',id);return body===null?sitemapResponse('Not found',404):sitemapResponse(body);}catch{return sitemapResponse('Sitemap temporarily unavailable',503);}}
