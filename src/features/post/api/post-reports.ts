import { reportContent, type ReportSubject } from "../../report/api.ts";
export { reportReasons as postReportReasons, reportBody as postReportBody } from "../../report/api.ts";
export type { ReportReason as PostReportReason, ReportReceipt as PostReport } from "../../report/api.ts";
export function reportPost(id: string, reason: string, detail: string, request: Parameters<typeof reportContent>[3]) {
  return reportContent({ target: "POST", contentId: id } satisfies ReportSubject, reason, detail, request);
}
