# 제한형 아키텍처 블록

2026-10-03 · API Issue #62 / Web Issue #16

## 범위

TABLE 다음 단계다. 개발 전용 `/dev/architecture`에서 그룹·요소·방향 연결을 입력하고 자동 배치 미리보기를 확인한다. 공개 게시글 상세는 TEXT/CODE/TABLE/ARCHITECTURE 혼합 본문을 표시한다. 로그인과 전체 Post 작성/게시 화면은 아직 없으며 입력 컴포넌트를 연결하는 작업은 후속이다. ERD는 다음 단계다.

## 저장 계약

API `docs/API.md` 6.3과 `POST_VISUAL_BLOCKS.md`가 원본이다. `type=ARCHITECTURE`, `language=null`, `content`는 schemaVersion=1 JSON 문자열이다. groups(0~10)/nodes(1~30)/edges(0~60), 고정 type과 label, 전체 컬렉션에서 유일한 ASCII ID를 사용한다. 클라우드 → Docker의 두 단계 그룹만 허용한다. 없는 참조·자기 연결·같은 방향 중복은 오류이며 반대 방향/순환 연결은 가능하다. 자유 좌표·HTML·외부 script를 받지 않는다.

`ArchitectureEditor`는 `initialValue?: ArchitectureSpec`, `onChange?: (ArchitectureSpec|null)=>void`로 작성기 연결을 준비한다. 초기값은 마운트 시 적용하므로 편집 블록 변경 시 React key를 바꾼다. 유효하지 않은 입력은 null을 전달한다. 그룹/요소 삭제는 참조를 정리하며 서버가 최종 무결성을 검사한다. 새 dependency 없이 React SVG와 안전한 텍스트로 렌더링한다. 작은 화면에서 다이어그램만 내부 스크롤하고 요소/연결은 텍스트로도 제공한다.

## 로컬 연결

검증 API 8081은 임시 서명 키/테스트 프로필/R2 비활성이며 기존 API 8080은 유지했다. web 3100은 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8081/api/v1`에 연결한다. 전용 fixture의 `/blogs/local-preview/posts/integration-1`에 실제 회원 PATCH로 아키텍처를 추가하고 Guest GET으로 DB 결과를 조회했다. 잘못된 참조는 400이고 기존 TABLE 포함 혼합 본문은 유지된다. 실제 OAuth 로그인 검증과 구분한다.

선행 web TABLE PR #15와 API TABLE PR #61에 의존한다. 현재 작업은 이 브랜치들에서 분기했으며 dev 대상 draft PR에서는 선행 변경도 보인다. 선행 PR을 먼저 통합한 뒤 diff를 다시 확인한다.

## 검증

- API 격리 PostgreSQL/Redis 전체 테스트 462개 통과(실패/오류/스킵 0), 실제 PATCH/Guest GET/참조 오류 검증 완료.
- 프론트 테스트·타입 검사, 브라우저 입력/삭제/모바일, 최종 운영 빌드·개발 경로 HTTP 404 결과를 완료 후 아래에 기록한다.

완료 결과: Node 22 테스트 23개·타입 검사·최종 운영 빌드 통과. 브라우저에서 연결 추가 5→6, 빈 이름/자기 연결 오류와 복구, 요소 삭제 시 연결 5→2, 클라우드→Docker 전환 시 자식 parent 해제, 클라우드 삭제 시 하위 그룹 제거와 요소 groupId 정리를 확인했다. 390px에서 편집기/공개 상세 page width=375(스크롤바 제외), 다이어그램 영역 client=299/scroll=864로 페이지 가로 넘침 없이 내부 스크롤한다. 100자 한글 이름은 도식에서 줄이고 전체 텍스트 목록에 보존한다.

운영 서버 3200에서는 /dev/architecture와 /dev/table-spec HTTP 404, 실제 혼합 상세 HTTP 200과 SSR 아키텍처 마크업/안전한 텍스트 표시를 확인했다. 임시 운영 서버는 종료하고 실제 API 8081에 연결한 개발 미리보기 3100을 복구했다. 실제 OAuth·배포·전체 작성/게시 흐름은 후속이다.
