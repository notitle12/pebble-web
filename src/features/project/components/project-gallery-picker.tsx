"use client";

import { useRef } from "react";
import styles from "./project-gallery-picker.module.css";

export type GalleryChoice = {
  key: string;
  label: string;
  preview: string | null;
  selected: boolean;
  select: () => void;
  remove: () => void;
};

export function ProjectGalleryPicker({ choices, disabled, onAdd }: {
  choices: GalleryChoice[];
  disabled: boolean;
  onAdd: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  return <section className={`${styles.picker} project-gallery-cover-picker`} aria-label="프로젝트 이미지">
    <header className={styles.heading}>
      <strong>프로젝트 이미지</strong>
      <button type="button" className={styles.add} disabled={disabled} onClick={() => input.current?.click()}>
        <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M8 3.5v9M3.5 8h9"/></svg>이미지 추가
      </button>
      <input ref={input} type="file" aria-label="프로젝트 이미지 파일 선택" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={disabled} onChange={event => {
        const files = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = "";
        if (files.length) onAdd(files);
      }}/>
    </header>
    {choices.length ? <ul className={styles.choices}>
      {choices.map(choice => <li key={choice.key} className={styles.choice}>
        <div className={styles.image} data-selected={choice.selected}>
          {choice.preview ? <img src={choice.preview} alt=""/> : <span>{choice.label}</span>}
          <button type="button" className={styles.remove} disabled={disabled} onClick={choice.remove} aria-label={`${choice.label} 삭제`}>
            <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m4.5 4.5 7 7m0-7-7 7"/></svg>
          </button>
        </div>
        <button type="button" className={styles.choose} disabled={disabled} aria-pressed={choice.selected} aria-label={`${choice.label} 대표 썸네일`} onClick={choice.select}>
          {choice.selected ? "대표 썸네일" : "대표로 지정"}
        </button>
      </li>)}
    </ul> : <p className={styles.hint}>JPEG · PNG · WebP · 파일당 10 MiB 이하 · 최대 20장</p>}
  </section>;
}
