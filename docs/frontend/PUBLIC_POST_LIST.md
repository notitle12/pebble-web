# 공개 게시글 목록 구현 인계

2026-10-03 · Issue #2 · feature/2-public-post-list → dev (PR 검토 전)

## 구현

`/`에서 Guest 공개 API `GET /api/v1/posts?page=0&size=20`를 서버에서 조회한다. `NEXT_PUBLIC_API_BASE_URL`은 `/api/v1`까지 포함하며 `.env.example`을 기준으로 설정한다. 인증 헤더·회원 쿠키를 전달하지 않고 no-store를 사용한다. 요청 제한 시간은 8초다.

라우트는 조립과 URL 페이지 검증, features/post/api는 응답 검증·조회, features/post/components는 목록·상태·페이지 이동을 담당한다. TSID는 문자열로 유지한다. URL page는 0부터 시작하고 표시 번호는 1부터 시작한다. 중복·음수·소수·offset 초과는 안내 화면을 표시한다.

제목·작성자·요약·태그·발행일을 표시한다. 로딩, 빈 목록, 범위 밖 페이지, API/연결 실패와 다시 시도를 제공한다. 글 상세·검색·인증·썸네일·Workers 배포는 이번 범위 밖이다. 상세 화면이 없어 카드에 링크를 만들지 않았다.

## 검증

Node 22에서 npm test 6개, npm run typecheck, npm run build 통과. 빌드에서 /는 동적 SSR로 확인했다.

모의 API: 21개 결과의 첫/둘째 페이지 이동, 로딩, 빈 목록, 503 안내와 재시도 복구, 음수 page 안내를 브라우저에서 확인했다. HTTP HTML에 게시글 본문이 포함되는 것도 확인했다. 390px 모바일 화면에 가로 넘침이 없고 키보드로 홈 링크를 탐색했다. 모의 서버는 검증용 임시 파일이며 앱에 포함하지 않는다.

실제 로컬 API http://127.0.0.1:8080/api/v1: 200 응답의 page=0, size=20, 총 0개를 응답 검증기로 확인하고 실제 연결 화면에서 빈 상태를 확인했다. 실제 게시글이 있는 목록·실 OAuth·Oracle 운영 API·Workers 런타임은 미검증이다.

기존 AGENTS.md 수정은 이 기능 커밋에서 제외한다. Next dev가 자동 변경한 next-env.d.ts도 생성 경로 변경만 있으므로 제외한다. 공통 문서는 별도 문서 변경으로 관리한다.
