"use client";
import {IntentLink as Link} from "@/components/intent-link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SidebarToggle } from "../../blog-home/components/sidebar-toggle";
import { BlogMenuIcon } from "./blog-menu-icon";
import { blogHref } from "../../post/api/public-blog";
import {SIDEBAR_MENU_KEYS,type SidebarMenuKey} from "../../blog-home/sidebar-order";
import {publicPostSeriesHref} from "../../post/api/post-series";
import type { Board } from "@/features/board/api/boards";

type ProjectItem = { id: string; name: string };
type Props = {
  visitors: ReactNode;
  footer: ReactNode;
  links: ReactNode;
  handle: string;
  homeView: boolean;
  selected?: string;
  projectView: boolean;
  boardView: boolean;
  seriesView: boolean;
  seriesId?:string;
  series:ProjectItem[];
  sidebarOrder:SidebarMenuKey[];
  seriesError:boolean;
  navigationError:boolean;
  searched: boolean;
  boards: Board[];
  projects: ProjectItem[];
  boardError: boolean;
  projectError: boolean;
};

function getAllParentFolderIds(items: Board[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      ids.push(item.id);
      ids.push(...getAllParentFolderIds(item.children));
    }
  }
  return ids;
}

function findFolderAncestors(items: Board[], targetId: string, currentPath: string[] = []): string[] | null {
  for (const item of items) {
    if (item.id === targetId) return currentPath;
    if (item.children && item.children.length > 0) {
      const found = findFolderAncestors(item.children, targetId, [...currentPath, item.id]);
      if (found) return found;
    }
  }
  return null;
}

export function BlogSidebar({
  visitors,
  footer,
  links,
  handle,
  homeView,
  selected,
  projectView,
  boardView,
  seriesView,seriesId,series,sidebarOrder=[...SIDEBAR_MENU_KEYS],seriesError,navigationError,
  searched,
  boards,
  projects,
  boardError,
  projectError,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(max-width: 640px)").matches) setCollapsed(true);
  }, []);

  const [boardsOpen, setBoardsOpen] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [seriesOpen,setSeriesOpen]=useState(true);
  useEffect(()=>{if(seriesId)setSeriesOpen(true);},[seriesId]);

  const allParents = useMemo(() => getAllParentFolderIds(boards), [boards]);
  const [openSubfolders, setOpenSubfolders] = useState<Set<string>>(() => new Set(allParents));

  useEffect(() => {
    setOpenSubfolders((prev) => {
      const next = new Set(prev);
      allParents.forEach((id) => next.add(id));
      return next;
    });
  }, [allParents]);

  useEffect(() => {
    if (selected) {
      const ancestors = findFolderAncestors(boards, selected);
      if (ancestors && ancestors.length > 0) {
        setOpenSubfolders((prev) => {
          const next = new Set(prev);
          ancestors.forEach((id) => next.add(id));
          return next;
        });
      }
    }
  }, [selected, boards]);

  function toggleSubfolder(id: string) {
    setOpenSubfolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const homeHref = `/blogs/${encodeURIComponent(handle)}`;
  const projectsHref = `${homeHref}?view=projects`;
  const boardsHref = `${homeHref}?view=boards`;
  const seriesHref = `${homeHref}?view=series`;
  const isAllBoardsActive = (boardView || (!homeView && !projectView && !seriesView && !selected && !searched)) && !selected;

  function renderBoardTree(item: Board, depth: number) {
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openSubfolders.has(item.id);
    const isCurrent = selected === item.id;
    return (
      <div key={item.id} className="blog-board-tree-node">
        <div className="blog-menu-parent" style={{ paddingInlineStart: `${depth * 14}px` }}>
          <Link
            className="blog-menu-row blog-board-row-link"
            href={blogHref(handle, 0, item.id)}
            aria-current={isCurrent ? "page" : undefined}
          >
            <span className="blog-board-folder">
              {depth > 0 && <span className="blog-board-branch" aria-hidden="true" />}
              <BlogMenuIcon name="folder" />
            </span>
            <span>{item.name}</span>
          </Link>
          {hasChildren && (
            <button
              type="button"
              className="blog-menu-disclosure"
              aria-label={`${item.name} 하위 폴더 ${isOpen ? "접기" : "펼치기"}`}
              aria-expanded={isOpen}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleSubfolder(item.id);
              }}
            >
              <BlogMenuIcon name="chevron" />
            </button>
          )}
        </div>
        {hasChildren && isOpen && (
          <div className="blog-board-subtree">
            {item.children.map((child) => renderBoardTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  const menu={BOARDS:{href:boardsHref,label:"게시판",icon:"boards" as const,active:isAllBoardsActive},PROJECTS:{href:projectsHref,label:"프로젝트",icon:"projects" as const,active:projectView},SERIES:{href:seriesHref,label:"시리즈",icon:"boards" as const,active:seriesView}};
  const groups:Record<SidebarMenuKey,ReactNode>={
    BOARDS:(<section key="BOARDS" data-sidebar-section="BOARDS" className="blog-folder-group" aria-label="게시판">
            <div className="blog-menu-parent">
              <Link className="blog-menu-row" href={boardsHref} aria-current={isAllBoardsActive ? "page" : undefined}>
                <BlogMenuIcon name="boards" />
                <span>게시판</span>
              </Link>
              <button
                type="button"
                className="blog-menu-disclosure"
                aria-label={`게시판 폴더 ${boardsOpen ? "접기" : "펼치기"}`}
                aria-expanded={boardsOpen}
                aria-controls="blog-board-folders"
                onClick={() => setBoardsOpen((value) => !value)}
              >
                <BlogMenuIcon name="chevron" />
              </button>
            </div>
            <div id="blog-board-folders" className="blog-folder-items" hidden={!boardsOpen}>
              {boards.map((board) => renderBoardTree(board, 0))}
              {boardError && <p role="status">게시판을 불러오지 못했어요.</p>}
            </div>
          </section>),
    PROJECTS:(<section key="PROJECTS" data-sidebar-section="PROJECTS" className="blog-folder-group" aria-label="블로그 프로젝트">
            <div className="blog-menu-parent">
              <Link className="blog-menu-row" href={projectsHref} aria-current={projectView ? "page" : undefined}>
                <BlogMenuIcon name="projects" />
                <span>프로젝트</span>
              </Link>
              <button
                type="button"
                className="blog-menu-disclosure"
                aria-label={`프로젝트 폴더 ${projectsOpen ? "접기" : "펼치기"}`}
                aria-expanded={projectsOpen}
                aria-controls="blog-project-folders"
                onClick={() => setProjectsOpen((value) => !value)}
              >
                <BlogMenuIcon name="chevron" />
              </button>
            </div>
            <div id="blog-project-folders" className="blog-folder-items" hidden={!projectsOpen}>
              {projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} prefetch={false}>
                  <BlogMenuIcon name="folder" />
                  <span>{project.name}</span>
                </Link>
              ))}
              {projectError && <p role="status">프로젝트를 불러오지 못했어요.</p>}
            </div>
          </section>),
    SERIES:(<section key="SERIES" data-sidebar-section="SERIES" className="blog-folder-group" aria-label="블로그 시리즈">
      <div className="blog-menu-parent">
        <Link className="blog-menu-row" href={seriesHref} aria-current={seriesView&&!seriesId?"page":undefined}><BlogMenuIcon name="boards"/><span>시리즈</span></Link>
        <button type="button" className="blog-menu-disclosure" aria-label={`시리즈 폴더 ${seriesOpen?"접기":"펼치기"}`} aria-expanded={seriesOpen} aria-controls="blog-series-folders" onClick={()=>setSeriesOpen(value=>!value)}><BlogMenuIcon name="chevron"/></button>
      </div>
      <div id="blog-series-folders" className="blog-folder-items" hidden={!seriesOpen}>
        {series.map(item=><Link key={item.id} href={publicPostSeriesHref(handle,item.id)} aria-current={seriesView&&seriesId===item.id?"page":undefined}><BlogMenuIcon name="folder"/><span>{item.name}</span></Link>)}
        {seriesError&&<p role="status">시리즈를 불러오지 못했어요.</p>}
      </div>
    </section>),
  };

  return (
    <aside id="blog-sidebar" className="personal-blog-profile" aria-label="블로그 탐색" data-collapsed={collapsed}>
      <SidebarToggle collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div id="blog-sidebar-content" className="blog-sidebar-content" hidden={collapsed} inert={collapsed}>
        <div className="blog-sidebar-visitors">{visitors}</div>
        <nav className="blog-tree-nav" aria-label="블로그 메뉴">
          <Link className="blog-menu-row" href={homeHref} aria-current={homeView ? "page" : undefined}>
            <BlogMenuIcon name="home" />
            <span>홈</span>
          </Link>

          {sidebarOrder.map(key=>groups[key])}
        </nav>
        {navigationError&&<p className="blog-navigation-error" role="status">메뉴 순서를 불러오지 못했어요.</p>}
        {links}
      </div>
      {collapsed && (
        <nav className="blog-icon-rail" aria-label="블로그 빠른 메뉴">
          <Link href={homeHref} aria-label="블로그 홈" title="홈" aria-current={homeView ? "page" : undefined}>
            <BlogMenuIcon name="home" />
          </Link>
          {sidebarOrder.map(key=>{const item=menu[key];return <Link key={key} href={item.href} aria-label={`블로그 ${item.label}`} title={item.label} aria-current={item.active?"page":undefined}><BlogMenuIcon name={item.icon}/></Link>;})}
        </nav>
      )}
      <div className="blog-sidebar-footer" hidden={collapsed} inert={collapsed}>
        {footer}
      </div>
    </aside>
  );
}
