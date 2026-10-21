import { validId } from "../../lib/list-query.ts";
import { MemberApiError, responseData } from "../../lib/member-api.ts";

export const reportReasons = [
  { value: "PRIVACY", label: "개인정보 노출" },
  { value: "COPYRIGHT", label: "저작권 침해" },
  { value: "ABUSE", label: "욕설·괴롭힘" },
  { value: "SPAM", label: "스팸·광고" },
  { value: "OTHER", label: "기타" },
] as const;
export type ReportReason = typeof reportReasons[number]["value"];
export type ReportReceipt = { id: string; status: "OPEN" | "RESOLVED" };
type ReportRequest = (path: string, options: { method: string; body: { reason: ReportReason; detail: string } }) => Promise<unknown>;

export function reportBody(reason: string, detail: string): { reason: ReportReason; detail: string } {
  if (!reportReasons.some(item => item.value === reason)) throw new MemberApiError(400, "INVALID_REQUEST", "신고 사유를 선택해 주세요.");
  if (Array.from(detail).length > 1000) throw new MemberApiError(400, "INVALID_REQUEST", "상세 내용은 1,000자 이내로 입력해 주세요.");
  if (reason === "OTHER" && !detail.trim()) throw new MemberApiError(400, "INVALID_REQUEST", "기타 사유의 상세 내용을 입력해 주세요.");
  return { reason: reason as ReportReason, detail: detail.trim() };
}

export type ReportTarget = "POST" | "PROJECT" | "POST_COMMENT" | "PROJECT_COMMENT";
export type ReportSubject = { target: ReportTarget; contentId: string; targetId?: string };
export const reportTargetLabels: Record<ReportTarget, string> = { POST: "게시글", PROJECT: "프로젝트", POST_COMMENT: "게시글 댓글", PROJECT_COMMENT: "프로젝트 댓글" };
export function reportPath({ target, contentId, targetId }: ReportSubject): string {
  if (!Object.hasOwn(reportTargetLabels, target) || typeof contentId !== "string" || !validId(contentId)) throw new MemberApiError(400, "INVALID_REQUEST", "신고할 콘텐츠 주소를 확인해 주세요.");
  const comment = target === "POST_COMMENT" || target === "PROJECT_COMMENT";
  if (comment ? typeof targetId !== "string" || !validId(targetId) : targetId !== undefined) throw new MemberApiError(400, "INVALID_REQUEST", "신고할 댓글 주소를 확인해 주세요.");
  const parent = target === "POST" || target === "POST_COMMENT" ? "posts" : "projects";
  return `/${parent}/${contentId}${comment ? `/comments/${targetId}` : ""}/reports`;
}
export async function reportContent(subject: ReportSubject, reason: string, detail: string, request: ReportRequest): Promise<ReportReceipt> {
  const path = reportPath(subject);
  const body = reportBody(reason, detail);
  const data = responseData(await request(path, { method: "POST", body }));
  if (typeof data.id !== "string" || !validId(data.id) || (data.status !== "OPEN" && data.status !== "RESOLVED")) throw new MemberApiError(0, "INVALID_RESPONSE", "신고 결과를 확인하지 못했어요. 다시 제출해도 중복 접수되지 않습니다.");
  return { id: data.id, status: data.status };
}
