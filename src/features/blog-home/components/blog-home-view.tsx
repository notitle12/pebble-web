import Link from "next/link";
import type { BlogActivity, BlogHomeSettings, HomeSectionKey } from "../api/blog-home";
import type { ProjectDetail } from "../../project/api/project-list";
import type { PostPage } from "../../post/api/post-list";
import { safeMediaUrl } from "../../media/model";

const titles: Record<HomeSectionKey, string> = { ACTIVITY: "블로그 활동", TECH_STACKS: "기술 스택", PROJECTS: "대표 프로젝트", RECENT_POSTS: "최근 글" };
const techLogos: Record<string, string> = {
  java: "/tech/java.svg", "spring boot": "/tech/spring.svg", springboot: "/tech/spring.svg", spring: "/tech/spring.svg",
  postgresql: "/tech/postgresql.svg", postgres: "/tech/postgresql.svg", redis: "/tech/redis.svg", react: "/tech/react.svg", typescript: "/tech/typescript.svg",
};
function Activity({ data }: { data: BlogActivity }) {
  const byDate = new Map(data.days.map(day => [day.date, day.count]));
  const start = new Date(`${data.from}T00:00:00Z`);
  const end = new Date(`${data.to}T00:00:00Z`);
  const dates: string[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) dates.push(cursor.toISOString().slice(0, 10));
  const firstOffset = (new Date(`${data.from}T00:00:00Z`).getUTCDay() + 6) % 7;
  const padded = [...Array(firstOffset).fill(null), ...dates];
  return <section className="blog-home-section blog-home-activity" aria-labelledby="home-activity-title">
    <div className="blog-home-section-title"><h2 id="home-activity-title">{titles.ACTIVITY}</h2><span>{data.days.reduce((sum, item) => sum + item.count, 0)}회</span></div>
    <p className="sr-only" id="blog-activity-description">최근 1년 동안 날짜별 공개 글 수를 보여줍니다. 날짜별 수량은 각 날짜 칸의 대체 텍스트에서 확인할 수 있습니다.</p><div className="blog-activity-scroll" role="group" aria-label={`${data.from}부터 ${data.to}까지 날짜별 공개 글 수`} aria-describedby="blog-activity-description">
      <ol className="blog-activity-grid" aria-label="월요일부터 일요일 순서의 활동 달력">
        {padded.map((date, index) => {
          if (!date) return <li key={`pad-${index}`} aria-hidden="true" className="blog-activity-day is-pad"/>;
          const count = byDate.get(date) ?? 0;
          return <li key={date}><span role="img" className={`blog-activity-day activity-${count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4}`} title={`${date}: 공개 글 ${count}개`} aria-label={`${date}, 공개 글 ${count}개`}/></li>;
        })}
      </ol>
    </div>
    <p className="blog-activity-help">최근 1년간 공개한 글을 보여줘요.</p>
  </section>;
}
function Stacks({ items }: { items: string[] }) {
  return items.length ? <ul className="blog-tech-list">{items.map(name => { const logo = techLogos[name.normalize("NFKC").toLocaleLowerCase("und")]; return <li key={name}>{logo ? <img className="blog-tech-logo" src={logo} alt="" width={24} height={24} loading="lazy"/> : <span className="blog-tech-mark" aria-hidden="true">{Array.from(name)[0]?.toLocaleUpperCase()}</span>}<span>{name}</span></li>; })}</ul> : <p className="blog-home-empty">아직 공개한 기술 스택이 없어요.</p>;
}
function Projects({ projects, configured, failed }: { projects: ProjectDetail[]; configured: boolean; failed: boolean }) {
  if (!projects.length) return failed ? <p className="blog-home-empty" role="alert">대표 프로젝트를 불러오지 못했어요.</p> : <p className="blog-home-empty">{configured ? "대표 프로젝트가 공개 상태인지 확인해 주세요." : "아직 대표 프로젝트를 설정하지 않았어요."}</p>;
  return <ul className="blog-home-projects">{projects.map(project => {
    const image = safeMediaUrl(project.media.find(item => item.mediaRole === "THUMBNAIL")?.url ?? null);
    return <li key={project.id}><Link href={`/projects/${project.id}`} prefetch={false} className="blog-home-project">
      {image ? <img src={image} alt="" width={112} height={76}/> : <span className="blog-project-placeholder" aria-hidden="true">{Array.from(project.name)[0]}</span>}
      <span className="blog-home-project-copy"><strong>{project.name}</strong>{project.summary && <span>{project.summary}</span>}<span className="blog-home-tags">{project.tags.map(tag => <span key={tag.id}>{tag.name}</span>)}</span></span>
    </Link></li>;
  })}</ul>;
}
function RecentPosts({ posts, postsFailed, handle }: { posts: PostPage | null; postsFailed: boolean; handle: string }) {
  if (!posts?.content.length) return <p className="blog-home-empty" role={postsFailed ? "alert" : undefined}>{postsFailed ? "최근 글을 불러오지 못했어요." : "아직 공개된 글이 없어요."}</p>;
  return <ul className="blog-home-posts">{posts.content.slice(0, 3).map(post => <li key={post.id}><Link href={`/blogs/${encodeURIComponent(handle)}/posts/${encodeURIComponent(post.urlKey)}`} prefetch={false}>
    {post.thumbnailUrl ? <img src={post.thumbnailUrl} alt="" width={48} height={48}/> : <span className="blog-post-placeholder" aria-hidden="true">글</span>}
    <span className="blog-home-post-copy"><strong>{post.title}</strong>{post.summary && <span>{post.summary}</span>}</span><time dateTime={post.publishedAt??post.createdAt}>{new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(post.publishedAt??post.createdAt))}</time>
  </Link></li>)}</ul>;
}
export function BlogHomeView({ handle, settings, activity, projects, projectErrors, hasFeaturedProjects, posts, postsFailed }: { handle: string; settings: BlogHomeSettings; activity: BlogActivity; projects: ProjectDetail[]; projectErrors: number; hasFeaturedProjects: boolean; posts: PostPage | null; postsFailed: boolean }) {
  return <section className="blog-home-content" aria-label="블로그 홈">
    <h2 className="blog-home-heading">홈</h2>
    {settings.sections.filter(section => section.visible).map(section => <div className="blog-home-block" key={section.key}>
      {section.key === "ACTIVITY" && <Activity data={activity}/>}
      {section.key === "TECH_STACKS" && <section className="blog-home-section" aria-labelledby="home-tech-title"><h2 id="home-tech-title">{titles.TECH_STACKS}</h2><Stacks items={settings.techStacks}/></section>}
      {section.key === "PROJECTS" && <section className="blog-home-section" aria-labelledby="home-projects-title"><div className="blog-home-section-title"><h2 id="home-projects-title">{titles.PROJECTS}</h2><Link href={`/blogs/${handle}?view=projects`}>전체 프로젝트 보기 →</Link></div><Projects projects={projects} configured={hasFeaturedProjects} failed={projectErrors > 0}/>{projectErrors > 0 && projects.length > 0 && <p className="blog-home-empty" role="alert">일부 대표 프로젝트를 불러오지 못했어요.</p>}</section>}
      {section.key === "RECENT_POSTS" && <section className="blog-home-section" aria-labelledby="home-posts-title"><div className="blog-home-section-title"><h2 id="home-posts-title">{titles.RECENT_POSTS}</h2><Link href={`/blogs/${handle}?view=posts`}>전체 글 보기 →</Link></div><RecentPosts posts={posts} postsFailed={postsFailed} handle={handle}/></section>}
    </div>)}
  </section>;
}
