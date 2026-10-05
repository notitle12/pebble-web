# TABLE 명세 블록 · API #60 / Web #14

2026-10-03 · 1차 프런트 구현 범위. 백엔드 저장·게시 계약은 백엔드가 관리한다.

## 이번 범위

- Post `TABLE` 블록을 파싱하고 공개 글 상세에서 HTML 표로 SSR 렌더링한다. 사용자 값은 React 텍스트로 표시해 HTML로 실행하지 않는다.
- 개발 환경 `/dev/table-spec`에서 테이블명·설명·컬럼 구조를 편집하고 유효한 값만 실시간으로 미리 본다. `TableSpecEditor`의 `onChange` callback은 유효할 때 `TableSpec`, 입력 오류 때 `null`을 전달한다. `initialValue`로 기존 명세를 mount 때 채울 수 있으며 다른 글/블록을 편집할 때는 블록 ID를 React key로 지정해 초기값을 다시 적용한다. 개발 route의 client preview wrapper는 이 값을 JSON으로 보여준다. 이 경로는 작성 화면 설계 확인용이다. 로그인, Post 편집기 연결, 저장, 게시 기능은 구현하지 않는다.
- 가로 스크롤은 표 영역 안에 제한하고 셀 내용은 줄바꿈한다.

## 블록 계약

`content`는 JSON 문자열(최대 50,000 Unicode code point), `language`는 항상 `null`, `title`은 `null` 또는 최대 100 Unicode code point다. 작성기는 schema 문자열별 길이와 직렬화한 `content` 전체의 50,000 code point 제한을 함께 확인하며, 글자 수 제한을 UTF-16 단위로 잘라내지 않는다. JSON 객체의 허용 키는 정확히 아래 항목뿐이며 알 수 없는 키를 받지 않는다.

```json
{
  "schemaVersion": 1,
  "tableName": "member",
  "description": "회원 프로필",
  "columns": [
    {"name":"id","dataType":"BIGINT","nullable":false,"primaryKey":true,"description":"식별자"}
  ]
}
```

`schemaVersion`은 숫자 `1`, `tableName`과 컬럼 `name`·`dataType`은 공백이 아닌 1–100 code point 문자열이다. 테이블 설명과 컬럼 설명은 선택적 `string|null`(최대 500), `foreignKey`는 선택적 `string|null`(최대 200)이며 생략과 null을 모두 허용한다. 이 선택 문자열은 빈 문자열이어도 된다. `columns`는 1–50개다. 각 컬럼은 boolean `nullable`과 `primaryKey`를 가지며 PK는 NULL을 허용하지 않는다. 컬럼명은 trim 및 대소문자 무시 비교로 중복을 금지한다. 모든 schema 문자열에서 NUL과 lone surrogate를 거부한다.

## 구조와 후속 방향

TABLE 전용 입력은 `features/post/components/table-spec-editor.tsx`, 검증 타입은 `features/post/api/post-list.ts`, 정적 표는 `features/post/components/table-block.tsx`에 둔다. 인터랙티브 작성 컴포넌트만 Client Component이고 상세 표는 SSR Server Component 경로에서 렌더링한다. 현재 샘플 `member`의 `nickname`도 실제 회원 계약 길이에 맞춰 `VARCHAR(30)`으로 표현한다.

현재 FK 입력은 대상 컬럼 문자열을 표시하는 문서용 설명 필드다. 실제 참조 관계 검증·탐색은 제공하지 않는다. 후속 ERD는 컬럼의 FK를 관계 간선으로 연결하는 별도 읽기 전용 시각화로 검토할 수 있다. DB 도식과 Mermaid 코드는 TABLE 표 렌더링의 일부가 아니다.

백엔드 API #60의 TABLE 저장·수정 계약과 함께 회원 로그인과 소유자 권한을 갖춘 Post 작성기에서 이 편집기를 연결하는 것이 다음 단계다. 첫 단계에는 브라우저 저장·쿠키·토큰·외부 API 호출을 넣지 않는다.

## 검증 상태

파서 테스트는 valid 혼합 컬럼, 잘못된 스키마·길이·문자·중복, 잘못된 블록 언어와 50,000 code point 초과를 확인한다. Node 22 테스트 22개·타입 검사·최종 운영 빌드가 통과했다. 실제 검증 API 8081의 회원 PATCH → PostgreSQL → Guest GET → 프론트 TABLE 상세 표시를 확인했다. 기존 API 8080은 유지하고 미리보기 3100은 8081에 연결한다. 입력 미리보기에서 중복 컬럼명 오류/행 추가·삭제/PK 자동 NULL 금지/FK 표시/390px 화면 넘침 방지를 확인했다. 운영 서버 3200에서는 공개 표 SSR 200과 /dev/table-spec HTTP 404를 확인하고 종료했다.

운영 차단은 page의 notFound와 src/proxy.ts의 /dev/:path* 제한으로 처리한다. root loading 스트리밍이 시작되면 notFound의 HTTP status가 200일 수 있어 proxy에서 먼저 404를 반환한다. 사용자 입력은 HTML로 삽입하지 않는다.

후속 아키텍처는 Oracle Cloud/AWS/Cloudflare 그룹, Docker, 앱 서버, DB, 캐시, 스토리지 등 정해진 요소와 연결 설명을 선택하고 자동 배치하는 편집기다. 그 다음 ERD 관계 편집으로 확장한다. 현재 구현된 타입은 TABLE이며 두 도식 타입은 아직 없다.
