"use client";
export function SidebarToggle({collapsed,onToggle}:{collapsed:boolean;onToggle:()=>void}) {
  return <button className="blog-sidebar-toggle" type="button" aria-label={collapsed ? "블로그 사이드바 펼치기" : "블로그 사이드바 접기"} aria-expanded={!collapsed} aria-controls="blog-sidebar-content" onClick={onToggle}>
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={collapsed ? "m6 3 5 5-5 5" : "m10 3-5 5 5 5"}/></svg>
  </button>;
}
