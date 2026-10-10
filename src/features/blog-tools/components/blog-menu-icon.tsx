export type BlogMenuIconName = "search" | "home" | "posts" | "boards" | "projects" | "folder" | "links" | "chevron";
const paths: Record<BlogMenuIconName, React.ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></>,
  home: <path d="m3.5 10 8.5-7 8.5 7v10a1 1 0 0 1-1 1h-5.5v-7h-4v7H4.5a1 1 0 0 1-1-1z"/>,
  posts: <><path d="M7 3.5h7l5 5V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M14 3.5v5h5M9 13h6M9 16.5h6"/></>,
  boards: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11"/></>,
  projects: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3M3 12h18M10 12v3h4v-3"/></>,
  folder: <path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>,
  links: <><path d="m10 13 4-4M8 15l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M14 9l2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 -1)"/></>,
  chevron: <path d="m6 9 6 6 6-6"/>,
};
export function BlogMenuIcon({name}: {name: BlogMenuIconName}) {
  return <svg className={`blog-menu-icon icon-${name}`} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
