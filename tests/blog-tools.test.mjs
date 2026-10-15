import test from "node:test";
import assert from "node:assert/strict";
import { GuestApiError } from "../src/lib/public-api.ts";
import { getBlogVisits, getPublicBlogLinks, parseBlogLinks, parseBlogVisits, recordBlogVisit, validateBlogLinkDraft } from "../src/features/blog-tools/api/blog-tools.ts";

const visits = { data: { totalVisitors: 120, todayVisitors: 8, date: "2026-10-08", timeZone: "Asia/Seoul" } };

test("parses the Korea-day visitor contract and rejects invented or malformed counts", () => {
  assert.deepEqual(parseBlogVisits(visits), visits.data);
  for (const invalid of [
    { data: { ...visits.data, totalVisitors: -1 } },
    { data: { ...visits.data, todayVisitors: 1.5 } },
    { data: { ...visits.data, totalVisitors: 7, todayVisitors: 8 } },
    { data: { ...visits.data, timeZone: "UTC" } },
    { data: { ...visits.data, date: "today" } },
    { data: { ...visits.data, date: "2026-02-30" } },
  ]) assert.throws(() => parseBlogVisits(invalid), GuestApiError);
});

test("GET visits is guest-only and POST includes the browser visitor cookie without a body", async () => {
  let seen;
  const get = await getBlogVisits("pebble-dev", "https://api.example/api/v1", async (input, init) => {
    seen = { url: String(input), init }; return Response.json(visits);
  });
  assert.deepEqual(get, visits.data);
  assert.equal(seen.init.credentials, "omit");
  assert.equal(seen.url, "https://api.example/api/v1/blogs/pebble-dev/visits");
  const posted = await recordBlogVisit("pebble-dev", "https://api.example/api/v1", async (input, init) => {
    seen = { url: String(input), init }; return Response.json(visits);
  });
  assert.deepEqual(posted, visits.data);
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.credentials, "include");
  assert.equal("body" in seen.init, false);
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
