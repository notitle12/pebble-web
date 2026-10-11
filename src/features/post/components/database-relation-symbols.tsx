import {crowFootPaths} from '../database-relations';
import type {DbRelationShape} from '../database-relationship-choice';
export function RelationshipEndMark({x,y,angle,many,required,notation}:{x:number;y:number;angle:number;many:boolean;required:boolean;notation:string}){
 const radians=angle*Math.PI/180,nx=Math.round(Math.cos(radians)),ny=Math.round(Math.sin(radians));
 if(notation==='CHEN')return <text x={x+nx*14+(ny?12:0)} y={y+ny*18+(nx?-9:0)} textAnchor={nx<0?'end':'start'}>{many?'N':'1'}{required?'':'°'}</text>;
 const marker=crowFootPaths(0,0,1,many,required);
 return <g transform={`translate(${x} ${y}) rotate(${angle})`}><path d={marker.maximum}/>{marker.minimum&&<path d={marker.minimum}/>} {marker.circle&&<circle {...marker.circle}/>}</g>;
}
export function RelationshipPreview({notation,shape,label}:{notation:string;shape:DbRelationShape;label:string}){return <svg viewBox="0 0 200 50" role="img" aria-label={label}><path d="M18 30 H182"/><RelationshipEndMark x={18} y={30} angle={0} many={false} required={shape.targetRequired} notation={notation}/><RelationshipEndMark x={182} y={30} angle={180} many={shape.many} required={shape.sourceRequired} notation={notation}/></svg>;}
