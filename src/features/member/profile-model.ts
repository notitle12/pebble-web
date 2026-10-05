import { MemberApiError, responseData } from "../../lib/member-api.ts";

export type EditableMemberProfile = {
  id: string;
  nickname: string;
  blogName: string;
  handle: string;
  nicknameChangeAvailableAt: string | null;
  blogNameChangeAvailableAt: string | null;
};

function invalid(): never {
  throw new MemberApiError(0, "INVALID_RESPONSE", "프로필 정보를 확인하지 못했습니다. 다시 불러와 주세요.");
}

function safeTimestamp(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") invalid();
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts || !Number.isFinite(Date.parse(value))) invalid();
  const [, year, month, day, hour, minute, second] = parts;
  const calendarDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  if (Number(month) < 1 || Number(month) > 12 || calendarDate.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) invalid();
  return value;
}

export function parseEditableMemberProfile(value: unknown, expectedId: string): EditableMemberProfile {
  const data = responseData(value);
  if (data.id !== expectedId || data.profileCompleted !== true || typeof data.nickname !== "string" || typeof data.blogName !== "string" || typeof data.handle !== "string" || data.status !== "ACTIVE") invalid();
  const nicknameChangeAvailableAt = safeTimestamp(data.nicknameChangeAvailableAt);
  const blogNameChangeAvailableAt = safeTimestamp(data.blogNameChangeAvailableAt);
  if (!nicknameChangeAvailableAt || !blogNameChangeAvailableAt) invalid();
  return {
    id: expectedId,
    nickname: data.nickname,
    blogName: data.blogName,
    handle: data.handle,
    nicknameChangeAvailableAt,
    blogNameChangeAvailableAt,
  };
}

export function normalizeProfileName(value: string, field: "nickname" | "blogName"): string {
  const normalized = value.trim().normalize("NFC");
  const max = field === "nickname" ? 30 : 100;
  const length = Array.from(normalized).length;
  if (!length) throw new Error(field === "nickname" ? "닉네임을 입력해 주세요." : "블로그명을 입력해 주세요.");
  if (length > max) throw new Error(field === "nickname" ? "닉네임은 30자 이내로 입력해 주세요." : "블로그명은 100자 이내로 입력해 주세요.");
  if (/[\u0000-\u001f\u007f]/.test(normalized) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(normalized)) {
    throw new Error("정상적인 유니코드 문자를 입력해 주세요.");
  }
  return normalized;
}

export function formatProfileAvailability(value: string | null, now = Date.now()): string {
  if (!value) return "변경 가능 시각을 확인할 수 없습니다. 다시 불러와 주세요.";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "변경 가능 시각을 확인할 수 없습니다. 다시 불러와 주세요.";
  if (timestamp <= now) return "지금 변경할 수 있어요.";
  return `${new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Seoul" }).format(timestamp)}부터 변경할 수 있어요.`;
}
