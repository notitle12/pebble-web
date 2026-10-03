# 아키텍처 기술 카드·캔버스

2026-10-03 · API Issue #62 / Web Issue #16

## 범위

TABLE 다음 단계다. 개발 전용 `/dev/architecture`에서 기술 카드·직접 만든 요소를 캔버스에 추가하고 배치·그룹·방향 연결을 편집한다. 공개 게시글 상세는 TEXT/CODE/TABLE/ARCHITECTURE 혼합 본문을 표시한다. 로그인과 전체 Post 작성/게시 화면은 아직 없으며 입력 컴포넌트를 연결하는 작업은 후속이다.

## 저장 계약

API `docs/API.md` 6.3과 `POST_VISUAL_BLOCKS.md`가 원본이다. `type=ARCHITECTURE`, `language=null`, `content`는 schemaVersion=1 JSON 문자열이다. groups(0~10)/nodes(1~30)/edges(0~60), 기본/CUSTOM type과 자유 label, 로컬 기술 icon, 선택 position, 전체 컬렉션에서 유일한 ASCII ID를 사용한다. 비-Docker 그룹(클라우드/CUSTOM) → Docker의 두 단계 그룹을 허용한다. 없는 참조·자기 연결·같은 방향 중복은 오류이며 반대 방향/순환 연결은 가능하다. position은 카드 좌상단의 {x,y} 절대 좌표이며 각각 0~4000 정수다. 임의 HTML·외부 SVG/아이콘 URL·script를 받지 않는다.

`ArchitectureEditor`는 `initialValue?: ArchitectureSpec`, `onChange?: (ArchitectureSpec|null)=>void`로 작성기 연결을 준비한다. 초기값은 마운트 시 적용하므로 편집 블록 변경 시 React key를 바꾼다. 유효하지 않은 입력은 null을 전달한다. 그룹/요소 삭제는 참조를 정리하며 서버가 최종 무결성을 검사한다. 새 dependency 없이 React SVG와 안전한 텍스트로 렌더링한다. 작은 화면에서 다이어그램만 내부 스크롤하고 요소/연결은 텍스트로도 제공한다.

## 로컬 연결

검증 API 8081은 임시 서명 키/테스트 프로필/R2 비활성이며 기존 API 8080은 유지했다. web 3100은 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8081/api/v1`에 연결한다. 전용 fixture의 `/blogs/local-preview/posts/integration-1`에 실제 회원 PATCH로 아키텍처를 추가하고 Guest GET으로 DB 결과를 조회했다. 잘못된 참조는 400이고 기존 TABLE 포함 혼합 본문은 유지된다. 실제 OAuth 로그인 검증과 구분한다.

선행 web TABLE PR #15와 API TABLE PR #61에 의존한다. 현재 작업은 이 브랜치들에서 분기했으며 dev 대상 draft PR에서는 선행 변경도 보인다. 선행 PR을 먼저 통합한 뒤 diff를 다시 확인한다.

## 캔버스 설계

초기 제한형 입력 폼에 대한 피드백으로 기술 팔레트·드래그 캔버스·선택 속성 방식으로 개선했다. Spring/PostgreSQL/Redis/Docker/Oracle Cloud/AWS/Cloudflare/Workers/R2/React/Node.js/NGINX 카드를 제공하고 사용자 정의 이름과 기본 아이콘으로 다른 기술도 표현한다. 그룹 경계는 포함된 요소에 맞춰지고 Docker는 클라우드 또는 사용자 정의 그룹 안에 둘 수 있다.

전체 보기와 원래 크기 전환, 자동 정렬, 드래그, 방향키(5px)/Shift+방향키(20px), 숫자 좌표 입력을 제공한다. 전체 보기에서도 실제 SVG 배율을 반영해 드래그한다. 모바일은 도식만 내부 스크롤한다. 연결 모드에서 시작·도착 카드를 선택하고 연결 설명을 편집한다. 자기 연결/같은 방향 중복을 거부하며 요소 삭제 시 연결도 정리한다. 검증 실패 시 onChange(null)이므로 작성기는 저장을 막아야 한다.

저장 계약은 version 1에 CUSTOM과 선택 icon/position을 추가했으며 이전 위치 없는 데이터는 자동 배치한다. 모든 아이콘은 저장소 내부 SVG이며 외부 URL/HTML을 허용하지 않는다. 일반 게시글에서는 편집 핸들러 없이 동일한 도식을 SSR로 렌더링한다.

## 검증 결과 (2026-10-03)

- 프론트 Node 22 테스트 24개, 타입 검사, 운영 빌드 통과. 최대 30개 요소/10개 그룹 자동 배치 좌표 범위와 저장 좌표 보존을 검사했다.
- 브라우저에서 RabbitMQ 사용자 정의 카드 추가·이름 변경·Docker 그룹 선택, 원래 크기 및 전체 보기 드래그, 방향키 이동, 연결 추가·설명 수정, 자기 연결/중복 거부, 요소 삭제 시 연결 제거, 자동 정렬을 확인했다.
- 390px 뷰포트에서 page width=375(스크롤바 제외), 캔버스 패널 width=343으로 페이지 가로 넘침이 없었다. 작은 도식의 전체 이름은 접근 가능한 텍스트/목록에 유지한다.
- 백엔드 격리 PostgreSQL/Redis 전체 463개 통과(실패/오류/스킵 0). 초기 실행에서는 새 CUSTOM 계약과 충돌한 이전 거부 테스트를 UNKNOWN으로 수정했다. 무관한 관리자 Redis TTL 경계 1ms 실패는 코드 변경 없이 전체 재실행에서 통과했다.
- 실제 회원 PATCH → DB 저장 → Guest GET으로 CUSTOM/아이콘/좌표 재조회를 확인했다. 잘못된 참조는 400이며 기존 TABLE 본문이 유지됐다.
- 운영 서버 3200에서 /dev/architecture와 /dev/table-spec은 HTTP 404. 실제 공개 혼합 상세는 HTTP 200이며 RabbitMQ와 저장 좌표 translate(820 160), translate(610 160)가 SSR 응답에 있었다. 임시 운영 서버를 종료하고 개발 미리보기 3100을 복구했다.

현재 개발 화면은 작성 컴포넌트 미리보기다. 로그인·전체 게시글 작성/게시 화면 연결, 실제 OAuth 로그인, Cloudflare 배포는 이번 검증 범위에 포함되지 않는다.
