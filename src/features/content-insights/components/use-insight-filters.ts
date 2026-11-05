'use client';
import {usePathname,useSearchParams} from 'next/navigation';
import {parseInsightFilters,insightPageHref,insightDetailLink,type InsightFilters} from '../insight-query';

export function useInsightFilters(){
 const params=useSearchParams(),pathname=usePathname();
 const filters=parseInsightFilters(params);
 const change=(patch:Partial<InsightFilters>)=>{
  const next={...filters,...patch};
  const detail=pathname.match(/^\/settings\/blog\/insights\/(posts|projects)\/([1-9]\d*)$/);
  const href=detail?insightDetailLink(detail[1] as 'posts'|'projects',detail[2],next,next.from):insightPageHref(pathname.endsWith('/content')?next.kind:'overview',next);
  window.history.replaceState(null,'',href);
 };
 return {filters,change};
}
