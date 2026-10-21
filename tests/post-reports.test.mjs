import assert from "node:assert/strict";
import { test } from "node:test";
import { postReportBody, postReportReasons, reportPost } from "../src/features/post/api/post-reports.ts";

test("신고 사유와 상세 내용은 Unicode 1,000자 한도·기타 필수를 지킨다", () => {
  assert.equal(postReportReasons.length, 5);
  for (const { value } of postReportReasons) {
    assert.deepEqual(postReportBody(value, "  설명  "), { reason: value, detail: "설명" });
  }
  assert.equal(postReportBody("PRIVACY", "").detail, "");
  assert.equal(Array.from(postReportBody("OTHER", "😀".repeat(1000)).detail).length, 1000);
  for (const [reason, detail] of [["", "설명"], ["INVALID", "설명"], ["OTHER", ""], ["OTHER", " \n "], ["SPAM", "😀".repeat(1001)]]) {
    assert.throws(() => postReportBody(reason, detail), error => error.code === "INVALID_REQUEST");
  }
});

test("신고 요청은 숫자 글 ID와 사유·상세만 전송하고 기존 접수 응답도 허용한다", async () => {
  const calls = [];
  const request = async (path, options) => { calls.push({ path, options }); return { data: { id: "42", status: "OPEN" } }; };
  const result = await reportPost("9223372036854775807", "COPYRIGHT", "  설명  ", request);
  assert.deepEqual(result, { id: "42", status: "OPEN" });
  assert.deepEqual(calls, [{ path: "/posts/9223372036854775807/reports", options: { method: "POST", body: { reason: "COPYRIGHT", detail: "설명" } } }]);
  assert.deepEqual(await reportPost("1", "SPAM", "", async () => ({ data: { id: "42", status: "RESOLVED" } })), { id: "42", status: "RESOLVED" });
});

test("잘못된 글 주소·입력은 전송하지 않고 서버 실패는 자동 재시도하지 않는다", async () => {
  let calls = 0;
  const request = async () => { calls++; throw new Error("connection lost"); };
  for (const id of ["0", "01", "-1", "1/../2", "slug", "9223372036854775808"]) {
    await assert.rejects(reportPost(id, "ABUSE", "", request), error => error.code === "INVALID_REQUEST");
  }
  await assert.rejects(reportPost("1", "OTHER", " ", request), error => error.code === "INVALID_REQUEST");
  assert.equal(calls, 0);
  await assert.rejects(reportPost("1", "ABUSE", "", request), /connection lost/);
  assert.equal(calls, 1);
});

test("접수 결과가 누락되거나 계약과 다르면 성공으로 표시하지 않는다", async () => {
  for (const response of [null, {}, { data: {} }, { data: { id: 42, status: "OPEN" } }, { data: { id: "42", status: "UNKNOWN" } }]) {
    await assert.rejects(reportPost("1", "PRIVACY", "", async () => response), error => error.code === "INVALID_RESPONSE");
  }
});


test("게시글·프로젝트·각 댓글은 서로 다른 부모 경로로 신고한다", async () => {
  const { reportContent, reportPath } = await import("../src/features/report/api.ts");
  const cases = [
    [{ target: "POST", contentId: "12" }, "/posts/12/reports"],
    [{ target: "PROJECT", contentId: "12" }, "/projects/12/reports"],
    [{ target: "POST_COMMENT", contentId: "12", targetId: "34" }, "/posts/12/comments/34/reports"],
    [{ target: "PROJECT_COMMENT", contentId: "12", targetId: "34" }, "/projects/12/comments/34/reports"],
  ];
  for (const [subject, expected] of cases) {
    assert.equal(reportPath(subject), expected);
    let calls = 0;
    await reportContent(subject, "OTHER", "내용", async (path, options) => {
      calls++;
      assert.equal(path, expected);
      assert.deepEqual(options, { method: "POST", body: { reason: "OTHER", detail: "내용" } });
      return { data: { id: "99", status: "OPEN" } };
    });
    assert.equal(calls, 1);
  }
});

test("잘못된 대상·부모·댓글 조합은 서버 요청 전에 거부한다", async () => {
  const { reportContent } = await import("../src/features/report/api.ts");
  let calls = 0;
  const request = async () => { calls++; return { data: { id: "99", status: "OPEN" } }; };
  const invalid = [
    { target: "BAD", contentId: "12" },
    { target: "toString", contentId: "12" },
    { target: "PROJECT", contentId: "12/../13" },
    { target: "POST", contentId: 12 },
    { target: "PROJECT", contentId: "12", targetId: "34" },
    { target: "POST_COMMENT", contentId: "12" },
    { target: "POST_COMMENT", contentId: "12", targetId: "0" },
    { target: "PROJECT_COMMENT", contentId: "01", targetId: "34" },
    { target: "PROJECT_COMMENT", contentId: "12", targetId: "../34" },
    { target: "POST_COMMENT", contentId: "12", targetId: "9223372036854775808" },
  ];
  for (const subject of invalid) await assert.rejects(reportContent(subject, "SPAM", "", request), error => error.code === "INVALID_REQUEST");
  assert.equal(calls, 0);
});
