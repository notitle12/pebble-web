import test from "node:test";
import assert from "node:assert/strict";
import { transitionTableInputComposition } from "../src/features/post/components/table-input-composition.ts";

test("table text commits normal changes but holds Korean IME intermediate values until composition ends", () => {
  let state = { composing: false };
  const commits = [];
  const send = event => {
    const result = transitionTableInputComposition(state, event);
    state = result.state;
    if (result.commit !== undefined) commits.push(result.commit);
  };

  send({ type: "change", value: "nickname" });
  send({ type: "compositionstart" });
  send({ type: "change", value: "닉" });
  send({ type: "change", value: "닉네" });
  send({ type: "compositionend", value: "닉네임" });
  send({ type: "change", value: "닉네임1" });

  assert.deepEqual(commits, ["nickname", "닉네임", "닉네임1"]);
  assert.deepEqual(state, { composing: false });
});

test("blur commits an active composition draft so a save action cannot lose it", () => {
  let state = { composing: false };
  const result = event => {
    const next = transitionTableInputComposition(state, event);
    state = next.state;
    return next.commit;
  };

  result({ type: "compositionstart" });
  assert.equal(result({ type: "change", value: "테이블" }), undefined);
  assert.equal(result({ type: "blur", value: "테이블명" }), "테이블명");
  assert.equal(result({ type: "blur", value: "테이블명" }), undefined);
});
