/** Resolve a visible insertion gap to the final series rank, independent of stored gaps. */
export function sameSeriesOrder(a:readonly string[],b:readonly string[]):boolean{return a.length===b.length&&a.every((id,index)=>id===b[index]);}
export function reorderSeriesRows<T extends {id:string}>(rows:readonly T[],id:string,position:number):T[]{
 const from=rows.findIndex(row=>row.id===id);
 if(from<0||!Number.isSafeInteger(position)||position<0||position>=rows.length)throw new Error("순서 위치를 확인해 주세요.");
 const next=[...rows],[moved]=next.splice(from,1);next.splice(position,0,moved);return next;
}
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
