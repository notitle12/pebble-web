"use client";
import { useEffect } from "react";
import { clearLegacyBlogVisitorCookie } from "../api/blog-tools";

const pendingCleanup = new Map<string, Promise<void>>();
function clearOnce(handle: string): Promise<void> {
  const current = pendingCleanup.get(handle);
  if (current) return current;
  const request = clearLegacyBlogVisitorCookie(handle).finally(() => pendingCleanup.delete(handle));
  pendingCleanup.set(handle, request);
  return request;
}

export function LegacyVisitCookieCleanup({ handle }: { handle: string }) {
  useEffect(() => { void clearOnce(handle).catch(() => {}); }, [handle]);
  return null;
}
