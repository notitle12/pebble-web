import type { BlogLinks } from "../api/blog-tools";

export function PublicBlogLinks({ links, failed = false }: { links: BlogLinks | null; failed?: boolean }) {
  if (failed) return <section className="blog-external-links"><h2>외부 링크</h2><p role="status">외부 링크를 불러오지 못했어요.</p></section>;
  if (!links || (!links.githubUrl && links.sites.length === 0)) return null;
  return <section className="blog-external-links" aria-label="외부 링크">
    <h2>외부 링크</h2>
    {links.githubUrl && <a href={links.githubUrl} target="_blank" rel="noopener noreferrer" aria-label="GitHub (새 창)">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.08c-3.1.67-3.76-1.31-3.76-1.31-.5-1.28-1.24-1.62-1.24-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 .1.75 2.13 3.13 1.63.1-.72.39-1.21.71-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.21 1.15-2.99-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.14a10.6 10.6 0 0 1 5.55 0c2.11-1.44 3.05-1.14 3.05-1.14.61 1.54.23 2.68.11 2.96.72.78 1.15 1.77 1.15 2.99 0 4.29-2.61 5.24-5.1 5.52.4.34.76 1.02.76 2.06v3.06c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"/></svg>
      <span>GitHub</span>
    </a>}
    {links.sites.map(site => <a key={site.id} href={site.url} target="_blank" rel="noopener noreferrer">
      {site.logoUrl ? <img src={site.logoUrl} alt=""/> : <span className="blog-link-fallback" aria-hidden="true">↗</span>}
      <span>{site.label}</span>
    </a>)}
  </section>;
}
