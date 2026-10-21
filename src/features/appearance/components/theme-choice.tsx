"use client";
import {useEffect,useState} from 'react';
import {parseTheme,THEME_KEY,type Theme} from '../theme';
export function ThemeChoice(){
 const [theme,setTheme]=useState<Theme>('light');
 useEffect(()=>{setTheme(parseTheme(document.documentElement.dataset.theme));function sync(event:StorageEvent){if(event.key!==THEME_KEY&&event.key!==null)return;const next=parseTheme(event.newValue);document.documentElement.dataset.theme=next;setTheme(next);}window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
 function choose(next:Theme){document.documentElement.dataset.theme=next;setTheme(next);try{window.localStorage.setItem(THEME_KEY,next);}catch{/* The current tab can still use the selected theme. */}}
 const next=theme==='light'?'dark':'light';
 const label=next==='dark'?'다크 모드로 전환':'라이트 모드로 전환';
 return <button type="button" className="account-theme-toggle" aria-label={label} title={label} onClick={()=>choose(next)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{theme==='light'?<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>}</svg></button>;
}
