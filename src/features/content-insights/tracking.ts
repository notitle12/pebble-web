// A view needs three uninterrupted visible seconds; background time never counts.
export function startContentViewTracking(document: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">, canRecord: () => boolean, record: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined, attempted = false, disposed = false;
  function schedule() {
    clearTimeout(timer);
    if (disposed || attempted || document.visibilityState !== "visible") return;
    timer = setTimeout(() => {
      if (disposed || attempted || document.visibilityState !== "visible" || !canRecord()) return;
      attempted = true;
      record();
    }, 3000);
  }
  schedule(); document.addEventListener("visibilitychange", schedule);
  return () => { disposed = true; clearTimeout(timer); document.removeEventListener("visibilitychange", schedule); };
}
