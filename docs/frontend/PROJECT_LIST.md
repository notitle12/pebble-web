# 공개 프로젝트 목록 인계

2026-10-03 · Issue #8 · feature/8-public-project-list · 선행 PR #3/#5/#7 기반, dev 통합 전.

/projects에 Guest SSR 목록과 헤더 메뉴를 추가했다. q가 있으면 GET /projects/search, 없으면 GET /projects를 사용하고 tagId·lifecycleStatus·page·size를 전달한다. PUBLIC 범위와 정렬은 서버에 맡기고 회원 자격·쿠키는 전달하지 않는다. no-store와 8초 제한을 유지한다.

카드는 이름·소유자·요약·태그·IN_PROGRESS/COMPLETED·발행일(없으면 생성일)을 표시한다. 없는 통계·미디어·프로젝트 상세 링크를 만들지 않는다. 상세·편집·로그인은 다음 작업이다.

URL q/tagId/lifecycleStatus/page를 검증하고 검색은 첫 페이지로, 페이지 이동/재시도는 조건을 유지한다. 중복·알 수 없는 조건·200 Unicode 문자 초과·잘못된 태그/상태/page는 안내 화면이다. 로딩·전체 빈 목록·검색 없음·범위 밖·API 오류·태그 조회 실패를 구분한다. 기존 태그 선택기의 폭·스크롤·키보드 처리를 재사용한다.

실제 두 기능이 재사용하는 부분만 분리했다: lib/public-api.ts(Guest 조회/오류), lib/list-query.ts(공통 목록 입력), features/tag/api/public-tags.ts와 tag/components/tag-picker.tsx. post API의 기존 exports는 유지했다. Node 22 기본 테스트의 TS 상대 import를 위해 noEmit 환경에서 allowImportingTsExtensions를 사용한다. 신규 dependency는 없다.

검증: Node 22에서 npm test 16개·npm run build·npm run typecheck 통과. 목 프로젝트 21개로 메뉴 이동·2페이지·Pebble+Spring+진행 중 AND 검색·검색 없음·뒤로 가기 입력 복원·초기화를 브라우저에서 확인했다. 390px 태그 메뉴 좌우 33~342px, 페이지 가로 넘침 없음을 확인했다. 실제 로컬 API의 목록과 검색/진행 상태 응답은 총 0개이며 조회/검증 함수 통과. 실제 프로젝트가 있는 응답·운영 API·Workers는 미검증이다.

npm run dev:mock에서 /projects로 확인한다. 기존 empty/error/slow 모드는 프로젝트에도 적용된다. 실제 오류를 목 결과로 대체하지 않는다. 기존 AGENTS.md·Next 생성 경로 변경은 제외한다. 선행 PR들을 통합한 뒤 이번 PR의 프로젝트 변경을 통합한다.
