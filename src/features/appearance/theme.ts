export const THEME_KEY='pebble:theme';
export type Theme='light'|'dark';
export function parseTheme(value:unknown):Theme{return value==='dark'?'dark':'light';}
// Apply the saved preference before rendering the body; no user content is injected.
export const themeBootstrap=`try{document.documentElement.dataset.theme=localStorage.getItem('${THEME_KEY}')==='dark'?'dark':'light'}catch{document.documentElement.dataset.theme='light'}`;
