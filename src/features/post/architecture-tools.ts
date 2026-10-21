import type {ArchitectureSpec,ArchitectureEdge} from './api/post-list.ts';
import {architectureBrandIcon} from './architecture-brand-icons.ts';
import {architectureIconKind} from './architecture-catalog.ts';
export const ARCHITECTURE_ICONS=[{value:'PERSON',label:'사람'},{value:'CLIENT',label:'화면'},{value:'SERVER',label:'서버'},{value:'DATABASE',label:'데이터베이스'},{value:'CACHE',label:'캐시'},{value:'STORAGE',label:'저장소'},{value:'CLOUD',label:'클라우드'},{value:'CONTAINER',label:'컨테이너'},{value:'NGINX',label:'네트워크'}] as const;
export function toolboxIcon(value?:string|null,type?:string){const brand=architectureBrandIcon(value);if(brand)return brand.value;const kind=architectureIconKind(value,type);return kind==='PROXY'?'NGINX':kind==='CUSTOM'?'SERVER':kind;}
export const connectionMarkers=(direction:ArchitectureEdge['direction'])=>({start:direction==='BOTH',end:direction!=='NONE'});
export function newArchitectureNode(id:string,icon:string,index:number,label=''):ArchitectureSpec['nodes'][number]{return {id,type:'CUSTOM',label,typeLabel:null,icon,position:{x:52+(index%4)*222,y:58+Math.floor(index/4)*150}};}
export function newArchitectureGroup(id:string,icon?:string):ArchitectureSpec['groups'][number]{return {id,type:'CUSTOM',label:'',typeLabel:'그룹',icon:icon??null};}
