"use client";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { SidebarToggle } from "../../blog-home/components/sidebar-toggle";
import { BlogMenuIcon } from "./blog-menu-icon";
import { blogHref } from "../../post/api/public-blog";

type BoardItem = {id: string; name: string; depth: number};
type ProjectItem = {id: string; name: string};
type Props = {children: ReactNode; footer: ReactNode; links: ReactNode; handle: string; query?: string;
  homeView: boolean; selected?: string; projectView: boolean; searched: boolean;
  boards: BoardItem[]; projects: ProjectItem[]; boardError: boolean; projectError: boolean};
export function BlogSidebar({children,footer,links,handle,query,homeView,selected,projectView,searched,boards,projects,boardError,projectError}: Props) {
  const [collapsed,setCollapsed]=useState(false);
  const [postsOpen,setPostsOpen]=useState(true);
  const [boardsOpen,setBoardsOpen]=useState(true);
  const [projectsOpen,setProjectsOpen]=useState(true);
  const searchInput=useRef<HTMLInputElement>(null);
  const homeHref=`/blogs/${encodeURIComponent(handle)}`;
  const projectsHref=`${homeHref}?view=projects`;
  const allPosts=!homeView&&!selected&&!projectView&&!searched;
  function openSearch() { setCollapsed(false); requestAnimationFrame(()=>searchInput.current?.focus()); }
  function openBoards() { setCollapsed(false); setPostsOpen(true); setBoardsOpen(true); }
  return <aside id="blog-sidebar" className="personal-blog-profile" aria-label="블로그 정보" data-collapsed={collapsed}>
    <SidebarToggle collapsed={collapsed} onToggle={()=>setCollapsed(value=>!value)}/>
    <div id="blog-sidebar-content" className="blog-sidebar-content" hidden={collapsed} inert={collapsed}>
      {children}
      <form className="blog-search-form" action={homeHref} method="get"><label className="sr-only" htmlFor="blog-search">이 블로그에서 검색</label><div><input ref={searchInput} id="blog-search" name="q" type="search" maxLength={200} defaultValue={query??""} placeholder="이 블로그에서 검색"/><button type="submit" aria-label="블로그 검색"><BlogMenuIcon name="search"/></button></div></form>
      <nav className="blog-tree-nav" aria-label="블로그 메뉴">
        <Link className="blog-menu-row" href={homeHref} aria-current={homeView?"page":undefined}><BlogMenuIcon name="home"/><span>홈</span></Link>
        <div className="blog-menu-parent"><Link className="blog-menu-row" href={blogHref(handle,0)} aria-current={allPosts?"page":undefined}><BlogMenuIcon name="posts"/><span>전체 게시글</span></Link><button type="button" className="blog-menu-disclosure" aria-expanded={postsOpen} aria-controls="blog-post-folders" aria-label={`게시판과 프로젝트 ${postsOpen?"접기":"펼치기"}`} onClick={()=>setPostsOpen(value=>!value)}><BlogMenuIcon name="chevron"/></button></div>
        <div id="blog-post-folders" className="blog-post-folders" hidden={!postsOpen}>
          <section className="blog-folder-group" aria-label="게시판">
            <button type="button" className="blog-menu-row blog-group-toggle" aria-expanded={boardsOpen} aria-controls="blog-board-folders" onClick={()=>setBoardsOpen(value=>!value)}><BlogMenuIcon name="boards"/><span>게시판</span><BlogMenuIcon name="chevron"/></button>
            <div id="blog-board-folders" className="blog-folder-items" hidden={!boardsOpen}>
              {boards.map(board=><Link key={board.id} href={blogHref(handle,0,board.id)} aria-current={selected===board.id?"page":undefined} style={{paddingInlineStart:`${12+board.depth*14}px`}}>{board.depth>0&&<span className="blog-board-branch" aria-hidden="true">└</span>}<BlogMenuIcon name="folder"/><span>{board.name}</span></Link>)}
              {boardError&&<p role="status">게시판을 불러오지 못했어요.</p>}
            </div>
          </section>
          <section className="blog-folder-group" aria-label="블로그 프로젝트">
            <button type="button" className="blog-menu-row blog-group-toggle" aria-expanded={projectsOpen} aria-controls="blog-project-folders" onClick={()=>setProjectsOpen(value=>!value)}><BlogMenuIcon name="projects"/><span>프로젝트</span><BlogMenuIcon name="chevron"/></button>
            <div id="blog-project-folders" className="blog-folder-items" hidden={!projectsOpen}>
              <Link href={projectsHref} aria-current={projectView?"page":undefined}><BlogMenuIcon name="folder"/><span>전체 프로젝트</span></Link>
              {projects.map(project=><Link key={project.id} href={`/projects/${project.id}`} prefetch={false}><BlogMenuIcon name="folder"/><span>{project.name}</span></Link>)}
              {projectError&&<p role="status">프로젝트를 불러오지 못했어요.</p>}
            </div>
          </section>
        </div>
      </nav>
      {links}
    </div>
    {collapsed&&<nav className="blog-icon-rail" aria-label="블로그 빠른 메뉴">
      <button type="button" aria-label="블로그 검색 열기" title="검색" onClick={openSearch}><BlogMenuIcon name="search"/></button>
      <Link href={homeHref} aria-label="블로그 홈" title="홈" aria-current={homeView?"page":undefined}><BlogMenuIcon name="home"/></Link>
      <Link href={blogHref(handle,0)} aria-label="전체 게시글" title="전체 게시글" aria-current={allPosts?"page":undefined}><BlogMenuIcon name="posts"/></Link>
      <button type="button" aria-label="게시판 메뉴 펼치기" title="게시판" onClick={openBoards}><BlogMenuIcon name="boards"/></button>
      <Link href={projectsHref} aria-label="블로그 프로젝트" title="프로젝트" aria-current={projectView?"page":undefined}><BlogMenuIcon name="projects"/></Link>
    </nav>}
    <div className="blog-sidebar-footer" hidden={collapsed} inert={collapsed}>{footer}</div>
  </aside>;
}
