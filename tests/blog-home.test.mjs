import test from "node:test";
import assert from "node:assert/strict";
import { GuestApiError } from "../src/lib/public-api.ts";
import { defaultBlogHomeSettings, normalizeTechStacks, parseBlogHomeSettings, parsePublicBlogHome, visibleHomeDataLoads } from "../src/features/blog-home/api/blog-home.ts";

const settings = { sections: ["ACTIVITY", "TECH_STACKS", "PROJECTS", "RECENT_POSTS"].map(key => ({ key, visible: true })), techStacks: ["Java", "Spring Boot"], featuredProjectIds: ["721389012345678901"] };
const activity = { from: "2025-10-10", to: "2026-10-10", timeZone: "Asia/Seoul", days: [{ date: "2025-11-02", count: 2 }, { date: "2026-01-01", count: 1 }] };

test("blog home settings require four unique sections and unique bounded entries", () => {
  assert.deepEqual(parseBlogHomeSettings({ data: settings }), settings);
  assert.deepEqual(parseBlogHomeSettings({ data: { ...settings, sections: [...settings.sections].reverse() } }).sections.map(section => section.key), ["RECENT_POSTS", "PROJECTS", "TECH_STACKS", "ACTIVITY"]);
  assert.deepEqual(defaultBlogHomeSettings().sections.map(section => section.key), ["ACTIVITY", "TECH_STACKS", "PROJECTS", "RECENT_POSTS"]);
  for (const invalid of [
    { ...settings, sections: settings.sections.slice(1) },
    
    { ...settings, sections: settings.sections.map(item => ({ ...item, visible: "yes" })) },
    { ...settings, techStacks: ["Java", "java"] },
    { ...settings, techStacks: ["  Java"] },
    { ...settings, featuredProjectIds: ["01"] },
    { ...settings, featuredProjectIds: Array(7).fill("1") },
  ]) assert.throws(() => parseBlogHomeSettings({ data: invalid }), GuestApiError);
});

test("tech stack editor trims, case-fold deduplicates, and bounds stored labels", () => {
  assert.deepEqual(normalizeTechStacks([" Java ", "java", "Ｊａｖａ", "TypeScript", "\u0000bad", "x".repeat(51)]), ["Java", "TypeScript"]);
  assert.equal(normalizeTechStacks(Array.from({ length: 22 }, (_, index) => `Tech ${index}`)).length, 20);
});

test("public blog home parses sparse Korea dates and rejects out-of-range or duplicate days", () => {
  assert.deepEqual(parsePublicBlogHome({ data: { ...settings, activity } }).activity, activity);
  for (const days of [[{ date: "2025-10-09", count: 1 }], [{ date: "2026-10-11", count: 1 }], [{ date: "2026-01-01", count: -1 }], [{ date: "2026-01-01", count: 0 }, { date: "2026-01-01", count: 2 }], Array.from({ length: 367 }, (_, index) => ({ date: `2025-${String(Math.floor(index / 30) + 1).padStart(2, "0")}-${String(index % 28 + 1).padStart(2, "0")}`, count: 1 }))]) {
    assert.throws(() => parsePublicBlogHome({ data: { ...settings, activity: { ...activity, days } } }), GuestApiError);
  }
  assert.throws(() => parsePublicBlogHome({ data: { ...settings, activity: { ...activity, from: "2024-10-10" } } }), GuestApiError);
});

test("hidden homepage sections do not request recent posts or featured projects", () => {
  const hidden = { ...settings, sections: settings.sections.map(section => ({ ...section, visible: false })) };
  assert.deepEqual(visibleHomeDataLoads(hidden), { recentPosts: false, featuredProjects: false });
  assert.deepEqual(visibleHomeDataLoads(settings), { recentPosts: true, featuredProjects: true });
});
