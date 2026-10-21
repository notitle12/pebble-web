import { loginDestination } from "./login-destination.ts";

export const LOGIN_RETURN_KEY = "pebble-login-return-intent";
const legacyKey = "pebble-login-destination";
const maxAge = 30 * 60 * 1000;
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

export function rememberLoginReturn(storage: Storage, state: string, destination: string, now = Date.now()) {
  if (!state || state.length > 256) throw new Error("로그인 요청을 확인하지 못했습니다.");
  storage.removeItem(legacyKey);
  storage.setItem(LOGIN_RETURN_KEY, JSON.stringify({ state, destination: loginDestination(destination), createdAt: now }));
}

export function consumeLoginReturn(storage: Storage, state: string | null, now = Date.now()) {
  const saved = storage.getItem(LOGIN_RETURN_KEY);
  storage.removeItem(LOGIN_RETURN_KEY);
  const legacy = storage.getItem(legacyKey);
  storage.removeItem(legacyKey);
  // 배포 전에 시작한 로그인만 기존 저장 형식을 한 번 호환한다.
  if (!saved) return legacy ? loginDestination(legacy) : "/me/blog";
  try {
    const intent = JSON.parse(saved);
    if (intent && state && intent.state === state && typeof intent.destination === "string" &&
      typeof intent.createdAt === "number" && Number.isFinite(intent.createdAt) &&
      now >= intent.createdAt && now - intent.createdAt <= maxAge) return loginDestination(intent.destination);
  } catch { /* 잘못되거나 만료된 목적지는 관리 화면으로 보내지 않는다. */ }
  return "/me/blog";
}
