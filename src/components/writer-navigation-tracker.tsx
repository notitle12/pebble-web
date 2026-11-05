"use client";
import { useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { observeWriterNavigation } from "../lib/writer-navigation";

export function WriterNavigationTracker() {
  const pathname = usePathname(), search = useSearchParams().toString();
  useLayoutEffect(() => {
    observeWriterNavigation();
    window.addEventListener("hashchange", observeWriterNavigation);
    return () => window.removeEventListener("hashchange", observeWriterNavigation);
  }, [pathname, search]);
  return null;
}
