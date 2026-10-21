import {staticSitemap,sitemapResponse} from '@/features/seo/sitemaps';
export const dynamic='force-dynamic';
export function GET(){return sitemapResponse(staticSitemap());}
