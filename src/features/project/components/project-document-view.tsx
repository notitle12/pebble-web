import { PostBody } from '@/features/post/components/post-body';
import { PROJECT_SECTIONS, PROJECT_TEAM_ROLES, type ProjectDocument } from '../project-document';
import { ProjectTechnologySummary } from './project-technology-summary';

export interface ProjectPeriodInfo {
  startedOn: string | null;
  completedOn: string | null;
  lifecycleStatus: "IN_PROGRESS" | "COMPLETED";
}

interface ProjectDocumentViewProps {
  document: ProjectDocument;
  imagePreviews?: Record<string, string>;
  techStacks?: { id: string; name: string }[];
  period?: ProjectPeriodInfo;
}

function hasContent(blocks: ProjectDocument['sections'][number]['blocks']) {
  return blocks.some(
    block =>
      !['TEXT', 'HTML', 'MARKDOWN'].includes(block.type) ||
      block.content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim() ||
      /<img\b|data-pebble-type/i.test(block.content)
  );
}

export function ProjectDocumentView({
  document,
  imagePreviews,
  techStacks,
  period,
}: ProjectDocumentViewProps) {
  const roles = document.roles ?? (document.role ? [document.role] : []);
  const background = document.sections.find(section => section.key === 'BACKGROUND')?.blocks ?? [];
  const hasPeriod = Boolean(period && (period.startedOn || period.completedOn));
  const hasTech = Boolean(techStacks && techStacks.length > 0);
  const hasOverviewSpecs = Boolean(hasPeriod || document.teamSize || roles.length > 0);
  const hasOverview = Boolean(hasOverviewSpecs || hasTech || hasContent(background));

  return (
    <>
      {hasOverview && (
        <section className="project-document-section">
          <h2>프로젝트 개요</h2>
          {hasOverviewSpecs && (
            <dl className="project-document-overview">
              {period && (period.startedOn || period.completedOn) && (
                <>
                  <dt>진행 기간</dt>
                  <dd>
                    {period.startedOn ?? "시작일 미등록"} ~{" "}
                    {period.lifecycleStatus === "IN_PROGRESS"
                      ? "진행 중"
                      : period.completedOn ?? "완료일 미등록"}
                  </dd>
                </>
              )}
              {document.teamSize && (
                <>
                  <dt>인원</dt>
                  <dd>
                    {document.teamSize}명
                    {document.teamComposition?.length
                      ? ` (${document.teamComposition
                          .filter(item => item.count > 0)
                          .map(
                            item =>
                              `${PROJECT_TEAM_ROLES.find(job => job.key === item.role)?.label ?? item.role} ${item.count}명`
                          )
                          .join(', ')})`
                      : ''}
                  </dd>
                </>
              )}
              {roles.length > 0 && (
                <>
                  <dt>나의 역할</dt>
                  <dd style={{ whiteSpace: "pre-wrap" }}>{roles.join(', ')}</dd>
                </>
              )}
            </dl>
          )}
          {techStacks && techStacks.length > 0 && (
            <div>
              <h3>기술 스택</h3>
              <ProjectTechnologySummary
                selected={techStacks.map(t => t.id)}
                existing={techStacks}
              />
            </div>
          )}
          {hasContent(background) && (
            <div>
              <h3>배경 및 목적</h3>
              <PostBody blocks={background} imagePreviews={imagePreviews} />
            </div>
          )}
        </section>
      )}
      {PROJECT_SECTIONS.filter(section => section.key !== 'BACKGROUND').map(({ key, label }) => {
        const blocks = document.sections.find(section => section.key === key)?.blocks ?? [];
        return hasContent(blocks) ? (
          <section key={key} className="project-document-section">
            <h2>{label}</h2>
            <PostBody blocks={blocks} imagePreviews={imagePreviews} />
          </section>
        ) : null;
      })}
    </>
  );
}
