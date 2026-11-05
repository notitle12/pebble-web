export type WriterNavigation = { current: string | null; returnTo: string | null };
const storageKey = "pebble:writer-navigation:v1";
let memory: WriterNavigation = { current: null, returnTo: null };

function localHref(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://pebble.local");
    return url.origin === "https://pebble.local" && !url.pathname.startsWith("//") ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch { return null; }
}
export function isWriterHref(value: string): boolean {
  const path = value.split(/[?#]/, 1)[0];
  return /^\/(?:posts|projects)\/(?:new|[1-9]\d*\/edit)$/.test(path) || path === "/dev/writer";
}
function isLoginHref(value: string): boolean {
  return /^\/(?:auth(?:\/|$)|login(?:[?#]|$)|agreements(?:[?#]|$))/.test(value)
    || /^\/settings\/profile\?.*\breturnTo=/.test(value);
}
export function safeWriterReturnHref(value: unknown): string | null {
  const href = localHref(value);
  return href && !isWriterHref(href) && !isLoginHref(href) ? href : null;
}

/** Keep one origin through new -> saved/edit, reloads and login redirects. */
export function advanceWriterNavigation(previous: WriterNavigation, value: string, referrer: string | null = null): WriterNavigation {
  const current = localHref(value);
  if (!current || isLoginHref(current)) return previous;
  if (isWriterHref(current)) {
    return { current, returnTo: (previous.current && isWriterHref(previous.current)
      ? safeWriterReturnHref(previous.returnTo) : safeWriterReturnHref(previous.current)) ?? safeWriterReturnHref(referrer) };
  }
  return { current, returnTo: null };
}
function readNavigation(): WriterNavigation {
  try {
    const stored = window.sessionStorage.getItem(storageKey);
    if (stored) {
      const value = JSON.parse(stored);
      if (value && typeof value === "object") return { current: localHref(value.current), returnTo: safeWriterReturnHref(value.returnTo) };
    }
  } catch { /* The in-memory copy also works when tab storage is disabled. */ }
  return memory;
}
export function observeWriterNavigation(): WriterNavigation {
  let referrer: string | null = null;
  try {
    const url = new URL(document.referrer);
    if (url.origin === window.location.origin) referrer = `${url.pathname}${url.search}${url.hash}`;
  } catch { /* Direct visits have no referrer. */ }
  memory = advanceWriterNavigation(readNavigation(), `${window.location.pathname}${window.location.search}${window.location.hash}`, referrer);
  try { window.sessionStorage.setItem(storageKey, JSON.stringify(memory)); } catch { /* Keep memory. */ }
  return memory;
}
export function writerReturnHref(fallback: string): string {
  return observeWriterNavigation().returnTo ?? fallback;
}
