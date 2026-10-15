import { MemberApiError, responseData } from "../../lib/member-api.ts";
import { isIsoInstant } from "../../lib/date-time.ts";

export const memberAgreementVersions = { termsVersion: "2026-10-15", privacyVersion: "2026-10-15" } as const;
export type MemberAgreementState = { termsVersion: string; privacyVersion: string; accepted: boolean; acceptedAt: string | null; available: boolean };
export const memberAgreementAcceptance = {
  termsVersion: memberAgreementVersions.termsVersion,
  privacyVersion: memberAgreementVersions.privacyVersion,
  termsAccepted: true,
  privacyAccepted: true,
  ageConfirmed: true,
} as const;

export function parseMemberAgreementState(value: unknown): MemberAgreementState {
  const data = responseData(value);
  if (typeof data.termsVersion !== "string" || typeof data.privacyVersion !== "string" || typeof data.accepted !== "boolean" || !(data.acceptedAt === null || (typeof data.acceptedAt === "string" && isIsoInstant(data.acceptedAt))) || (data.available !== undefined && typeof data.available !== "boolean")) {
    throw new MemberApiError(0, "INVALID_RESPONSE", "약관 동의 상태를 확인하지 못했습니다.");
  }
  return { termsVersion: data.termsVersion, privacyVersion: data.privacyVersion, accepted: data.accepted, acceptedAt: data.acceptedAt, available: data.available === true };
}

export function isCurrentMemberAgreement(value: MemberAgreementState): boolean {
  return value.accepted && value.termsVersion === memberAgreementVersions.termsVersion && value.privacyVersion === memberAgreementVersions.privacyVersion && value.acceptedAt !== null;
}
