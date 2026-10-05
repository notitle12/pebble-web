<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Pebble 에이전트 진입점

이 저장소는 Pebble의 사용자 프론트 web이다. 작업 시작 시 `../pebble-api/docs/system/AGENTS.md`를 읽고 프론트 경로를 따른다. 공통 개발 원칙 → 프론트 공통 기준 → Pebble 프로젝트 README·frontend/README.md → 해당 화면·API 계약 순으로 확인한다. 세부 규칙은 공통 문서에서 관리하고 이 파일에 복제하지 않는다.

문서가 없거나 접근할 수 없으면 그 사실을 보고하고 확인 가능한 범위만 진행한다. 다른 작업 환경에서도 공통 문서를 함께 제공한다. 위의 Next.js 자동 생성 지침은 보존한다.

프론트·백엔드 공통 Git 절차는 `../pebble-api/docs/system/projects/pebble/GIT_WORKFLOW.md`를 반드시 확인한다. GitHub Issue → 번호가 있는 작업 브랜치 → 검증·push → dev PR → 검토·CI → 병합을 완료 기준으로 사용하며 배포만으로 완료하지 않는다.
