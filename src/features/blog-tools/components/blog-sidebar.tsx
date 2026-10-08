import type { ReactNode } from "react";
export function BlogSidebar({children,footer}:{children:ReactNode;footer:ReactNode}) {
  return <aside className="personal-blog-profile" aria-label="블로그 정보">
    <div className="blog-sidebar-content">{children}</div>
    {footer}
  </aside>;
}
