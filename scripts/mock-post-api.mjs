import http from "node:http";

const samples = [
  ["Spring Security 인증 흐름을 정리하며 배운 것들", "필터 체인부터 예외 처리까지, 인증과 인가의 책임을 나눈 과정을 기록합니다.", "수민", ["Spring", "Java"]],
  ["SSR 페이지에서 API 오류와 빈 목록을 구분하기", "조회 실패를 빈 목록으로 숨기지 않고, 로딩과 재시도까지 함께 설계했습니다.", "지우", ["Next.js", "TypeScript"]],
  ["Oracle Cloud에 백엔드를 배포한 기록", "애플리케이션 실행 환경과 HTTPS, 배포 후 확인해야 할 항목을 정리했습니다.", "민준", ["Oracle Cloud", "Docker"]],
  ["R2 이미지 업로드와 만료되는 URL 다루기", "스토리지의 파일과 데이터베이스 참조의 수명이 다른 상황을 살펴봅니다.", "서연", ["Cloudflare", "R2"]],
  ["긴 한글 제목과 아주긴태그이름이 모바일 목록에서도 자연스럽게 줄바꿈되는지 확인하는 개발 기록", "작은 화면에서 제목과 태그가 잘리지 않는지 확인하는 미리보기용 글입니다.", "긴닉네임을사용하는개발자", ["접근성", "아주긴태그이름을사용한반응형검증"]],
  ["처음 작성하는 개발 기록", null, "도윤", []],
];
export const mockPosts = Array.from({ length: 21 }, (_, index) => {
  const [title, summary, nickname, names] = samples[index % samples.length];
  return {
    id: String(721389012345678901n + BigInt(index)), title: index < 6 ? title : `${title} (${index + 1})`, summary,
    author: { id: String(721389012345679000n + BigInt(index % samples.length)), nickname, blogName: null },
    tags: names.map((name, i) => ({ id: String(i + 1), name })),
    publishedAt: index === 5 ? null : new Date(Date.UTC(2026, 9, 3 - index, 3)).toISOString(),
    createdAt: new Date(Date.UTC(2026, 9, 3 - index, 3)).toISOString(),
  };
});

export function createMockApi(state = "normal") {
  if (!["normal", "empty", "error", "slow"].includes(state)) throw new Error("지원 상태: normal, empty, error, slow");
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    if (request.method !== "GET" || url.pathname !== "/api/v1/posts") {
      response.writeHead(404); response.end(JSON.stringify({ error: { code: "NOT_FOUND" } })); return;
    }
    if (state === "slow") await new Promise(resolve => setTimeout(resolve, 2500));
    if (state === "error") {
      response.writeHead(503); response.end(JSON.stringify({ error: { code: "INTERNAL_ERROR" } })); return;
    }
    const page = Number(url.searchParams.get("page") ?? "0");
    const size = Number(url.searchParams.get("size") ?? "20");
    if (!Number.isSafeInteger(page) || page < 0 || size !== 20) {
      response.writeHead(400); response.end(JSON.stringify({ error: { code: "INVALID_REQUEST" } })); return;
    }
    const posts = state === "empty" ? [] : mockPosts;
    const totalPages = Math.ceil(posts.length / size);
    response.end(JSON.stringify({ data: {
      content: posts.slice(page * size, (page + 1) * size), page, size,
      totalElements: posts.length, totalPages, hasNext: page + 1 < totalPages, hasPrevious: page > 0,
    } }));
  });
}
