import test from "node:test";
import assert from "node:assert/strict";
import { GuestApiError } from "../src/lib/public-api.ts";
import { clearLegacyBlogVisitorCookie, getPublicBlogLinks, parseBlogLinks, validateBlogLinkDraft } from "../src/features/blog-tools/api/blog-tools.ts";

test("legacy visit cleanup sends only a credentialed GET and records no visit", async () => {
  let seen;
  await clearLegacyBlogVisitorCookie("pebble-dev", "https://api.example/api/v1", async (input, init) => {
    seen = { url: String(input), init };
    return Response.json({ data: { totalVisitors: 120, todayVisitors: 8, date: "2026-10-08", timeZone: "Asia/Seoul" } });
  });
  assert.equal(seen.url, "https://api.example/api/v1/blogs/pebble-dev/visits");
  assert.equal(seen.init.method, "GET");
  assert.equal(seen.init.credentials, "include");
  assert.equal("body" in seen.init, false);
  await assert.rejects(clearLegacyBlogVisitorCookie("invalid", "https://api.example/api/v1", async () => { throw new Error("must not request"); }), GuestApiError);
});

test("blog links accept only valid GitHub and HTTPS site links with bounded labels", () => {
  const result = parseBlogLinks({ data: { githubUrl: "https://github.com/pebble-dev", sites: [
    { id: "721389012345678901", label: "Portfolio", url: "https://portfolio.example/path#work", logoUrl: "https://cdn.example/logo.webp" },
  ] } });
  assert.equal(result.sites[0].label, "Portfolio");
  for (const invalid of [
    { githubUrl: "https://github.com.evil.test/u", sites: [] },
    { githubUrl: "https://github.com", sites: [] },
    { githubUrl: null, sites: Array.from({ length: 6 }, (_, i) => ({ id: String(i + 1), label: "Site", url: "https://site.example", logoUrl: null })) },
    { githubUrl: null, sites: [{ id: "x", label: "Site", url: "http://site.example", logoUrl: null }] },
    { githubUrl: null, sites: [{ id: "1", label: "x".repeat(51), url: "https://site.example", logoUrl: null }] },
    { githubUrl: null, sites: [{ id: "9223372036854775808", label: "Site", url: "https://site.example", logoUrl: null }] },
    { githubUrl: null, sites: [{ id: "1", label: "Site", url: "https://site.example:8443", logoUrl: null }] },
    { githubUrl: null, sites: [{ id: "1", label: "Site\nName", url: "https://site.example", logoUrl: null }] },
    { githubUrl: null, sites: [{ id: "1", label: "Site\ud800", url: "https://site.example", logoUrl: null }] },
    { githubUrl: null, sites: [{ id: "1", label: "😀".repeat(51), url: "https://site.example", logoUrl: null }] },
    { githubUrl: null, sites: [
      { id: "1", label: "One", url: "https://one.example", logoUrl: null },
      { id: "1", label: "Two", url: "https://two.example", logoUrl: null },
    ] },
  ]) assert.throws(() => parseBlogLinks({ data: invalid }), GuestApiError);
  assert.equal(validateBlogLinkDraft("https://github.com/me", [{ label: "Docs", url: "https://docs.example" }]), null);
  assert.match(validateBlogLinkDraft("https://github.com", []), /GitHub/);
  assert.match(validateBlogLinkDraft("https://github.com:8443/me", []), /GitHub/);
  assert.match(validateBlogLinkDraft("", [{ label: "bad", url: "http://docs.example" }]), /HTTPS/);
});

test("public blog links use an unauthenticated no-store request", async () => {
  let seen;
  const result = await getPublicBlogLinks("pebble-dev", "https://api.example/api/v1", async (input, init) => {
    seen = { url: String(input), init };
    return Response.json({ data: { githubUrl: null, sites: [] } });
  });
  assert.deepEqual(result, { githubUrl: null, sites: [] });
  assert.equal(seen.url, "https://api.example/api/v1/blogs/pebble-dev/links");
  assert.equal(seen.init.credentials, "omit");
  assert.equal(seen.init.cache, "no-store");
  assert.equal("Authorization" in seen.init.headers, false);
});
