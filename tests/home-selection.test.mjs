import assert from "node:assert/strict";
import { test } from "node:test";
import { selectPopularRecent } from "../src/features/post/home-selection.ts";

const post = (id, likeCount, publishedAt, createdAt = publishedAt) => ({
  id, likeCount, publishedAt, createdAt,
});

test("popular posts are selected from the recent twenty, sorted without mutating input", () => {
  const posts = Array.from({ length: 22 }, (_, index) =>
    post(String(index + 1), index < 2 ? 1000 : 5, new Date(Date.UTC(2026, 0, index + 1)).toISOString()),
  );
  const original = [...posts];
  const selected = selectPopularRecent(posts, 3);
  assert.deepEqual(posts, original);
  assert.deepEqual(selected.map(item => item.id), ["22", "21", "20"]);
});

test("likes sort descending; ties use publish time, create time, then BigInt id", () => {
  const tieTime = "2026-05-05T00:00:00.000Z";
  const items = [
    post("9007199254740992", 7, tieTime, tieTime),
    post("9007199254740993", 7, tieTime, tieTime),
    post("3", 7, "2026-05-04T00:00:00.000Z", "2026-05-06T00:00:00.000Z"),
    post("4", 8, "2026-05-01T00:00:00.000Z"),
  ];
  assert.deepEqual(selectPopularRecent(items, 4).map(item => item.id), [
    "4", "9007199254740993", "9007199254740992", "3",
  ]);
});

test("zero and absent like counts are excluded", () => {
  const items = [post("1", 0, "2026-01-02T00:00:00.000Z"), post("2", 1, "2026-01-01T00:00:00.000Z")];
  assert.deepEqual(selectPopularRecent(items).map(item => item.id), ["2"]);
  assert.deepEqual(selectPopularRecent([post("3", undefined, "2026-01-03T00:00:00.000Z"), ...items]).map(item => item.id), ["2"]);
});
