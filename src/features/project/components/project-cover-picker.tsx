'use client';
import {useRef,useState} from 'react';
import {mediaFileError} from '@/features/media/model';
import styles from './project-cover-picker.module.css';
export function ProjectCoverPicker({preview,selected,disabled,onChange}:{preview:string|null;selected:boolean;disabled:boolean;onChange:(file:File|null)=>void}){
 const input=useRef<HTMLInputElement>(null),[error,setError]=useState('');
 return <div className={styles.picker}><input ref={input} type="file" hidden aria-label="대표 이미지 파일 선택" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;const message=mediaFileError(file);setError(message??'');if(!message)onChange(file);}}/><button type="button" className={styles.choose} aria-label={preview?'대표 이미지 변경':'대표 이미지 추가'} disabled={disabled} onClick={()=>input.current?.click()}>{preview?<><img src={preview} alt="대표 이미지 미리보기"/><span className={styles.replace}>이미지 변경</span></>:<><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="5" width="24" height="22" rx="3"/><circle cx="11" cy="12" r="2"/><path d="m5 23 8-8 6 6 4-4 5 5"/></svg><span>대표 이미지 선택</span><small>PNG · JPG · WebP</small></>}</button>{selected&&<button type="button" className={styles.cancel} disabled={disabled} onClick={()=>{onChange(null);setError('');}}>선택 취소</button>}{error&&<p role="alert">{error}</p>}</div>;
}
