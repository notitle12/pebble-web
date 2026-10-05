# Pebble Web

첨부 디자인을 참고한 Next.js·React·TypeScript 프런트엔드다. 백엔드는 옆의 `pebble-api` 프로젝트를 사용한다.

## 실행

Node.js 22 LTS와 npm을 사용한다.

```bash
npm ci
npm run dev
```

- 실제 콘텐츠: http://localhost:3000/projects
- 디자인 미리보기: http://localhost:3000/preview
- Naver 로그인: http://localhost:3000/login
- 홈·태그·아카이브·소개·프로필과 콘텐츠 상세를 제공한다.
- 실제 목록이 비어 있거나 API가 실패해도 예시 데이터를 실제 기록처럼 보여주지 않는다.

## API와 로그인 설정

공개 API 주소 기본값은 `http://localhost:8080/api/v1`이다. 변경할 때는 `.env.example`을 참고해 `.env.local`의 `NEXT_PUBLIC_API_BASE_URL`을 설정한다. R2 키, JWT 개인 키, Naver Secret 및 토큰을 프런트엔드에 복사하지 않는다.

백엔드의 허용 Origin에 `http://localhost:3000`이 필요하다. Naver Developers의 callback과 백엔드 `NAVER_REDIRECT_URI`를 같은 주소로 맞춘다. 구현한 callback은 다음 두 경로다.

- `http://localhost:3000/oauth/callback/naver`
- `http://localhost:3000/auth/naver/callback`

브라우저와 API는 동일한 hostname `localhost`를 사용한다. `localhost`와 `127.0.0.1`을 섞으면 OAuth Cookie가 공유되지 않는다. 운영에서는 현재 백엔드 Secure·SameSite 정책을 유지할 수 있는 HTTPS·같은 사이트 배포를 사용한다.

Access Token은 메모리에서만 보관한다. Refresh Token은 백엔드의 HttpOnly Cookie를 사용한다. 한 탭의 Refresh는 single flight로 공유하고 일회용 OAuth 코드 및 Refresh 실패를 자동 재시도하지 않는다. 여러 탭 간 동시 회전은 기존 백엔드 재사용 탐지 정책상 재로그인이 필요할 수 있다.

## 검증

```bash
npm run typecheck
npm test
npm run build
```

사용자 프론트의 공개 조회·댓글·좋아요·글/프로젝트 작성과 관리·폴더·프로필 수정·탈퇴·이미지 API 연결을 구현했다. 단위 테스트와 로컬 실제 API 검증을 실제 Naver·R2·Workers 운영 검증과 구분한다. 현재 기능별 확인 범위와 배포 전 남은 항목은 [기능 연결 현황](docs/frontend/CONNECTION_STATUS.md)을 따른다. 관리자 화면은 별도 범위다.
