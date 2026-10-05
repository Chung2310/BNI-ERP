import { expect, it, vi } from "vitest";
import { removeLegacyUserFields } from "./remove-legacy-user-fields";
import { LEGACY_USER_FIELDS } from "../utils/legacy-user-fields";
it("previews without mutating any documents", async () => {
  const collection = { countDocuments: vi.fn().mockResolvedValue(5), updateMany: vi.fn() };
  expect(await removeLegacyUserFields(collection)).toEqual({ mode: "preview", matched: 5, modified: 0 });
  expect(collection.updateMany).not.toHaveBeenCalled();
});
it("unsets only retired User fields in the requested company and is repeatable", async () => {
  const collection = { countDocuments: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0), updateMany: vi.fn().mockResolvedValue({ matchedCount: 2, modifiedCount: 2 }) };
  expect(await removeLegacyUserFields(collection, { apply: true, companyCode: " bni " })).toEqual({ mode: "apply", matched: 2, modified: 2 });
  const [filter, update] = collection.updateMany.mock.calls[0];
  expect(filter.companyCode).toBe("BNI");
  expect(update).toEqual({ $unset: Object.fromEntries(LEGACY_USER_FIELDS.map((key) => [key, ""])) });
  for (const key of ["role", "permissions", "companyCode", "companyName", "industry", "photoURL", "coverImage", "driveOAuth"]) expect(update.$unset).not.toHaveProperty(key);
  expect((await removeLegacyUserFields(collection, { apply: true })).modified).toBe(0);
  expect(collection.updateMany).toHaveBeenCalledTimes(1);
});
