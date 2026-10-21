import Link from "next/link";
import { ProjectCover } from "./project-cover";
import { LikeCount } from "@/features/like/components/like-count";
import type { ProjectPage } from "../api/project-list";

const format = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" });

type Props = {
  handle: string;
  initial: ProjectPage | null;
  page?: number;
  failed?: boolean;
};

export function BlogProjects({ handle, initial, page = 0, failed = false }: Props) {
  const data = initial;
  const href = (next: number) => `/blogs/${encodeURIComponent(handle)}?view=projects${next > 0 ? `&page=${next}` : ""}`;
  if (failed || !data) {
    return <div className="list-state"><p role="alert">프로젝트를 불러오지 못했어요.</p><Link className="button" href={href(page)}>다시 시도</Link></div>;
  }

  if (!data || !data.content.length) {
    return (
      <section className="list-state">
        <h2>{page > 0 ? "이 페이지에는 프로젝트가 없어요" : "아직 공개된 프로젝트가 없어요"}</h2>
        <p>{"새로운 프로젝트가 등록되면 이곳에서 만나볼 수 있어요."}</p>
        {page > 0 && (
          <Link className="button" href={href(0)}>
            첫 페이지로
          </Link>
        )}
      </section>
    );
  }

  return (
    <>
      <ul className="project-grid">
        {data.content.map((project, idx) => {
          const date = project.publishedAt ?? project.createdAt;
          return (
            <li key={project.id}>
              <article className="project-tile">
                <Link className="project-cover-link" href={`/projects/${project.id}`} prefetch={false} aria-label={`${project.name} 프로젝트 보기`}>
                  <ProjectCover title={project.name} techStacks={project.techStacks.map((tag) => tag.name)} index={page * 20 + idx + 1} imageUrl={project.thumbnailUrl} />
                </Link>
                <div className="project-tile-body">
                  <div className="post-meta">
                    <span>{project.owner.nickname}</span>
                    <time dateTime={date}>{format.format(new Date(date))}</time>
                    <span className={`project-status ${project.lifecycleStatus === "COMPLETED" ? "completed" : ""}`}>
                      {project.lifecycleStatus === "COMPLETED" ? "완료" : "진행 중"}
                    </span>
                    <LikeCount count={project.likeCount} />
                  </div>
                  <h3>
                    <Link href={`/projects/${project.id}`} prefetch={false}>
                      {project.name}
                    </Link>
                  </h3>
                  {project.summary && <p className="post-summary">{project.summary}</p>}
                  <ul className="tag-list" aria-label="기술 스택">
                    {project.techStacks.map((tag) => (
                      <li key={tag.id}>{tag.name}</li>
                    ))}
                  </ul>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
      {data.totalPages > 1 && (
        <nav className="pagination" aria-label="블로그 프로젝트 페이지">
          {data.hasPrevious ? (
            <Link className="page-link" href={href(page - 1)} prefetch={false}>
              ← 이전
            </Link>
          ) : (
            <span className="page-link disabled" aria-disabled="true">
              ← 이전
            </span>
          )}
          <span aria-current="page">
            {page + 1} / {data.totalPages} 페이지
          </span>
          {data.hasNext ? (
            <Link className="page-link" href={href(page + 1)} prefetch={false}>
              다음 →
            </Link>
          ) : (
            <span className="page-link disabled" aria-disabled="true">
              다음 →
            </span>
          )}
        </nav>
      )}
    </>
  );
}
