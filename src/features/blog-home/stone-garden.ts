import {GuestApiError} from '../../lib/public-api.ts';
export type Garden={publicationCount:number};
export type GardenStone={id:string;x:number;y:number;width:number;height:number;count:number;shape:0|1|2|3};
export type GardenPlant={id:string;x:number;y:number;width:number;height:number;shape:4|5;flip?:boolean};
export type GardenScene={stones:GardenStone[];plants:GardenPlant[];groundWidth:number};
export function parseGarden(value:unknown):Garden{
 const raw=value as {data?:unknown;publicationCount?:unknown};
 const data=(raw&&typeof raw==='object'&&'data' in raw?raw.data:raw) as Garden;
 if(!data||!Number.isSafeInteger(data.publicationCount)||data.publicationCount<0)throw new GuestApiError('response');
 return {publicationCount:data.publicationCount};
}
export function gardenScene(count:number):GardenScene{
 if(!Number.isSafeInteger(count)||count<0)throw new Error('발행 수를 확인해 주세요.');
 if(count===0)return {stones:[],plants:[],groundWidth:0};
 const base=14+128*(1-Math.exp(-count/90)),floor=221,stones:GardenStone[]=[],plants:GardenPlant[]=[];
 const aspects=[229/496,298/404,135/428,97/393];
 function add(id:string,x:number,bottom:number,width:number,shape:0|1|2|3){const height=width*aspects[shape];stones.push({id,x,y:bottom-height/2,width,height,shape,count:0});return height;}
 function tower(prefix:string,x:number,bottom:number,width:number,levels:number){let y=bottom;for(let i=0;i<levels;i++){const shape=i===2?1:i%2===0?0:2,w=width*Math.pow(.77,i),offset=[0,-.035,.025,-.025,.035,-.01][i]*width;const h=add(`${prefix}-${i}`,x+offset,y,w,shape);y-=h*.79;}}
 const levels=[1,8,22,45,90,180].filter(value=>value<=count).length;
 tower('main',500,floor,base,levels);
 if(count>=5)add('gravel-right',500+base*.72,floor+3,10+base*.28,3);
 if(count>=12)add('pebble-left',500-base*.82,floor+2,8+base*.16,2);
 if(count>=25)add('left-boulder',375,floor+1,base*.5,1);
 if(count>=65)tower('right',650,floor+2,base*.55,count>=400?3:count>=120?2:1);
 if(count>=250)add('gravel-left',315,floor+3,base*.35,3);
 if(count>=700)tower('left',287,floor+3,base*.48,count>=1500?3:2);
 if(count>=1000)add('outer-right',735,floor+3,base*.27,0);
 if(count>=2500)add('outer-left',215,floor+4,base*.28,1);
 if(count>=5)plants.push({id:'grass-first',shape:5,x:500-base*.68,y:floor+1,width:7+base*.12,height:9+base*.14});
 if(count>=18){const growth=1-Math.exp(-(count-17)/55);plants.unshift({id:'bamboo-left',shape:4,x:396,y:floor,width:36+100*growth,height:42+153*growth});}
 if(count>=50)plants.push({id:'grass-right',shape:5,x:588,y:floor+3,width:14+base*.12,height:18+base*.16,flip:true});
 if(count>=250){const growth=1-Math.exp(-(count-249)/250);plants.unshift({id:'bamboo-right',shape:4,x:710,y:floor+1,width:45+50*growth,height:65+100*growth,flip:true});}
 if(count>=600)plants.push({id:'grass-outer',shape:5,x:272,y:floor+4,width:32,height:38});
 const each=Math.floor(count/stones.length),extra=count%stones.length;
 return {stones:stones.map((s,i)=>({...s,count:each+(i<extra?1:0)})),plants,groundWidth:Math.min(630,Math.max(26+430*(1-Math.exp(-count/130)),26+2*Math.max(...stones.map(s=>Math.abs(s.x-500)+s.width/2))))};
}
export function gardenStones(count:number){return gardenScene(count).stones;}
