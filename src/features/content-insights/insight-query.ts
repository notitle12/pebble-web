import {INSIGHT_DAYS,INSIGHT_SORTS,type InsightDays,type ContentKind,type InsightSort,type InsightDirection} from './model.ts';

export type InsightView='overview'|ContentKind;
export type InsightFilters={days:InsightDays;kind:ContentKind;sort:InsightSort;direction:InsightDirection;query:string;from:InsightView};
type Query=Pick<URLSearchParams,'get'|'getAll'>;
const single=(query:Query,key:string)=>query.getAll(key).length===1?query.get(key):null;
export function parseInsightFilters(query:Query):InsightFilters {
 const rawDays=single(query,'days'),rawKind=single(query,'kind'),rawSort=single(query,'sort'),rawDirection=single(query,'direction');
 const days=rawDays!==null&&INSIGHT_DAYS.some(value=>String(value)===rawDays)?Number(rawDays) as InsightDays:1;
 const kind:ContentKind=rawKind==='projects'?'projects':'posts';
 const sort=INSIGHT_SORTS.includes(rawSort as InsightSort)?rawSort as InsightSort:'LATEST';
 const direction:InsightDirection=rawDirection==='ASC'?'ASC':'DESC';
 const rawQuery=single(query,'q')?.trim()??'',rawFrom=single(query,'from');
 return {days,kind,sort,direction,query:rawQuery.length<=100?rawQuery:'',from:rawFrom==='overview'||rawFrom==='posts'||rawFrom==='projects'?rawFrom:kind};
}
function filterParams(filters:InsightFilters):URLSearchParams {
 const params=new URLSearchParams({days:String(filters.days)});
 if(filters.kind!=='posts')params.set('kind',filters.kind);
 if(filters.sort!=='LATEST')params.set('sort',filters.sort);
 if(filters.direction!=='DESC')params.set('direction',filters.direction);
 if(filters.query)params.set('q',filters.query);
 return params;
}
export function insightPageHref(view:InsightView,filters:InsightFilters):string {
 const params=filterParams({...filters,...(view!=='overview'?{kind:view}:{})});
 return `/settings/blog/insights${view==='overview'?'':'/content'}?${params}`;
}
export function insightDetailLink(kind:ContentKind,id:string,filters:InsightFilters,from:InsightView):string {
 const params=filterParams(filters);params.set('from',from);
 return `/settings/blog/insights/${kind}/${encodeURIComponent(id)}?${params}`;
}
