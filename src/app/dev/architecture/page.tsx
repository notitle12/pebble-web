import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ArchitecturePreview } from "@/features/post/components/architecture-preview";
export default function ArchitecturePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <><SiteHeader /><main className="page-shell detail-shell architecture-dev"><p className="preview-notice">개발 전용 · 작성 미리보기</p><h1>아키텍처 블록 작성</h1><p className="table-spec-intro">구성 요소와 경계를 입력하고 게시글 본문에 표시될 구조를 확인합니다.</p><ArchitecturePreview /></main><footer className="site-footer">로그인·게시글 편집기·저장·게시 기능은 아직 구현되지 않았습니다.</footer></>;
}
