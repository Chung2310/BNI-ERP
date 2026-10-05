import { expect, it, vi } from "vitest";
import { removeRetiredCollections, removeRetiredPermissions, RETIRED_COLLECTIONS } from "./remove-retired-collections";
function database(names: string[], documents = 0) {
  return { listCollections: vi.fn().mockReturnValue({ toArray: async () => names.map(name => ({ name })) }), collection: vi.fn().mockReturnValue({ countDocuments: vi.fn().mockResolvedValue(documents) }), dropCollection: vi.fn().mockResolvedValue(true) };
}
it("previews only retired collections without deleting data", async () => {
  const db = database([...RETIRED_COLLECTIONS]);
  const result = await removeRetiredCollections(db);
  expect(result.mode).toBe("preview");
  expect(db.dropCollection).not.toHaveBeenCalled();
  expect(db.listCollections).toHaveBeenCalledWith({ name: { $in: [...RETIRED_COLLECTIONS] } }, { nameOnly: true });
});
it("drops the two obsolete Telegram collections but preserves nonempty action history", async () => {
  const db = database([...RETIRED_COLLECTIONS], 2);
  const result = await removeRetiredCollections(db, true);
  expect(db.dropCollection.mock.calls.map(([name]) => name)).toEqual(["telegramlinktokens", "telegramsessions"]);
  expect(result.collections.find(c => c.name === "adminactions")).toMatchObject({ dropped: false, preserveHistory: true });
});
it("removes an unused empty action collection and safely reruns on missing collections", async () => {
  const db = database(["adminactions"]);
  await removeRetiredCollections(db, true);
  expect(db.dropCollection).toHaveBeenCalledExactlyOnceWith("adminactions");
  const empty = database([]);
  await removeRetiredCollections(empty, true);
  expect(empty.dropCollection).not.toHaveBeenCalled();
});

it("preserves every nonempty retired business collection", async () => {
  const names = RETIRED_COLLECTIONS.filter(name => !name.startsWith("telegram"));
  const db = database([...names], 1);
  const result = await removeRetiredCollections(db, true);
  expect(db.dropCollection).not.toHaveBeenCalled();
  expect(result.collections.filter(c => c.exists).every(c => c.preserveHistory)).toBe(true);
});
it("drops only existing empty collections in the explicit allowlist", async () => {
  const db = database([...RETIRED_COLLECTIONS]);
  await removeRetiredCollections(db, true);
  expect(db.dropCollection.mock.calls.map(([name]) => name)).toEqual([...RETIRED_COLLECTIONS]);
});
it("previews permissions without writes, then pulls only the two retired codes", async () => {
  const collection = { countDocuments: vi.fn().mockResolvedValue(2), updateMany: vi.fn().mockResolvedValue({ modifiedCount: 2 }), deleteMany: vi.fn().mockResolvedValue({ deletedCount: 2 }) };
  const db = { collection: vi.fn().mockReturnValue(collection) };
  await removeRetiredPermissions(db);
  expect(collection.updateMany).not.toHaveBeenCalled();
  expect(collection.deleteMany).not.toHaveBeenCalled();
  await removeRetiredPermissions(db, true);
  const codes = ["timekeeping:read", "timekeeping:manage"];
  expect(collection.updateMany).toHaveBeenCalledTimes(2);
  expect(collection.updateMany).toHaveBeenCalledWith({ permissions: { $in: codes } }, { $pull: { permissions: { $in: codes } } });
  expect(collection.deleteMany).toHaveBeenCalledExactlyOnceWith({ code: { $in: codes } });
});
