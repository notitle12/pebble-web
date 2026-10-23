import test from "node:test";
import assert from "node:assert/strict";
import { getContentInsights, parseContentInsights, insightHref, insightPoints } from "../src/features/content-insights/model.ts";
import { startContentViewTracking } from "../src/features/content-insights/tracking.ts";
const item = { id: "9007199254740993", title: "인사이트", urlKey: "insights", views: 4, visibilityStatus: "PUBLIC", isBlocked: false, draft: false };
const fixture = (days = 7) => ({ data: { days, fromDate: days ? new Date(Date.UTC(2026, 9, 23) - (days - 1) * 86400000).toISOString().slice(0, 10) : null, toDate: "2026-10-23", timeZone: "Asia/Seoul", trackingStartedAt: "2026-10-23T00:00:00Z", chartDays: days || 30, postViews: 4, projectViews: 0, daily: Array.from({ length: days || 30 }, (_, index) => ({ date: new Date(Date.UTC(2026, 9, 23) - ((days || 30) - 1 - index) * 86400000).toISOString().slice(0, 10), postViews: index === (days || 30) - 1 ? 4 : 0, projectViews: 0 })), posts: [{ ...item }], projects: [] } });
test("content insights reads requested periods, preserves bigint IDs and uses one private request", async () => {
  const calls = []; const result = await getContentInsights(7, async path => { calls.push(path); return fixture(); });
  assert.deepEqual(calls, ["/members/me/content-insights?days=7"]); assert.equal(result.posts[0].id, item.id); assert.equal(result.daily.length, 7);
  const all = parseContentInsights(fixture(0), 0); assert.equal(all.fromDate, null); assert.equal(all.chartDays, 30);
  assert.equal(parseContentInsights(fixture(90), 90).daily.length, 90);
});
test("invalid periods fail without sending a request", async () => {
  let calls = 0; await assert.rejects(getContentInsights(1, async () => { calls++; return fixture(); })); assert.equal(calls, 0);
});
test("content insights rejects malformed counters, duplicate dates, period mismatch, and duplicate ranking IDs", () => {
  for (const change of [d => d.postViews = -1, d => d.projectViews = Number.MAX_SAFE_INTEGER + 1, d => d.days = 30, d => d.daily[1].date = d.daily[0].date, d => d.daily.pop(), d => d.posts.push({ ...item }), d => d.posts[0].views = 0, d => d.posts[0].visibilityStatus = "DELETED", d => d.fromDate = "2026-02-30", d => d.trackingStartedAt = "yesterday"]) {
    const value = fixture(); change(value.data); assert.throws(() => parseContentInsights(value, 7));
  }
});
test("ranking links use public canonical URLs and keep unavailable content in owner routes", () => {
  assert.equal(insightHref("posts", item, "pebble"), `/blogs/pebble/posts/insights`);
  assert.equal(insightHref("posts", { ...item, urlKey: null }, "pebble"), `/blogs/pebble/posts/${item.id}`);
  for (const unavailable of [{ isBlocked: true }, { visibilityStatus: "HIDDEN" }, { draft: true }, { urlKey: "//evil.test" }]) assert.equal(insightHref("posts", { ...item, ...unavailable }, "pebble"), `/posts/${item.id}/view`);
  assert.equal(insightHref("projects", item, "pebble"), `/projects/${item.id}`);
  assert.equal(insightHref("projects", { ...item, isBlocked: true }, "pebble"), `/projects/${item.id}/view`);
});
test("chart coordinates share scale and remain finite for empty counts", () => {
  const daily = [{ date: "2026-10-22", postViews: 0, projectViews: 10 }, { date: "2026-10-23", postViews: 5, projectViews: 0 }];
  assert.equal(insightPoints(daily, "postViews"), "16.00,140.00 704.00,82.00");
  assert.equal(insightPoints(daily, "projectViews"), "16.00,24.00 704.00,140.00");
  assert.equal(insightPoints([{ ...daily[0], projectViews: 0 }], "postViews"), "16.00,140.00");
});
class Visibility extends EventTarget { visibilityState = "visible"; change(value) { this.visibilityState = value; this.dispatchEvent(new Event("visibilitychange")); } }
test("tracking requires three visible seconds, resets on backgrounding, sends once and cleans up", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] }); const document = new Visibility(); let sent = 0;
  const stop = startContentViewTracking(document, () => true, () => sent++);
  context.mock.timers.tick(2000); assert.equal(sent, 0); document.change("hidden"); context.mock.timers.tick(5000); assert.equal(sent, 0);
  document.change("visible"); context.mock.timers.tick(2999); assert.equal(sent, 0); context.mock.timers.tick(1); assert.equal(sent, 1);
  document.change("hidden"); document.change("visible"); context.mock.timers.tick(4000); assert.equal(sent, 1); stop();
  const cancel = startContentViewTracking(document, () => true, () => sent++); cancel(); context.mock.timers.tick(4000); assert.equal(sent, 1);
});
test("tracking skips recording when identity or eligibility changed before the timer fires", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] }); const document = new Visibility(); let allowed = true, sent = 0;
  const stop = startContentViewTracking(document, () => allowed, () => sent++); allowed = false; context.mock.timers.tick(3000); assert.equal(sent, 0); stop();
});
