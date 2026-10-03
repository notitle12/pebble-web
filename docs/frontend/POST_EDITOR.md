# 게시글 작성·비공개 저장

2026-10-04. 선행 TABLE/ARCHITECTURE PR #17 이후의 사용자 web 기능이다. 새로운 관리자 작성 기능이나 DRAFT 상태를 추가하지 않는다.

## 화면과 저장

- `/posts/new`: 제목·요약과 TEXT/CODE/TABLE/ARCHITECTURE 블록을 작성하고 HIDDEN으로 저장한다.
- `/posts/{id}/edit`: 본인 상세를 Bearer로 읽어 저장한 배열 순서와 구조를 복원한다. 공개 글은 기존 PUBLIC 상태를 유지한 채 본문을 수정한다. 기존 분류·태그·Board·Project·slug는 PATCH에서 생략해 보존한다.
- `/me/posts`: 본인 공개·비공개 글 및 차단 상태, 페이지 이동과 수정 링크.
- 블록 추가·위/아래 이동·삭제·유효성 검사·미리보기를 제공한다. 숨긴 블록 편집기도 유지하여 유효하지 않은 입력이 탭 전환으로 사라지지 않는다. 테이블 입력 ID는 인스턴스별로 구분한다.
- 저장 중 폼과 SVG 상호작용을 막고 실패는 입력과 변경 상태를 보존한다. 성공 응답 뒤 저장 완료와 변경 없음 상태를 표시한다. 미저장 변경은 새로고침·탭 닫기 전 beforeunload로 알린다. SPA 내부 링크 이동에 대한 별도 확인창은 아직 제공하지 않는다.
- API에는 별도 DRAFT가 없다. 빈 제목이나 무효 구조를 서버에 임시 저장하는 기능, 자동 저장, 공개 전환, 분류 선택·미디어 업로드는 후속 범위다.

## 회원 인증

`/login` → Naver authorization → `/auth/naver/callback` → login → 본인 조회 → `/me/posts` 또는 `/settings/profile` 흐름이다. callback은 code/state를 메모리로 캡처한 뒤 주소에서 제거하며 중복 요청·자동 재시도를 하지 않는다. Naver redirect URI와 등록한 callback을 동일하게 설정해야 한다. callback referrer는 no-referrer다.

Access Token은 모듈 메모리에만 보관한다. Refresh Cookie는 기존 서버의 HttpOnly/Secure/SameSite=Lax 정책 그대로 사용한다. 프로필 미완료 회원은 블로그명·고정 handle 최초 설정 뒤 작성한다. 서버가 역할·ACTIVE·프로필·소유권을 최종 검증한다.

세션 복구 요청은 한 탭에서 Promise 하나를 공유하고 같은 Origin의 Web Locks로 login/refresh/logout을 직렬화한다. Logout은 먼저 메모리 자격을 비우고 진행 중 cookie 회전 뒤 서버 폐기를 실행한다. 늦은 결과는 세대 검증으로 버린다. BroadcastChannel은 로그인·로그아웃 변경만 알리고 토큰을 전달하지 않는다. 다른 탭의 계정 변경은 개인 화면을 제거한다. Web Locks 미지원 시 안전한 복구를 거부한다. 여러 USER frontend Origin을 동시에 사용하는 경우 별도 설계가 필요하다.

401 쓰기를 자동 재전송하지 않는다. 작성기에서 현재 세션의 만료 실패는 입력을 유지하고 편집을 잠근다. 다시 로그인 페이지로 이동하면 메모리 입력이 사라질 수 있으므로 화면에서 확인해야 한다. Refresh 응답 유실·네트워크/서버 오류는 Guest와 구분하고 자동 refresh 재시도를 하지 않는다. 토큰을 localStorage/sessionStorage/cookie/URL에 저장하지 않고 개인 요청은 cache:no-store, credentials:omit + Bearer를 사용한다.

## 검증

- 전체 프론트 테스트: 40개 (작성 모델, 구조 보존, 실제 transport 실패, refresh 단일화, 늦은 refresh/login과 logout, 401 재전송 방지, 잠금 미지원·폐기 실패).
- 실제 로컬 API8081·PostgreSQL·Redis와 브라우저: state/cookie 검증, 로그인·본인 조회, HIDDEN 생성, 네 종류 블록과 순서·SQL 언어·연결 변/waypoint 저장, 새로고침 복구, 두 탭 동시 refresh 성공.
- 무효 테이블 컬럼을 비운 뒤 다른 블록으로 전환해도 입력 오류와 저장 불가가 유지됨을 확인했다. 수정 PATCH 성공, 로컬 테스트 회원 SUSPENDED 상태의 403 거부와 입력 유지, ACTIVE 복구 후 재저장 성공을 확인했다. 테스트 회원 상태는 복구했다.
- 저장한 HIDDEN 글은 Guest GET `/posts/{id}`에서 404다. 공개 상태의 쓰기 전환은 이번에 제공하지 않는다.
- Naver 공급자 token/profile 통신은 전용 localhost 대역이다. 실 Naver 계정·운영 HTTPS 쿠키·Workers 배포·실 프로필 최초 설정은 미검증이다. 테스트 전용 key/pepper/자격 증명을 저장소에 넣지 않는다.

로컬 검증 API는 기존 사용자 API8080과 분리되어 8081에 실행한다. API base는 `http://127.0.0.1:8081/api/v1`, web Origin은 `http://127.0.0.1:3100`이다. Secure 쿠키 정책을 약화하지 않았으며 브라우저의 루프백 예외에서 확인했다. 운영은 동일 사이트 HTTPS와 정확한 CORS Origin을 사용해야 한다.

최종 확인: 전체 프론트 테스트 40개와 타입 검사를 포함한 프로덕션 빌드가 통과했다. 운영 빌드에서도 실제 회원 PATCH 저장에 성공했고 `/posts/new`·수정·내 글 최초 HTML에 개인 제목/본문이 없으며 noindex를 제공한다. `/dev/architecture`는 운영에서 404다. 모바일 390px 환경에서 document 폭 375px과 scrollWidth 375px로 페이지 넘침 없음 확인 후 viewport를 복원했다. 새 이슈 게시가 자동 승인 검토에서 별도 승인을 요구하여 현재는 로컬 `feature/post-editor` 브랜치에 분리했다.


## 공개 게시 후속 (2026-10-04)

로컬 `feature/post-publish`는 작성 브랜치를 기반으로 전체 글 미리보기와 공개 설정을 추가한다. 일반 저장은 기존 visibilityStatus를 생략하여 그대로 유지하며, 신규 글의 일반 저장 기본값은 HIDDEN이다. `미리보기·게시 설정`에서 공개/비공개를 선택하고 `공개로 게시` 또는 `비공개로 전환`을 누르면 현재 제목·요약·본문과 상태를 한 번의 POST/PATCH로 함께 저장한다. 공개 전환 전까지 라디오 선택 자체는 서버를 변경하지 않는다. 계속 편집 시 기존 입력을 그대로 유지한다.

전체 미리보기와 공개 SSR 상세는 같은 PostBody 컴포넌트를 사용하여 TEXT/CODE/TABLE/ARCHITECTURE의 순서와 표시를 맞춘다. 게시 성공 뒤 공개 상세 확인 링크를 제공하며 prefetch는 끈다. 차단 글은 공개 선택·제출을 제한한다. 서버의 차단·회원 상태·소유권 검증이 최종 기준이며 isBlocked·기존 분류/태그/Board/Project/slug는 전송하지 않는다. 오류에서는 입력·선택 범위·게시 미리보기를 유지하고 쓰기를 자동 재전송하지 않는다.

검증: 프론트 전체 테스트 42개와 타입 검사 통과. 로컬 실제 API의 HIDDEN → PUBLIC 전환 뒤 Guest GET으로 공개 상태·publishedAt·네 종류 블록 순서 및 waypoint {x:241,y:135} 유지 확인. 실제 브라우저에서 전체 미리보기와 공개 상세 표시 확인. PUBLIC → HIDDEN 전환 뒤 숫자 ID와 블로그 공개 주소 모두 Guest 404를 확인했다. 명시적 전환과 일반 저장의 상태 보존, 차단 제한, 유효하지 않은 입력 거부를 모델 테스트로 검증했다. 운영 HTTPS·실 Naver·Workers 및 미디어/분류 선택은 아직 후속이다.

최종 확인: 모바일 CSS 수정 후 프로덕션 빌드와 타입 검사 통과. 운영 빌드에서 실제 PATCH 공개 게시 성공 및 비인증 공개 상세 SSR HTML에 제목·TABLE·CODE·ARCHITECTURE 표시, 편집 제어 없음 확인. 390px 모바일 환경에서 document clientWidth와 scrollWidth 모두 375px로 페이지 넘침이 없으며 넓은 표·다이어그램은 내부에서 스크롤한다. 검증 후 로컬 개발 서버 3100과 테스트 API8081을 유지했다.
