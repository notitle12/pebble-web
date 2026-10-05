# 사용자 프론트 Workers 배포

2026-10-04: `pebble-web`을 Cloudflare Workers에 실제 배포하고 `www.pebble-log.com` Custom Domain을 연결했다. 최초 버전은 `b7790f98-7e03-4df1-abf8-98fd5b8dc37b`다. apex 도메인 리다이렉트는 아직 구성하지 않았다.

## 구성

- Next.js 16.3.8 / OpenNext Cloudflare 1.20.8 / Wrangler 4.147.0 / Node 22.
- 공개 API 주소: `https://api.pebble-log.com/api/v1`. 빌드 시 브라우저 번들에 포함되는 비밀이 아닌 주소다.
- 프론트에 DB·Redis·R2·Naver 비밀 키를 넣지 않는다. 기존 비밀 파일을 읽거나 복사하지 않는다.
- `workers_dev`, preview URL, observability는 비활성화했다. 로그인은 허용된 www Origin에서만 검증한다.
- 현재 공개 API 조회는 no-store이며 개인 데이터는 인증 복구 뒤 브라우저에서 조회한다. 초기 배포는 R2 incremental cache와 이미지 최적화 바인딩을 추가하지 않는다.
- 정적 JS/CSS는 해시 경로에 immutable 캐시를 적용한다.

## 후속 배포 명령

Node 22 환경에서 `npm run build:worker` 후 `npm run deploy:worker`를 실행한다. `npm run preview:worker -- --port 8788`로 배포 전에 Workers 런타임을 확인할 수 있다.

`scripts/workers.mjs`는 임시 폴더에 소스·공개 자산·빌드 설정만 복사하고 npm ci와 빌드를 실행한다. `.env*`·`.dev.vars*`는 제외하며 자식 프로세스에 전달하는 환경도 제한한다. Next/Wrangler가 원본 저장소의 비밀 파일을 자동으로 읽지 않도록 한다. 성공한 임시 빌드 경로만 ignored `.worker-build-path`에 기록한다. 임시 폴더가 삭제되거나 소스·API 주소가 변경되면 다시 빌드한다. 기존 일반 `npm run build`는 Next 기본 명령이므로 이 비밀 파일 제외 절차를 적용하지 않는다.

Wrangler 인증은 사용자가 승인한 공식 OAuth 로그인을 사용한다. 인증 파일을 수동으로 읽거나 출력하지 않는다. 배포 설정의 Custom Domain으로 DNS·인증서가 연결되며 www를 Oracle A 레코드로 설정하지 않는다.

## 검증과 남은 연결

- 테스트 109개, 타입 검사, Workers 빌드 성공. 압축 코드 2355.58 KiB, 최초 원격 startup 17 ms.
- 로컬 Workers 및 실제 www HTTPS에서 `/login` 200, `/dev/architecture`·`/dev/table-spec` 404 확인.
- 실제 www 홈 HTML과 브라우저 화면이 열림. 홈 cache-control은 private/no-store.
- API DNS는 Oracle IP를 가리키지만 원격 API 443 접속은 아직 타임아웃. 홈은 API 연결 실패 상태를 정상 표시한다. 정상 공개 데이터·Naver 로그인·회원 쓰기·미디어의 운영 연동 완료를 뜻하지 않는다.
- Oracle Caddy 설치와 OS 80/443 방화벽 허용 완료. OCI 보안 목록/NSG의 TCP 80/443 설정 및 공인 인증서 발급·공개 API 응답 검증이 남아 있다. DB/Redis와 API 8080은 공개하지 않는다.
- 실제 OAuth는 Naver에 `https://www.pebble-log.com/auth/naver/callback` 등록 후 별도 확인한다.

OpenNext는 Node middleware 지원이 experimental이라고 경고한다. 현재 proxy는 개발 전용 경로 차단에만 사용하고 로컬/원격 404를 실제 확인했다. 어댑터 업데이트 때 같은 차단 검증을 유지한다. 롤백은 Workers 배포 이력에서 이전 정상 버전을 선택한다. 이번 배포가 최초 버전이므로 이전 정상 버전은 아직 없다.

## 공개 API 연결 갱신 (2026-10-04, 23시대 KST)

OCI TCP 80/443 수신 규칙 추가 뒤 공개 API HTTPS 200을 확인했다. 사용자 SSH 22번은 본인 공인 IP /32로 제한됐으며 새 SSH 접속도 성공했다. 실제 www 홈·프로젝트·분류·로그인은 200이고 API 연결 실패 표시가 사라졌다. 운영 /dev/architecture는 404다. API OAuth authorization CORS preflight는 www Origin만 credentials=true로 허용하고 외부 Origin은 403이다. 위의 API 타임아웃 기록은 규칙 추가 전 이력이며 해결됐다. 실제 Naver 로그인·회원 쓰기·이미지 업로드/조회는 별도 운영 검증이 남아 있다.

## 로그인 안내 수정 (2026-10-04)

프로필과 탈퇴 영역이 각각 MemberGate를 렌더링해 비로그인 안내가 두 번 표시되는 문제를 수정했다. 프로필 화면에서는 탈퇴 영역의 별도 비로그인 안내를 생략하고 기본 권한 검사는 유지한다. Workers 빌드·타입 검사를 통과해 버전 73491337-2a71-4b25-a2ed-9186c2d11447로 배포했다. 실제 쿠키 없는 refresh는 401 INVALID_REFRESH_TOKEN이며 새로운 브라우저 화면은 복구 오류 대신 guest 안내를 표시했다. 기존 오류 원인이 과거 API 연결 실패였는지는 당시 네트워크 기록이 없어 확정하지 않는다. 자동 refresh 재시도 정책은 변경하지 않았다.

## 2026-10-05 갱신 오류 및 안내 중복

운영 refresh Lua의 TYPE 권한 누락을 API 배포 설정에서 수정했다. 실제 사용자 회전은 해당 브라우저의 후속 확인이 필요하다. 부가 계정 영역의 fallback을 로딩 상태에도 적용해 중복 로딩을 생략했다. Workers 빌드·타입 검사를 통과해 0ce0e8bf-ba82-4459-9ba0-ea43a13fb987로 배포했다. 무조건 refresh 재시도 또는 500을 guest로 바꾸는 정책은 추가하지 않았다.


2026-10-05 블로그 생성/프로필/탈퇴 설정 개선: 격리 빌드·배포 성공, 버전 `2f86f6cc-205b-47ae-84f0-273c0b04523d`. gzip 2367.31KiB, startup 16ms. 기능 계약과 검증 범위는 [블로그 생성·프로필](BLOG_CREATION_PROFILE.md)을 따른다. 개인 .env/.dev.vars는 읽거나 빌드에 복사하지 않았다.

2026-10-05 로그아웃 위치 개선: 상단 프로필 이미지 옆으로 이동하고 생성/프로필 폼·펼침 메뉴 중복 제거. 버전 `d12989d8-d9f8-4e30-9a3d-0fc395ec83ee`, gzip 2367.32KiB, startup 19ms. 타입 검사·격리 빌드와 로컬 모바일 검증 통과.

2026-10-05 탈퇴 안내 개선 배포: `7816c211-197a-4e15-be84-8cf7773f9a6f`. 설정 중복 안내 제거·버튼 간격, 재로그인 시 삭제 예정 시각(한국 시간)과 단일 예약 취소 버튼 제공. API `pebble-api:withdrawal-time-20261005`와 함께 배포, 실제 회원 탈퇴/취소는 미수행. 프론트 114개 테스트와 격리 빌드 통과.
