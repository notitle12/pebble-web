import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { TableSpecPreview } from "@/features/post/components/table-spec-preview";

export default function TableSpecPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <><SiteHeader /><main className="page-shell detail-shell table-spec-dev">
    <p className="preview-notice">개발 전용 · 작성 미리보기</p>
    <h1>테이블 명세 블록 작성</h1>
    <p className="table-spec-intro">표 구조를 입력하고 게시글 본문에 표시될 모양을 확인합니다.</p>
    <TableSpecPreview />
  </main><footer className="site-footer">로그인·게시글 편집기·저장·게시 기능은 아직 구현되지 않았습니다.</footer></>;
}
