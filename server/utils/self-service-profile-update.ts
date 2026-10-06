const SELF_SERVICE_PROFILE_FIELDS = [
  "displayName",
  "email",
  "photoURL",
  "coverImage",
  "industry",
  "phone",
  "birthDate",
  "gender",
  "address",
  "targetMarket",
  "companyName",
] as const;

export function pickSelfServiceProfileUpdate(
  updateData: Record<string, unknown>,
): Record<string, unknown> {
  const safeUpdateData: Record<string, unknown> = {};
  for (const field of SELF_SERVICE_PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updateData, field)) {
      safeUpdateData[field] = updateData[field];
    }
  }
  return safeUpdateData;
}
