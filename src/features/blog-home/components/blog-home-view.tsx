import {ContentPlaceholder} from "@/components/content-placeholder";
import Link from "next/link";
import {BlogPosts} from "../../post/components/blog-posts";
import {BlogActivityDisplay} from "./blog-activity-display";
import {activityCalendar} from "../activity-calendar";
import type { BlogActivity, BlogHomeSettings, HomeSectionKey } from "../api/blog-home";
import type { ProjectDetail } from "../../project/api/project-list";
import type { PostPage } from "../../post/api/post-list";
import { safeMediaUrl } from "../../media/model";

const titles: Record<HomeSectionKey, string> = { ACTIVITY: "블로그 활동", TECH_STACKS: "기술 스택", PROJECTS: "대표 프로젝트", RECENT_POSTS: "인기 글" };
function Activity({ data }: { data: BlogActivity }) {
  const {cells,months,total,activeDays}=activityCalendar(data);
  return <div className="blog-home-activity">
    <p className="sr-only" id="blog-activity-description">최근 1년 동안 날짜별 공개 글 수입니다. 월요일부터 일요일 순서이며 진한 초록색일수록 글이 많습니다.</p>
    <div className="blog-activity-scroll" role="group" aria-label={`${data.from}부터 ${data.to}까지 날짜별 공개 글 수`} aria-describedby="blog-activity-description" tabIndex={0}>
      <div className="blog-activity-chart">
        <div className="blog-activity-weekdays" aria-hidden="true">{["월","","수","","금","","일"].map((day,index)=><span key={index}>{day}</span>)}</div>
        <div className="blog-activity-calendar">
          <div className="blog-activity-months" aria-hidden="true">{months.map((month,index)=><span key={index} style={{gridColumn:month.week+1}}>{month.label}</span>)}</div>
          <ol className="blog-activity-grid" aria-label="월요일부터 일요일 순서의 활동 달력">
            {cells.map((cell,index)=>cell?<li key={cell.date}><span role="img" className={`blog-activity-day activity-${cell.level}`} title={`${cell.date}: 공개 글 ${cell.count}개`} aria-label={`${cell.date}, 공개 글 ${cell.count}개`}/></li>:<li key={`pad-${index}`} aria-hidden="true" className="blog-activity-day is-pad"/>)}
          </ol>
        </div>
      </div>
    </div>
    <div className="blog-activity-footer"><p className="blog-activity-help">최근 1년간 공개한 글</p><div className="blog-activity-footer-meta"><p className="blog-activity-summary">글 {total}개 · 기록한 날 {activeDays}일</p><div className="blog-activity-legend" aria-label="활동량 범례: 공개 글 없음, 1개, 2~3개, 4~5개, 6개 이상"><span>적음</span>{[0,1,2,3,4].map(level=><span key={level} className={`blog-activity-day activity-${level}`} aria-hidden="true"/>)}<span>많음</span></div></div></div>
  </div>;
}

function Stacks({ items }: { items: string[] }) {
  return items.length ? <ul className="blog-tech-list">{items.map(name => <li key={name}><span>{name}</span></li>)}</ul> : <p className="blog-home-empty">아직 공개한 기술 스택이 없어요.</p>;
}
function Projects({ projects, configured, failed }: { projects: ProjectDetail[]; configured: boolean; failed: boolean }) {
  if (!projects.length) return failed ? <p className="blog-home-empty" role="alert">대표 프로젝트를 불러오지 못했어요.</p> : <p className="blog-home-empty">{configured ? "대표 프로젝트가 공개 상태인지 확인해 주세요." : "아직 대표 프로젝트를 설정하지 않았어요."}</p>;
  return <ul className="blog-home-projects">{projects.map(project => {
    const image = safeMediaUrl(project.thumbnailUrl ?? project.media?.find(item => item.mediaRole === "THUMBNAIL")?.url ?? null);
    return <li key={project.id}><Link href={`/projects/${project.id}`} prefetch={false} className="blog-home-project">
      <span className="blog-home-project-copy"><strong>{project.name}</strong>{project.summary && <span>{project.summary}</span>}<span className="blog-home-tags">{project.techStacks.map(tag => <span key={tag.id}>{tag.name}</span>)}</span></span>
      {image ? <img src={image} alt="" width={250} height={165}/> : <ContentPlaceholder kind="project" className="blog-project-placeholder"/>}
    </Link></li>;
  })}</ul>;
}
export function BlogHomeView({ handle, settings, activity, projects, projectErrors, hasFeaturedProjects, posts, postsFailed, authorId }: { authorId:string; handle: string; settings: BlogHomeSettings; activity: BlogActivity; projects: ProjectDetail[]; projectErrors: number; hasFeaturedProjects: boolean; posts: PostPage | null; postsFailed: boolean }) {
  const visibleSections = settings.sections.filter(section => section.visible);
  const sections = visibleSections;
  return <section className="blog-home-content" aria-label="블로그 홈">
    {sections.map(section => <div className="blog-home-block" key={section.key}>
      {section.key === "ACTIVITY" && <BlogActivityDisplay handle={handle} defaultDisplay={settings.activityDisplay} grass={<Activity data={activity}/>}/>}
      {section.key === "TECH_STACKS" && <section className="blog-home-section" aria-labelledby="home-tech-title"><h2 id="home-tech-title">{titles.TECH_STACKS}</h2><Stacks items={settings.techStacks}/></section>}
      {section.key === "PROJECTS" && <section className="blog-home-section" aria-labelledby="home-projects-title"><div className="blog-home-section-title"><h2 id="home-projects-title">{titles.PROJECTS}</h2><Link href={`/blogs/${handle}?view=projects`}>전체 프로젝트 보기 →</Link></div><Projects projects={projects.slice(0,settings.featuredProjectLimit??6)} configured={hasFeaturedProjects} failed={projectErrors > 0}/>{projectErrors > 0 && projects.length > 0 && <p className="blog-home-empty" role="alert">일부 대표 프로젝트를 불러오지 못했어요.</p>}</section>}
      {section.key === "RECENT_POSTS" && <section className="blog-home-section" aria-labelledby="home-posts-title"><div className="blog-home-section-title"><h2 id="home-posts-title">{titles.RECENT_POSTS}</h2><Link href={`/blogs/${handle}?view=boards`}>게시판 글 보기 →</Link></div><BlogPosts initial={posts} failed={postsFailed} handle={handle} authorId={authorId} variant="popular"/></section>}
    </div>)}
  </section>;
}
