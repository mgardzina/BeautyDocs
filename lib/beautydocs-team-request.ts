export interface BeautyDocsTeamMemberPayload {
  readonly displayName: string;
  readonly email: string | null;
  readonly jobTitle: string | null;
  readonly performsTreatments: boolean;
  readonly allTreatments: boolean;
  readonly treatmentCodes: readonly string[];
}

export interface BeautyDocsTeamMemberUpdatePayload
  extends BeautyDocsTeamMemberPayload {
  readonly isActive: boolean;
}

export interface BeautyDocsStaffInvitationPayload {
  readonly email: string;
}

const TEAM_MEMBER_KEYS = [
  "allTreatments",
  "displayName",
  "email",
  "jobTitle",
  "performsTreatments",
  "treatmentCodes",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return (
    Object.keys(value).sort().join(",") === [...expected].sort().join(",")
  );
}

function parseTeamMemberFields(
  record: Record<string, unknown>,
): BeautyDocsTeamMemberPayload | null {
  if (
    typeof record.displayName !== "string" ||
    (record.email !== null && typeof record.email !== "string") ||
    (record.jobTitle !== null && typeof record.jobTitle !== "string") ||
    typeof record.performsTreatments !== "boolean" ||
    typeof record.allTreatments !== "boolean" ||
    !Array.isArray(record.treatmentCodes) ||
    record.treatmentCodes.length > 100 ||
    !record.treatmentCodes.every(
      (code) => typeof code === "string" && code.length <= 100,
    )
  ) {
    return null;
  }
  return {
    displayName: record.displayName,
    email: record.email,
    jobTitle: record.jobTitle,
    performsTreatments: record.performsTreatments,
    allTreatments: record.allTreatments,
    treatmentCodes: record.treatmentCodes as string[],
  };
}

export function parseBeautyDocsTeamMemberCreatePayload(
  value: unknown,
): BeautyDocsTeamMemberPayload | null {
  if (!isRecord(value) || !hasExactKeys(value, TEAM_MEMBER_KEYS)) return null;
  return parseTeamMemberFields(value);
}

export function parseBeautyDocsTeamMemberUpdatePayload(
  value: unknown,
): BeautyDocsTeamMemberUpdatePayload | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [...TEAM_MEMBER_KEYS, "isActive"]) ||
    typeof value.isActive !== "boolean"
  ) {
    return null;
  }
  const member = parseTeamMemberFields(value);
  return member === null ? null : { ...member, isActive: value.isActive };
}

export function parseBeautyDocsStaffInvitationPayload(
  value: unknown,
): BeautyDocsStaffInvitationPayload | null {
  if (!isRecord(value) || !hasExactKeys(value, ["email"])) return null;
  if (typeof value.email !== "string") return null;
  const email = value.email.trim();
  if (!email.includes("@") || email.length > 320) return null;
  return { email };
}
