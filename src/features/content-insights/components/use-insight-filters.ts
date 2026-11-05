'use client';
import {usePathname,useSearchParams} from 'next/navigation';
import {useEffect} from 'react';
import {INSIGHT_DAYS} from '../model';
import {parseInsightFilters,insightLocationHref,type InsightFilters} from '../insight-query';

export function useInsightFilters(){
 const params=useSearchParams(),pathname=usePathname();
 const filters=parseInsightFilters(params);
 const query=params.toString();
 useEffect(()=>{
  const search=new URLSearchParams(query),days=search.getAll('days');
  if(days.length&&(days.length!==1||!INSIGHT_DAYS.some(day=>String(day)===days[0])))window.history.replaceState(null,'',insightLocationHref(pathname,parseInsightFilters(search)));
 },[pathname,query]);
 const change=(patch:Partial<InsightFilters>)=>{
  const next={...filters,...patch};
  window.history.replaceState(null,'',insightLocationHref(pathname,next));
 };
 return {filters,change};
}
