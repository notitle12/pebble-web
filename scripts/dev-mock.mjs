import { spawn } from "node:child_process";
import { createMockApi } from "./mock-post-api.mjs";

const state = process.argv[2] ?? "normal";
const server = createMockApi(state);
server.on("error", error => { console.error(`목 API 실행 실패: ${error.message}`); process.exitCode = 1; });
server.listen(18080, "127.0.0.1", () => {
  console.log(`목 데이터 미리보기 (${state}): http://127.0.0.1:3100 — Ctrl+C로 종료`);
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
    stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:18080/api/v1", PEBBLE_PREVIEW_MODE: "mock" },
  });
  const stop = () => { child.kill("SIGTERM"); server.close(); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  child.once("error", error => { console.error(error.message); server.close(); process.exitCode = 1; });
  child.once("exit", code => { server.close(); process.exitCode = code ?? 0; });
});
