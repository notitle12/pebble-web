const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function isIsoInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_INSTANT.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth && hour <= 23 && minute <= 59 && second <= 59;
}

export function formatSeoulDateTime(value: unknown): string | null {
  if (!isIsoInstant(value)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day} ${fields.hour}:${fields.minute}:${fields.second} (한국 시간)`;
}
