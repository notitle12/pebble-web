import type { ContentSource } from "./model.ts";
const belongsTo = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
const oauthHosts = ["nid.naver.com", "accounts.google.com", "kauth.kakao.com", "auth.kakao.com", "login.microsoftonline.com", "login.live.com"];
export function classifyContentSource(referrer: string, currentHost: string): ContentSource {
  if (!referrer) return "DIRECT";
  let url: URL; try { url = new URL(referrer); } catch { return "DIRECT"; }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "DIRECT";
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host === currentHost.toLowerCase().replace(/\.$/, "") || host === "pebble-log.com" || host === "www.pebble-log.com") return "INTERNAL";
  if (oauthHosts.some(domain => belongsTo(host, domain))) return "DIRECT";
  if (["google.com", "google.co.kr", "google.co.jp", "google.co.uk", "google.ca", "google.de", "google.fr", "google.com.au", "google.co.in"].some(domain => belongsTo(host, domain))) return "GOOGLE";
  if (belongsTo(host, "naver.com")) return "NAVER";
  if (belongsTo(host, "bing.com")) return "BING";
  if (belongsTo(host, "daum.net")) return "DAUM";
  if (belongsTo(host, "github.com")) return "GITHUB";
  if (belongsTo(host, "kakao.com")) return "KAKAO";
  return "OTHER";
}
// Only route transitions and a fixed source code live in memory. Referrer URLs are never retained.
export function createContentSourceContext() {
  let firstPath: string | null = null, moved = false, initialSource: ContentSource = "DIRECT";
  return {
    observe(pathname: string, referrer: string, host: string) {
      if (firstPath === null) { firstPath = pathname; initialSource = /^\/(?:auth|oauth)(?:\/|$)/.test(pathname) ? "DIRECT" : classifyContentSource(referrer, host); }
      else if (pathname !== firstPath) moved = true;
    },
    source(): ContentSource { return moved ? "INTERNAL" : initialSource; },
  };
}
export const contentSourceContext = createContentSourceContext();
