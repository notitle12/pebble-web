import type {BlogActivity} from "./api/blog-home.ts";

export function activityCalendar(data:BlogActivity){
 const counts=new Map(data.days.map(day=>[day.date,day.count]));
 const first=new Date(`${data.from}T00:00:00Z`);
 const last=new Date(`${data.to}T00:00:00Z`);
 const offset=(first.getUTCDay()+6)%7;
 const cells:({date:string;count:number;level:number}|null)[]=Array(offset).fill(null);
 const months:{label:string;week:number}[]=[];
 for(const day=new Date(first);day<=last;day.setUTCDate(day.getUTCDate()+1)){
  const date=day.toISOString().slice(0,10),count=counts.get(date)??0;
  if((date===data.from||day.getUTCDate()===1)&&!months.some(month=>month.week===Math.floor(cells.length/7)))months.push({label:`${day.getUTCMonth()+1}월`,week:Math.floor(cells.length/7)});
  cells.push({date,count,level:count===0?0:count===1?1:count<=3?2:count<=5?3:4});
 }
 return {cells,months,total:data.days.reduce((sum,day)=>sum+day.count,0),activeDays:data.days.filter(day=>day.count>0).length};
}
