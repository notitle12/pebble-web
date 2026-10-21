'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './project-cover-image.module.css';

interface Props {
  src: string;
  alt: string;
  className?: string;
}

export function ProjectCoverImage({ src, alt, className = 'content-thumbnail' }: Props) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open) dialog?.showModal();
    else if (dialog?.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label={`${alt} 확대 보기`}
        title="클릭하여 원본 이미지 확대"
      >
        <img className={className} src={src} alt={alt} />
        <span className={styles.zoomBadge} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M11 8v6M8 11h6" />
          </svg>
          확대 보기
        </span>
      </button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-label={`${alt} 원본 확대`}
        onClose={() => setOpen(false)}
        onClick={event => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <div className={styles.dialogContent}>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="닫기"
            autoFocus
            onClick={() => setOpen(false)}
          >
            ×
          </button>
          <img
            src={src}
            alt={alt}
            className={styles.enlargedImg}
            onClick={() => setOpen(false)}
            title="클릭하여 닫기"
          />
        </div>
      </dialog>
    </>
  );
}
