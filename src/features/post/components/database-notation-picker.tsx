"use client";
import s from './database-schema.module.css';
export function DatabaseNotationPicker({value,onChange,label='관계선 표기법'}:{value:string;onChange:(value:'IE'|'CHEN')=>void;label?:string}){
 return <div className={s.notationPicker} role="group" aria-label={label}>
  <button type="button" aria-label="IE 표기법" aria-pressed={value!=='CHEN'} onClick={()=>onChange('IE')}><strong>IE</strong><svg viewBox="0 0 180 50" role="img" aria-label="IE 예시: 필수 1 대 선택 N"><path d="M18 26 H162 M28 17 V35 M38 17 V35 M162 17 L150 26 L162 35"/><circle cx="138" cy="26" r="4"/></svg><span>1 : N</span></button>
  <button type="button" aria-label="피터 첸 표기법" aria-pressed={value==='CHEN'} onClick={()=>onChange('CHEN')}><strong>피터 첸</strong><svg viewBox="0 0 180 50" role="img" aria-label="피터 첸 예시: 1 대 N 숫자 표기"><path d="M18 30 H162"/><text x="24" y="22">1</text><text x="144" y="22">N°</text></svg><span>1 : N</span></button>
 </div>;
}
