import {sitemapIndex,sitemapResponse} from '@/features/seo/sitemaps';
export const dynamic='force-dynamic';
export async function GET(){try{return sitemapResponse(await sitemapIndex());}catch{return sitemapResponse('Sitemap temporarily unavailable',503);}}
