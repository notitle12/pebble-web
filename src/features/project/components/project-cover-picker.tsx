'use client';
import {useRef,useState} from 'react';
import {mediaFileError} from '@/features/media/model';
import styles from './project-cover-picker.module.css';

export type ProjectCandidateImage = {
  src: string;
  previewUrl: string;
};

export function ProjectCoverPicker({
  preview,
  selected,
  selectedSrc,
  disabled,
  onChange,
  onRemove,
  candidateImages = [],
  onSelectCandidate,
}:{
  preview:string|null;
  selected?:boolean;
  selectedSrc?:string|null;
  disabled:boolean;
  onChange:(file:File|null)=>void;
  onRemove?:()=>void;
  candidateImages?:ProjectCandidateImage[];
  onSelectCandidate?:(candidate:ProjectCandidateImage)=>void;
}){
  const input=useRef<HTMLInputElement>(null),[error,setError]=useState('');

  const handleRemove=()=>{
    setError('');
    if(input.current)input.current.value='';
    if(onRemove)onRemove();
    else onChange(null);
  };

  return (
    <div className={styles.picker}>
      <input
        ref={input}
        type="file"
        hidden
        aria-label="대표 이미지 파일 선택"
        accept="image/png,image/jpeg,image/webp"
        disabled={disabled}
        onChange={event=>{
          const file=event.target.files?.[0];
          event.target.value='';
          if(!file)return;
          const message=mediaFileError(file);
          setError(message??'');
          if(!message)onChange(file);
        }}
      />
      {preview ? (
        <div className={styles.previewBox}>
          <img src={preview} alt="대표 이미지 미리보기" className={styles.previewImg}/>
          <div className={styles.previewControls}>
            <button
              type="button"
              className={styles.replace}
              disabled={disabled}
              onClick={()=>input.current?.click()}
            >
              이미지 변경
            </button>
            <button
              type="button"
              className={styles.removeFloating}
              disabled={disabled}
              aria-label="대표 이미지 삭제"
              title="대표 이미지 삭제"
              onClick={handleRemove}
            >
              ×
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.choose}
          aria-label="대표 이미지 추가"
          disabled={disabled}
          onClick={()=>input.current?.click()}
        >
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect x="4" y="5" width="24" height="22" rx="3"/>
            <circle cx="11" cy="12" r="2"/>
            <path d="m5 23 8-8 6 6 4-4 5 5"/>
          </svg>
          <span>대표 이미지 선택</span>
          <small>PNG · JPG · WebP</small>
        </button>
      )}


      {error && <p role="alert">{error}</p>}

      {candidateImages.length > 0 && (
        <div className={styles.gallery}>
          <span className={styles.galleryTitle}>본문 이미지에서 선택</span>
          <div className={styles.galleryGrid}>
            {candidateImages.map((image, index) => {
              const isCurrent = selectedSrc === image.src;
              return (
                <button
                  key={image.src}
                  type="button"
                  className={`${styles.galleryItem} ${isCurrent ? styles.active : ''}`}
                  disabled={disabled}
                  aria-label={isCurrent ? '대표 이미지로 선택됨 (클릭하여 해제)' : `본문 이미지 ${index + 1}을 대표 이미지로 선택`}
                  aria-pressed={isCurrent}
                  onClick={() => {
                    if (isCurrent) {
                      handleRemove();
                    } else {
                      onSelectCandidate?.(image);
                    }
                  }}
                >
                  <img src={image.previewUrl} alt="" />
                  {isCurrent && <span className={styles.badge}>선택됨</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
