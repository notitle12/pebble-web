"use client";
import { useState, type ReactNode } from "react";
import { SidebarToggle } from "../../blog-home/components/sidebar-toggle";
export function BlogSidebar({children,footer}:{children:ReactNode;footer:ReactNode}) {
  const [collapsed,setCollapsed]=useState(false);
  return <aside id="blog-sidebar" className="personal-blog-profile" aria-label="블로그 정보" data-collapsed={collapsed}>
    <SidebarToggle collapsed={collapsed} onToggle={()=>setCollapsed(value=>!value)}/>
    <div id="blog-sidebar-content" className="blog-sidebar-content" hidden={collapsed} inert={collapsed}>{children}</div>
    <div className="blog-sidebar-footer" hidden={collapsed} inert={collapsed}>{footer}</div>
  </aside>;
}
