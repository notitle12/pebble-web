"use client";
import {useEffect,useState} from 'react';
import {parseTheme,THEME_KEY,type Theme} from '../theme';
export function ThemeChoice(){
 const [theme,setTheme]=useState<Theme>('light');
 useEffect(()=>{setTheme(parseTheme(document.documentElement.dataset.theme));function sync(event:StorageEvent){if(event.key!==THEME_KEY&&event.key!==null)return;const next=parseTheme(event.newValue);document.documentElement.dataset.theme=next;setTheme(next);}window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
 function choose(next:Theme){document.documentElement.dataset.theme=next;setTheme(next);try{window.localStorage.setItem(THEME_KEY,next);}catch{/* The current tab can still use the selected theme. */}}
 return <div className="account-theme"><span>화면 테마</span><div role="group" aria-label="화면 테마">{(['light','dark'] as const).map(value=><button type="button" key={value} aria-pressed={theme===value} onClick={()=>choose(value)}>{value==='light'?'라이트':'다크'}</button>)}</div></div>;
}
