"use client";
import { ReportButton } from "@/features/report/components/report-button";
export function PostReportButton({ postId }: { postId: string }) {
  return <ReportButton target="POST" contentId={postId}/>;
}
