// Curated original assets only. Review both artwork license and trademark policy before adding entries.
export const ARCHITECTURE_BRAND_ICONS = [
 {category:'devops',value:'GIT',label:'Git',aliases:'깃 버전 관리 version control',asset:'/technology-icons/git.svg',author:'Jason Long',license:'CC BY 3.0',licenseUrl:'https://creativecommons.org/licenses/by/3.0/',source:'https://git-scm.com/community/logos',policy:'https://git-scm.com/about/trademark',reviewedOn:'2026-10-18',assetSource:'https://git-scm.com/images/logos/downloads/Git-Icon-1788C.svg',sha256:'1080a5430edb6278dc03e4b04efc16c8bed5b943408d648ad721a28836814220'},
 {category:'language',value:'RUST',label:'Rust',aliases:'러스트 언어 language',asset:'/technology-icons/rust.png',author:'Rust Foundation',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',source:'https://rustfoundation.org/policies/logo-policy-and-media-guide/',policy:'https://rustfoundation.org/policies/logo-policy-and-media-guide/',reviewedOn:'2026-10-18',assetSource:'https://rustfoundation.org/wp-content/uploads/2024/07/cropped-rust-lang-logo-black-150x150.png',sha256:'14b2ef779475f2e6dbfbe29e2587b5e83a9751435d98b29ebdd6ece27a182578'},
 {category:'language',value:'JAVASCRIPT',label:'JavaScript',aliases:'자바스크립트 js 언어 community',asset:'/technology-icons/javascript.png',author:'Christopher Williams / JSConf',license:'MIT',licenseUrl:'https://github.com/voodootikigod/logo.js/blob/master/LICENSE',source:'https://github.com/voodootikigod/logo.js',policy:'https://github.com/voodootikigod/logo.js/blob/master/README.md',reviewedOn:'2026-10-18',assetSource:'https://raw.githubusercontent.com/voodootikigod/logo.js/master/js.png',sha256:'aa1e3d2ce0043845f92e2f4c3da07766d07b348bf69e4377092cad4a3238fed0'},
 {category:'frontend',value:'REDUX',label:'Redux',aliases:'리덕스 상태 관리 state management',asset:'/technology-icons/redux.svg',author:'Matthew Johnston',license:'CC0 1.0',licenseUrl:'https://github.com/reduxjs/redux/blob/master/LICENSE-logo.md',source:'https://github.com/reduxjs/redux/tree/master/logo',policy:'https://github.com/reduxjs/redux/blob/master/logo/README.md',reviewedOn:'2026-10-18',assetSource:'https://raw.githubusercontent.com/reduxjs/redux/master/logo/logo.svg',sha256:'c8a53d63fea3dfeefb292713725a0a6fa57fcc61a6ec2b4bf555866440948c7e'},
 {category:'backend',value:'FLASK',label:'Flask',aliases:'플라스크 python backend server',asset:'/technology-icons/flask.svg',author:'Pallets',license:'Flask Artwork License',licenseUrl:'https://github.com/pallets/flask/blob/1.1.4/artwork/LICENSE.rst',source:'https://github.com/pallets/flask/tree/1.1.4/artwork',policy:'https://github.com/pallets/flask/blob/1.1.4/artwork/LICENSE.rst',reviewedOn:'2026-10-18',assetSource:'https://raw.githubusercontent.com/pallets/flask/1.1.4/artwork/logo-lineart.svg',sha256:'c4705ec9f523299ad815780e874be62c3627cea0a67db9a8cbd8b1bc3a78d0f5'},
 {category:'language',value:'CPP',label:'C++',aliases:'씨플러스플러스 cpp cplusplus 언어',asset:'/technology-icons/cpp.png',author:'Jeremy Kratz / Standard C++ Foundation',license:'Standard C++ Logo Permission',licenseUrl:'https://isocpp.org/home/terms-of-use',source:'https://github.com/isocpp/logos',policy:'https://isocpp.org/home/terms-of-use',reviewedOn:'2026-10-18',assetSource:'https://raw.githubusercontent.com/isocpp/logos/master/cpp_logo.png',sha256:'a5f3cb45e0b279f929e4c314e176d6cb04428a4d88504e7eec8df1a5f8b35de5'},
] as const;

export type ArchitectureBrandIcon = typeof ARCHITECTURE_BRAND_ICONS[number];
export const architectureBrandIcon = (value?: string | null) => ARCHITECTURE_BRAND_ICONS.find(icon => icon.value === value);

export function searchArchitectureIcons<T extends { value: string; label: string; aliases?: string; category?: string }>(
  icons: readonly T[],
  query: string,
  categoryFilter?: string
): T[] {
  const needle = query.trim().toLocaleLowerCase().replace(/\s+/g, '');
  return icons.filter(icon => {
    if (categoryFilter && categoryFilter !== 'all' && icon.category && icon.category !== categoryFilter) {
      return false;
    }
    if (!needle) return true;
    return [icon.value, icon.label, icon.aliases ?? ''].join(' ').toLocaleLowerCase().replace(/\s+/g, '').includes(needle);
  });
}
