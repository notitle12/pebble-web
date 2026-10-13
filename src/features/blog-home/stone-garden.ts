import {GuestApiError} from '../../lib/public-api.ts';
export type Garden={publicationCount:number};
export type GardenStone={id:string;x:number;y:number;width:number;height:number;count:number;shape:0|1|2|3|6|7|8|9|10|11};
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
 const floor=221,stones:GardenStone[]=[],plants:GardenPlant[]=[];
 const aspects=[229/496,298/404,135/428,97/393,0,0,218/495,253/456,133/485,260/449,212/481,206/462];
 // 중간 받침은 넓은 면을 가진 돌로, 뾰족한 돌은 꼭대기에 배치한다. 접점은 윤곽 안쪽으로 겹친다.
 // 기록이 늘어도 기존 돌의 크기와 좌표는 유지하고 새로운 돌만 추가한다.
 const slots:[number,string,number,number,number,GardenStone['shape']][]=[
  [15,'main-0',500,224,68,6],[20,'main-1',498,198,55,8],[30,'main-2',501,187,47,10],[40,'main-3',499,171,42,0],[50,'main-4',501,156,33,11],[75,'main-5',499,145,26,2],[100,'main-6',501,140,20,9],
  [60,'left-0',370,222,98,1],[250,'left-1',368,157,68,8],[350,'left-2',370,145,50,11],[800,'left-3',368,129,33,9],
  [100,'right-0',650,222,93,10],[150,'right-1',652,187,68,11],[220,'right-2',650,164,53,0],[500,'right-3',652,145,40,8],[900,'right-4',650,139,31,9],
  [700,'outer-0',270,223,68,0],[1200,'outer-1',268,198,53,8],[1800,'outer-2',270,189,40,11],[3000,'outer-3',268,177,27,9],
  [1000,'loose-right',740,224,30,6],[2000,'loose-left',213,224,32,7],
  [1,'pebble-1',490,224,14,6],[2,'pebble-2',510,225,11,8],[3,'pebble-3',478,223,16,10],[4,'pebble-4',526,223,12,9],[5,'pebble-5',461,224,14,7],[6,'pebble-6',541,225,11,11],[7,'pebble-7',450,223,9,0],[8,'pebble-8',551,224,12,2],[9,'pebble-9',490,218,12,8],[10,'pebble-10',514,221,13,11],
 ];
 for(const [at,id,x,bottom,width,shape] of slots){if(count<at)continue;const height=width*aspects[shape];stones.push({id,x,y:bottom-height/2,width,height,shape,count:0});}
 if(count>=5){const growth=1-Math.exp(-(count-4)/40);plants.push({id:'grass-first',shape:5,x:442,y:floor+1,width:7+15*growth,height:9+20*growth});}
 if(count>=18){const growth=1-Math.exp(-(count-17)/55);plants.unshift({id:'bamboo-left',shape:4,x:396,y:floor,width:36+100*growth,height:42+153*growth});}
 if(count>=50){const growth=1-Math.exp(-(count-49)/80);plants.push({id:'grass-right',shape:5,x:588,y:floor+3,width:14+16*growth,height:18+22*growth,flip:true});}
 if(count>=250){const growth=1-Math.exp(-(count-249)/250);plants.unshift({id:'bamboo-right',shape:4,x:710,y:floor+1,width:45+50*growth,height:65+100*growth,flip:true});}
 if(count>=600){const growth=1-Math.exp(-(count-599)/250);plants.push({id:'grass-outer',shape:5,x:245,y:floor+4,width:16+16*growth,height:20+18*growth});}
 const each=Math.floor(count/stones.length),extra=count%stones.length;
 return {stones:stones.map((s,i)=>({...s,count:each+(i<extra?1:0)})),plants,groundWidth:Math.min(630,Math.max(26+430*(1-Math.exp(-count/130)),26+2*Math.max(...stones.map(s=>Math.abs(s.x-500)+s.width/2))))};
}
export function gardenStones(count:number){return gardenScene(count).stones;}
