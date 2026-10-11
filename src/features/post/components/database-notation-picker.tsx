"use client";
import {databaseRelationShapes,relationShapeLabel,type DbRelationShape} from '../database-relationship-choice';
import {RelationshipPreview} from './database-relation-symbols';
import s from './database-schema.module.css';
const example={many:true,targetRequired:true,sourceRequired:false};
export function DatabaseNotationPicker({value,onChange,label='관계선 표기법'}:{value:string;onChange:(value:'IE'|'CHEN')=>void;label?:string}){
 return <div className={s.notationPicker} role="group" aria-label={label}>
  <button type="button" aria-label="IE 표기법" aria-pressed={value!=='CHEN'} onClick={()=>onChange('IE')}><strong>IE</strong><RelationshipPreview notation="IE" shape={example} label="IE 예시: 1 대 선택 N"/></button>
  <button type="button" aria-label="피터 첸 표기법" aria-pressed={value==='CHEN'} onClick={()=>onChange('CHEN')}><strong>피터 첸</strong><RelationshipPreview notation="CHEN" shape={example} label="피터 첸 예시: 1 대 선택 N"/></button>
 </div>;
}
export function DatabaseRelationShapePicker({value,notation,onChange,label='관계선 모양',isDisabled}:{value:DbRelationShape;notation:string;onChange:(shape:DbRelationShape)=>void;label?:string;isDisabled?:(shape:DbRelationShape)=>boolean}){
 return <div className={s.shapePicker} role="group" aria-label={label}>{databaseRelationShapes.map((shape,i)=>{
 const text=relationShapeLabel(shape),selected=value.many===shape.many&&value.targetRequired===shape.targetRequired&&value.sourceRequired===shape.sourceRequired;
 return <button type="button" key={i} aria-label={text} aria-pressed={selected} disabled={isDisabled?.(shape)} onClick={()=>onChange(shape)}><RelationshipPreview notation={notation==='CHEN'?'CHEN':'IE'} shape={shape} label={text}/><span>{text}</span></button>;
 })}</div>;
}
