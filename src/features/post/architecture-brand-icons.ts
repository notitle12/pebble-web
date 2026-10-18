// Curated original assets only. Review both artwork license and trademark policy before adding entries.
export const ARCHITECTURE_BRAND_ICONS = [
 {value:'GIT',label:'Git',aliases:'깃 버전 관리 version control',asset:'/technology-icons/git.svg',author:'Jason Long',license:'CC BY 3.0',licenseUrl:'https://creativecommons.org/licenses/by/3.0/',source:'https://git-scm.com/community/logos',policy:'https://git-scm.com/about/trademark',reviewedOn:'2026-10-18'},
 {value:'RUST',label:'Rust',aliases:'러스트 언어 language',asset:'/technology-icons/rust.png',author:'Rust Foundation',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',source:'https://rustfoundation.org/policies/logo-policy-and-media-guide/',policy:'https://rustfoundation.org/policies/logo-policy-and-media-guide/',reviewedOn:'2026-10-18'},
] as const;
export const architectureBrandIcon=(value?:string|null)=>ARCHITECTURE_BRAND_ICONS.find(icon=>icon.value===value);
export function searchArchitectureIcons<T extends {value:string;label:string;aliases?:string}>(icons:readonly T[],query:string):T[]{
 const needle=query.trim().toLocaleLowerCase().replace(/\s+/g,'');
 return icons.filter(icon=>[icon.value,icon.label,icon.aliases??''].join(' ').toLocaleLowerCase().replace(/\s+/g,'').includes(needle));
}
