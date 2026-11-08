/** Resolve a visible insertion gap to the final series rank, independent of stored gaps. */
export function seriesDropOrder(source:number,insertion:number,total:number):number|null {
 if(![source,insertion,total].every(Number.isSafeInteger)||total<1||source<0||source>=total||insertion<0||insertion>total)return null;
 const target=insertion>source?insertion-1:insertion;
 return target===source?null:target;
}
export function seriesPostDropOrder(source:number,insertion:number,page:number,count:number,total:number):number|null {
 if(![source,insertion,page,count,total].every(Number.isSafeInteger)||page<0||count<1||count>20||source<0||source>=count||insertion<0||insertion>count||total<page*20+count)return null;
 const target=seriesDropOrder(source,insertion,count);
 return target===null?null:page*20+target;
}
