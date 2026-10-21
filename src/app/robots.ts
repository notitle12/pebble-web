import type {MetadataRoute} from 'next';
import {siteUrl} from '@/features/seo/model';
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:'/',disallow:['/me/','/settings/','/auth/','/login','/agreements','/dev/','/search','/posts/new','/posts/*/edit','/posts/*/view','/projects/new','/projects/*/edit','/projects/*/view']},sitemap:siteUrl('/sitemap.xml')};}
