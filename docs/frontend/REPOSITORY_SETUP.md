# 프론트 저장소 초기 구성

2026-10-03 기준이다. 기존 MD 문서 9개를 내용 변경 없이 복원했다. 기존 README·HANDOFF와 프론트 안내에 나오는 초안 기능·검증 결과·저장소 미연결 표기는 백업한 이전 초안의 기록이며 새 프로젝트의 구현 완료 상태가 아니다.

## 저장소와 작업 위치

- 저장소: https://github.com/notitle12/pebble-web
- 작업 폴더: `/Users/su/Desktop/ai-coding/pebble/pebble-web`
- 초기 구성 이슈: https://github.com/notitle12/pebble-web/issues/1
- 작업 브랜치: `chore/1-initialize-web`
- 로컬 기준 브랜치: `dev`, 릴리스 브랜치: `main`
- 다른 프로젝트인 `pebble-web-hold`의 폴더·소스·Git 상태는 변경하지 않는다.
- 기존 초안과 문서 백업: `/Users/su/Desktop/ai-coding/pebble/backups/pebble-web-before-reset-20261003-135528/`

원격 저장소는 최초 연결 시 비어 있었다. 현재 로컬에 초기 기준 커밋과 작업 변경을 준비하며 원격 push·PR은 별도 단계다. 원격 기본 브랜치도 최초 push 후 dev로 설정한다.

## 환경과 실행

Node.js 22, npm, Next.js 16.3.8, React 19.3.0, TypeScript 7.0.2를 사용한다. 이전에 검증한 프레임워크 버전과 잠금 파일을 유지했다. 설정·잠금 파일·공개 환경변수 예시만 복원하며 이전 기능 코드는 복사하지 않았다.

```sh
npm ci
npm run dev
npm run typecheck
npm run build
```

개발 서버는 `http://localhost:3000`이다. API 주소는 공개 설정 예시 `.env.example`을 따른다. 실제 환경변수 파일·JWT 키·Naver Secret·R2 credential은 프론트로 복사하지 않는다. 현재 기본 앱에는 API 호출·인증·콘텐츠 기능이 없다. 이전 초안의 테스트와 npm test 스크립트도 이 단계에 복원하지 않았다. 동작을 추가할 때 관련 테스트를 함께 구성한다.

## 프론트 구조

백엔드와 같은 기능 소유권을 유지하되 브라우저 코드에 Java 계층을 기계적으로 복제하지 않는다.

```text
src/
  app/                  # 라우팅, 메타데이터, 레이아웃과 화면 조립
  features/             # auth, member, post, project, board, category, tag, comment, like
    post/
      api/              # 해당 기능의 API 호출과 응답 계약
      components/       # 해당 기능에 종속된 화면과 UI
      hooks/            # 필요한 경우 화면 상태·사용자 동작
  components/           # 기능에 종속되지 않는 공통 UI·레이아웃
  lib/                  # 공통 HTTP·오류·서식 처리 등 실제 공통 책임
```

features·components·lib는 기능 구현에 따라 파일을 추가한다. 빈 계층·Interface·Mapper를 먼저 만들지 않는다. DTO는 해당 기능 API가 소유하며, 공통 ApiResponse·오류 형식만 공통화한다. API ID는 문자열, 요청 페이지는 0부터 유지한다.

사용자용 웹은 USER Naver 인증과 개인 콘텐츠를 맡고, 관리자 UI는 별도 `pebble-admin-web`에서 관리자 인증·운영을 맡는다. 둘은 같은 `pebble-api`를 사용하며 관리자 토큰과 USER 세션을 섞지 않는다.

## 다음 구현

초기 구성 검증 후 콘텐츠 중심 홈 시안을 기준으로 공통 헤더와 홈·게시글·프로젝트 공개 탐색을 구현한다. 이후 USER 인증·프로필·개인 관리로 진행한다. 화면·API·보안 계약은 복원한 문서와 백엔드 최신 구현을 대조한다. 공개 블로그 기본 정보 등 API 부족 사항을 프론트에서 추정하거나 임의 endpoint로 우회하지 않는다.

## 초기 검증 결과

- 잠금 파일을 사용하는 오프라인 npm ci 성공: 31개 패키지 설치
- npm run build 성공: 기본 홈과 404 정적 페이지 생성
- npm run typecheck 성공
- 백업과 복원된 MD 9개의 SHA-256 동일성 확인
- origin과 로컬 dev·main·chore/1-initialize-web 확인
- 기본 앱에 동작 테스트 대상인 API·인증 기능은 없으며 별도 테스트를 실행했다고 표시하지 않는다.
