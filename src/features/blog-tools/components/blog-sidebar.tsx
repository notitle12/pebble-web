"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { SidebarToggle } from "../../blog-home/components/sidebar-toggle";
import { BlogMenuIcon } from "./blog-menu-icon";
import { blogHref } from "../../post/api/public-blog";

type BoardItem = {id: string; name: string; depth: number};
type ProjectItem = {id: string; name: string};
type Props = {footer: ReactNode; links: ReactNode; handle: string;
  homeView: boolean; selected?: string; projectView: boolean; boardView: boolean; searched: boolean;
  boards: BoardItem[]; projects: ProjectItem[]; boardError: boolean; projectError: boolean};
export function BlogSidebar({footer,links,handle,homeView,selected,projectView,boardView,searched,boards,projects,boardError,projectError}: Props) {
  const [collapsed,setCollapsed]=useState(false);
  useEffect(()=>{if(window.matchMedia("(max-width: 640px)").matches)setCollapsed(true);},[]);
  const [postsOpen,setPostsOpen]=useState(true);
  const [boardsOpen,setBoardsOpen]=useState(true);
  const [projectsOpen,setProjectsOpen]=useState(true);
  const homeHref=`/blogs/${encodeURIComponent(handle)}`;
  const projectsHref=`${homeHref}?view=projects`;
  const boardsHref=`${homeHref}?view=boards`;
  const allPosts=!homeView&&!selected&&!projectView&&!boardView&&!searched;
  function openSearch() { document.getElementById("blog-search")?.focus(); }
  return <aside id="blog-sidebar" className="personal-blog-profile" aria-label="블로그 탐색" data-collapsed={collapsed}>
    <SidebarToggle collapsed={collapsed} onToggle={()=>setCollapsed(value=>!value)}/>
    <div id="blog-sidebar-content" className="blog-sidebar-content" hidden={collapsed} inert={collapsed}>

      <nav className="blog-tree-nav" aria-label="블로그 메뉴">
        <Link className="blog-menu-row" href={homeHref} aria-current={homeView?"page":undefined}><BlogMenuIcon name="home"/><span>홈</span></Link>
        <div className="blog-menu-parent"><Link className="blog-menu-row" href={blogHref(handle,0)} aria-current={allPosts?"page":undefined}><BlogMenuIcon name="posts"/><span>전체 게시글</span></Link><button type="button" className="blog-menu-disclosure" aria-expanded={postsOpen} aria-controls="blog-post-folders" aria-label={`게시판과 프로젝트 ${postsOpen?"접기":"펼치기"}`} onClick={()=>setPostsOpen(value=>!value)}><BlogMenuIcon name="chevron"/></button></div>
        <div id="blog-post-folders" className="blog-post-folders" hidden={!postsOpen}>
          <section className="blog-folder-group" aria-label="게시판">
            <div className="blog-menu-parent"><Link className="blog-menu-row" href={boardsHref} aria-current={boardView&&!selected?"page":undefined}><BlogMenuIcon name="boards"/><span>게시판</span></Link><button type="button" className="blog-menu-disclosure" aria-label={`게시판 폴더 ${boardsOpen?"접기":"펼치기"}`} aria-expanded={boardsOpen} aria-controls="blog-board-folders" onClick={()=>setBoardsOpen(value=>!value)}><BlogMenuIcon name="chevron"/></button></div>
            <div id="blog-board-folders" className="blog-folder-items" hidden={!boardsOpen}>
              {boards.map(board=><Link key={board.id} href={blogHref(handle,0,board.id)} aria-current={selected===board.id?"page":undefined} style={{paddingInlineStart:`${8+board.depth*12}px`}}><span className="blog-board-folder">{board.depth>0&&<span className="blog-board-branch" aria-hidden="true"/>}<BlogMenuIcon name="folder"/></span><span>{board.name}</span></Link>)}
              {boardError&&<p role="status">게시판을 불러오지 못했어요.</p>}
            </div>
          </section>
          <section className="blog-folder-group" aria-label="블로그 프로젝트">
            <div className="blog-menu-parent"><Link className="blog-menu-row" href={projectsHref} aria-current={projectView?"page":undefined}><BlogMenuIcon name="projects"/><span>프로젝트</span></Link><button type="button" className="blog-menu-disclosure" aria-label={`프로젝트 폴더 ${projectsOpen?"접기":"펼치기"}`} aria-expanded={projectsOpen} aria-controls="blog-project-folders" onClick={()=>setProjectsOpen(value=>!value)}><BlogMenuIcon name="chevron"/></button></div>
            <div id="blog-project-folders" className="blog-folder-items" hidden={!projectsOpen}>
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
      <Link href={boardsHref} aria-label="게시판 전체 글" title="게시판" aria-current={boardView&&!selected?"page":undefined}><BlogMenuIcon name="boards"/></Link>
      <Link href={projectsHref} aria-label="블로그 프로젝트" title="프로젝트" aria-current={projectView?"page":undefined}><BlogMenuIcon name="projects"/></Link>
    </nav>}
    <div className="blog-sidebar-footer" hidden={collapsed} inert={collapsed}>{footer}</div>
  </aside>;
}
