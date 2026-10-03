# 화면·권한·API 명세

목표 설계다. 초안에서 이미 구현된 라우트와 앞으로 구현할 라우트를 혼동하지 않는다. API 표의 경로는 `/api/v1` 기준이다.

## 1. 화면 영역

| 영역 | 목적 | 탐색 기준 |
|---|---|---|
| 공개 탐색 | 여러 개발자의 Post·Project 발견 | 전체 공개 콘텐츠·Category·Tag·검색 |
| 개인 블로그 | 특정 개발자의 기록과 프로젝트 | 고정 handle·작성자·개인 Board |
| 내 관리 | 내 공개/비공개/차단 콘텐츠 관리 | 인증된 본인·소유권·계정 상태 |
| 관리자 운영 | 검수·분류·계정 운영 | 관리자 인증·MANAGER/MASTER 역할 |

참고 이미지의 왼쪽 개인 블로그 이름을 서비스 전체 목록의 소유자처럼 표시하지 않는다. 개인 Board와 서비스 공통 Category는 별개의 탐색 항목이다.

## 2. 주요 라우트와 계약

| 목표 화면 | 프런트 라우트 | 사용 API | 접근·표현 |
|---|---|---|---|
| 전체 Post | `/` | GET `/posts`, `/posts/search` | Guest 가능, 작성자 표시·공개 결과 |
| 전체 Project | `/projects` | GET `/projects`, `/projects/search` | Guest 가능, 소유자 표시·태그·진행 상태 |
| Project 상세 | `/projects/{id}` | GET `/projects/{id}`, `/{id}/posts` | 공개/권한 있는 상세, 관련 Post·미디어·외부 링크 |
| 분류 탐색 | `/tags`, `/categories` | GET `/tags`, `/categories`, `/posts` | Tag와 최대 2단계 Category 구분 |
| 개인 블로그 Post 목록 | `/blogs/{handle}` | GET `/blogs/{handle}/posts` | 특정 블로그의 공개 글; 헤더 정보 계약 확인 필요 |
| 공개 Post 상세 | `/blogs/{handle}/posts/{postKey}` | 같은 경로의 GET | postKey는 slug 또는 글 번호; 생성 후 고정 |
| 개인 Board | 블로그 내 게시판 선택 | GET `/members/{id}/boards`, `/{id}/boards/{boardId}/posts` | 최대 3단계; 해당 Board 직접 연결 글만 |
| 개인 Project | `/blogs/{handle}/projects` | GET `/members/{id}/projects` | handle→회원 식별 계약 확인 필요 |
| 내 콘텐츠 | `/me/posts`, `/me/projects` | GET `/members/me/posts`, `/members/me/projects` | ACTIVE USER; PUBLIC/HIDDEN·차단 상태 표시 |
| 작성·편집 | `/posts/new`, `/projects/new`, `/{kind}/{id}/edit` | 콘텐츠 POST/PATCH와 분류·Board·Project 조회 | ACTIVE·프로필 완료·소유권; 공개 상태 입력 |
| 로그인 | `/login` | POST `/auth/naver/authorization`, `/login` | Naver만, 공개 둘러보기 허용 |
| OAuth callback | `/oauth/callback/naver` 또는 `/auth/naver/callback` | POST `/auth/naver/login` | 등록한 URI와 일치; 일회용 code/state |
| 최초/변경 프로필 | `/settings/profile` | GET `/members/me`, profile POST/PATCH | handle 최초 확정 후 변경 불가, 이름별 7일 쿨타임 |
| 계정·탈퇴 | `/settings/account`, `/withdrawal/cancel` | DELETE `/members/me`, Naver 취소 API | 정확히 7일 유예·재인증 취소·다시 로그인 |
| 관리자 | `/admin/login`, `/admin/...` | 관리자 auth·members·posts·projects·comments·classification API | USER 세션과 구분, MASTER만 관리자 계정 관리 |

`/posts/{id}`는 초안의 내부 ID 상세 경로다. 공개 링크의 기준은 handle과 postKey로 구성한 블로그 주소다. 최종 구현에서 내부 경로를 남기면 canonical 경로와 일관된 연결 방식을 정한다.

아카이브는 블로그 범위의 공개 글을 날짜별로 묶는 UI이며 별도 Archive Domain/API를 만들지 않는다. 월 필터·월별 집계는 현재 API가 제공한다고 가정하지 않는다. 소개 화면의 사용자 자기소개·연락처는 현재 회원 DTO에 없으므로 제공하지 않는 데이터를 채워 넣지 않는다.

## 3. 인증·권한 흐름

Guest → Naver 로그인 → 본인 상태 확인 → `profileCompleted=false`이면 최초 프로필 설정 → 내 콘텐츠 작성/관리로 이동한다. 미완료 회원도 공개 탐색·댓글·좋아요·Board 관리가 가능하므로 모든 화면을 프로필 설정으로 강제 차단하지 않는다. 콘텐츠 작성은 설정 완료를 안내한다.

버튼 노출 기준은 해당 API 계약을 따른다. MEMBER의 소유권과 ADMIN 역할을 혼용하지 않는다. 관리자 토큰으로 USER 댓글·좋아요·콘텐츠 작성을 제공하지 않는다.

| 상태 | 화면 동작 |
|---|---|
| PUBLIC·미차단·정상 소유자 | 공개 탐색·권한에 따른 상호작용 |
| HIDDEN | 일반 탐색 제외, 소유자 관리 표시 |
| 차단 | 일반 탐색 제외, 소유자 관리에서 차단 안내; 작성자는 해제 불가 |
| DELETED | 일반 목록·상세 제외, 사용자 복원 버튼 없음 |
| SUSPENDED | 회원의 보호된 동작 제한; 기존 공개 글을 임의로 숨기지 않음 |
| WITHDRAWAL_PENDING | 일반 계정 사용과 공개 노출 중단, Naver 취소 경로 안내 |

404에서 비공개·차단 여부를 추측해 타인에게 알려주지 않는다. 차단·탈퇴·소유자 상세의 댓글 예외는 API 6.7절을 따르며 일괄 공개하지 않는다.

## 4. 콘텐츠 기능

- Post: title·summary·Category·Tag·Board·Project 연결·PUBLIC/HIDDEN·고정 slug, 순서 있는 TEXT/CODE 블록과 썸네일. 코드 블록의 언어·제목·복사·가로 넘침을 설계한다.
- Project: name·summary·description·기술 Tag·주요 기능·외부 링크·시작/완료일·진행 상태·구조 설명·실행 방법·미디어·관련 Post를 설계한다.
- Project 진행 상태는 `IN_PROGRESS`, `COMPLETED`만 제공한다. 계획 중·준비 중은 추가하지 않는다.
- 댓글은 PUBLIC/SECRET과 권한별 조회·본인 수정·삭제를 구분한다. 대댓글·신고 등 Scope Out을 추가하지 않는다.
- 좋아요는 멱등 PUT/DELETE이며 서버의 likeCount·likedByMe를 표시한다.
- 미디어는 정적 JPEG/PNG/WebP·10MiB 입력, 서버 WebP 변환, Project 대표 이미지 하나, 설명·순서를 사용한다. URL 만료 시 콘텐츠 API로 권한과 새 URL을 다시 확인한다.
- 차단·비공개·탈퇴 상태에서 미디어 URL이 null이면 임의 URL을 조립하지 않는다. 삭제 연결 완료와 실제 R2 파일 정리 완료를 같은 시점으로 표시하지 않는다.

## 5. 모든 화면의 상태

로딩, 데이터 없음, 검색 결과 없음, 연결 실패·재시도, 잘못된 입력, 인증 만료, 권한 거부, 미존재, 쓰기 처리 중·성공을 제공한다. 검색 시 이전 응답이 최신 결과를 덮지 않아야 한다. 서버 검색 범위와 지원 필터를 그대로 사용한다.

확인하지 않은 집계·마지막 활동·메일·SNS 링크는 표시하지 않는다. 관리자 강제 삭제·회원 탈퇴 등 영향이 큰 동작에는 구체적인 대상·결과를 안내한다.
