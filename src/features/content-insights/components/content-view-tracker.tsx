"use client";
import { useEffect, useRef } from "react";
import { useUserSession } from "../../auth/components/member-gate";
import { userSession } from "../../auth/user-session";
import { startContentViewTracking } from "../tracking";
import { contentSourceContext } from "../source";

export function ContentViewTracker({ kind, id, ownerId }: { kind: "posts" | "projects"; id: string; ownerId: string }) {
  const session = useUserSession();
  const attempted = useRef("");
  useEffect(() => {
    const key = `${kind}/${id}`;
    if (attempted.current === key || !["ready", "guest"].includes(session.phase) || session.member?.id === ownerId) return;
    return startContentViewTracking(document, () => {
      const current = userSession.snapshot();
      return attempted.current !== key && ["ready", "guest"].includes(current.phase) && current.member?.id !== ownerId;
    }, () => {
      attempted.current = key;
      void userSession.trackContentView(kind, id, contentSourceContext.source()).catch(() => {});
    });
  }, [kind, id, ownerId, session.phase, session.member?.id]);
  return null;
}
