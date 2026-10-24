"use client";
import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { contentSourceContext } from "../source";
export function ContentSourceContext() {
  const pathname = usePathname();
  useLayoutEffect(() => { contentSourceContext.observe(pathname, document.referrer, window.location.hostname); }, [pathname]);
  return null;
}
