export const columnRatios=["1:1","1:2","2:1"] as const;
export function columnRatioParts(value:unknown):[number,number]|null {
 if(typeof value!=="string")return null;
 if(columnRatios.includes(value as typeof columnRatios[number]))return value.split(':').map(Number) as [number,number];
 if(!/^\d{2}:\d{2}$/.test(value))return null;
 const [left,right]=value.split(':').map(Number);
 return left>=20&&left<=80&&right>=20&&right<=80&&left+right===100?[left,right]:null;
}
export const safeColumnRatio=(value:unknown)=>columnRatioParts(value)?String(value):"1:1";
export const columnRatioStyle=(value:unknown)=>{const [left,right]=columnRatioParts(value)??[1,1];return `--column-left:${left}fr;--column-right:${right}fr`;};
export const columnLeftPercent=(value:unknown)=>{const [left,right]=columnRatioParts(value)??[1,1];return left/(left+right)*100;};
export const ratioFromPercent=(value:number)=>{const left=Number.isFinite(value)?Math.max(20,Math.min(80,Math.round(value))):50;return `${left}:${100-left}`;};
export function ratioAtPointer(x:number,left:number,width:number,gap=24):string {
 return ratioFromPercent(width>gap?(x-left-gap/2)/(width-gap)*100:50);
}
