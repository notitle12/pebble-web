import test from "node:test";
import assert from "node:assert/strict";
import { getInsightItems, parseInsightItemsPage, getContentInsightDetail, parseContentInsightDetail, singleInsightPoints } from "../src/features/content-insights/model.ts";
import { classifyContentSource, createContentSourceContext } from "../src/features/content-insights/source.ts";
const item = { id: "9007199254740993", title: "조회 없는 글", urlKey: null, views: 0, visibilityStatus: "HIDDEN", isBlocked: false, draft: true };
const detail = (days = 7) => ({ data: { kind: "posts", days, item: { ...item }, totalViews: 45, fromDate: days ? new Date(Date.UTC(2026, 9, 23) - (days - 1) * 86400000).toISOString().slice(0, 10) : null, toDate: "2026-10-23", timeZone: "Asia/Seoul", trackingStartedAt: "2026-10-23T00:00:00Z", sourceTrackingStartedAt: "2026-10-23T01:00:00Z", sourceDays: 7, sourceFromDate: "2026-10-17", monthlyCoverageFrom: "2026-10-01", chartDays: days || 90, daily: Array.from({ length: days || 90 }, (_, index) => ({ date: new Date(Date.UTC(2026, 9, 23) - ((days || 90) - 1 - index) * 86400000).toISOString().slice(0, 10), views: 0 })), monthly: Array.from({ length: 12 }, (_, i) => ({ month: new Date(Date.UTC(2026, -2 + i, 1)).toISOString().slice(0, 7), views: i === 11 ? 45 : 0 })), sources: [] } });
test("all-content search permits zero views and drafts, sends one encoded ten-item page", async () => {
  const calls = []; const value = { data: { kind: "posts", page: 0, size: 10, totalElements: 1, totalPages: 1, items: [{ ...item }] } };
  const parsed = await getInsightItems("posts", 0, "검색 & 단어", async path => { calls.push(path); return value; });
  assert.equal(parsed.items[0].views, 0); assert.equal(parsed.items[0].draft, true); assert.equal(calls[0], `/members/me/content-insights/items?kind=posts&page=0&query=${encodeURIComponent("검색 & 단어")}`);
  await assert.rejects(getInsightItems("posts", 10001, "", async () => { throw new Error("must not request"); }));
  await assert.rejects(getInsightItems("posts", 0, "a".repeat(101), async () => { throw new Error("must not request"); }));
  assert.throws(() => parseInsightItemsPage({ data: { ...value.data, kind: "projects" } }, "posts", 0));
  assert.throws(() => parseInsightItemsPage({ data: { ...value.data, items: [] } }, "posts", 0));
});
test("detail contract reads selected daily periods, fixed twelve months, source enum and long-lived counts", async () => {
  const calls = []; const result = await getContentInsightDetail("posts", item.id, 7, async path => { calls.push(path); return detail(); });
  assert.equal(calls[0], `/members/me/content-insights/posts/${item.id}?days=7`); assert.equal(result.daily.length, 7); assert.equal(result.monthly.length, 12); assert.equal(result.monthly[0].month, "2025-11"); assert.equal(result.monthly[11].month, "2026-10"); assert.equal(result.totalViews, 45);
  const all = parseContentInsightDetail(detail(0), "posts", item.id, 0); assert.equal(all.chartDays, 90); assert.equal(all.fromDate, null);
  const sources = detail(); sources.data.sources = [{ source: "UNKNOWN", views: 4 }, { source: "DIRECT", views: 2 }]; assert.equal(parseContentInsightDetail(sources, "posts", item.id, 7).sources.length, 2);
});
test("detail rejects malformed identity, noncontinuous dates, month gaps, duplicate or arbitrary source strings", () => {
  for (const change of [d => d.item.id = "1", d => d.kind = "projects", d => d.daily[1].date = d.daily[0].date, d => d.monthly[0].month = "2024-01", d => d.sources = [{ source: "https://private.test/path?q=secret", views: 4 }], d => d.sources = [{ source: "DIRECT", views: 4 }, { source: "DIRECT", views: 3 }], d => d.sources = [{ source: "DIRECT", views: 0 }], d => d.sourceTrackingStartedAt = "today", d => d.sourceDays = 30, d => d.sourceFromDate = "2026-10-16", d => d.sourceFromDate = "2026-02-30", d => d.totalViews = -1]) {
    const value = detail(); change(value.data); assert.throws(() => parseContentInsightDetail(value, "posts", item.id, 7));
  }
});
test("single chart has bounded coordinates and handles zeros", () => { assert.equal(singleInsightPoints([{ views: 0 }, { views: 10 }]), "16.00,140.00 704.00,24.00"); assert.equal(singleInsightPoints([{ views: 0 }]), "16.00,140.00"); });
test("referrer classification uses validated hosts only and never includes URL or search values", () => {
  for (const [url, expected] of [["https://www.google.com/search?q=secret", "GOOGLE"], ["https://search.naver.com/search?q=secret", "NAVER"], ["https://www.bing.com", "BING"], ["https://search.daum.net", "DAUM"], ["https://github.com/user/repo", "GITHUB"], ["https://open.kakao.com/o/test", "KAKAO"], ["https://www.pebble-log.com/path", "INTERNAL"], ["https://pebble-log.com/path", "INTERNAL"], ["https://nid.naver.com/oauth2.0/authorize", "DIRECT"], ["https://accounts.google.com", "DIRECT"], ["https://kauth.kakao.com", "DIRECT"], ["https://notgoogle.com", "OTHER"], ["https://google.com.evil.test", "OTHER"], ["https://google.com@evil.test", "DIRECT"], ["javascript:alert(1)", "DIRECT"], ["", "DIRECT"], ["not a URL", "DIRECT"]]) assert.equal(classifyContentSource(url, "www.pebble-log.com"), expected, url);
  assert.equal(classifyContentSource("http://127.0.0.1:3106/home", "127.0.0.1"), "INTERNAL");
});
test("a document uses external source only before SPA route movement, including return to first path", () => {
  const context = createContentSourceContext(); context.observe("/projects/1", "https://google.com/search?q=private", "www.pebble-log.com"); assert.equal(context.source(), "GOOGLE");
  context.observe("/projects/1", "https://google.com/search?q=private", "www.pebble-log.com"); assert.equal(context.source(), "GOOGLE");
  context.observe("/projects/2", "https://google.com/search?q=private", "www.pebble-log.com"); assert.equal(context.source(), "INTERNAL");
  context.observe("/projects/1", "https://google.com/search?q=private", "www.pebble-log.com"); assert.equal(context.source(), "INTERNAL");
  const callback = createContentSourceContext(); callback.observe("/auth/naver/callback", "https://nid.naver.com/oauth", "www.pebble-log.com"); assert.equal(callback.source(), "DIRECT"); callback.observe("/projects/1", "https://nid.naver.com/oauth", "www.pebble-log.com"); assert.equal(callback.source(), "INTERNAL");
});

test("source coverage is always seven days independently of selected content period", () => {
  for (const days of [0, 7, 30, 90]) {
    const value = detail(days); value.data.sources = [{ source: "GOOGLE", views: 3 }];
    const parsed = parseContentInsightDetail(value, "posts", item.id, days);
    assert.equal(parsed.sourceDays, 7); assert.equal(parsed.sourceFromDate, "2026-10-17"); assert.equal(parsed.sources[0].views, 3);
  }
  const missing = detail(); delete missing.data.sourceDays; assert.throws(() => parseContentInsightDetail(missing, "posts", item.id, 7));
});
