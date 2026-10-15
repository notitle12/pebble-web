export const legalVersions = { termsVersion: "2026-10-15", privacyVersion: "2026-10-15" } as const;

export function getLegalPolicyConfig(env: Record<string, string | undefined> = process.env) {
  const operator = env.PEBBLE_LEGAL_OPERATOR?.trim() || "Pebble 운영팀 (개인 운영)";
  const officer = env.PEBBLE_LEGAL_PRIVACY_OFFICER?.trim() || operator;
  const email = env.PEBBLE_LEGAL_CONTACT_EMAIL?.trim() ?? "contact@pebble-log.com";
  const processing = env.PEBBLE_LEGAL_PROCESSING_DETAILS?.trim() ?? "";
  const retention = env.PEBBLE_LEGAL_RETENTION_DETAILS?.trim() ?? "";
  const validEmail = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);
  return { operator, officer, email: validEmail ? email : "", processing, retention,
    ready: env.PEBBLE_LEGAL_PUBLISHED === "true" && Boolean(operator && officer && validEmail && processing && retention) };
}
