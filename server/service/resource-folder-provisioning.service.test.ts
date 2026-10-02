import { describe, expect, it, vi } from "vitest";
import { createResourceFolderProvisioning } from "./resource-folder-provisioning.service";

describe("automatic resource folders", () => {
  it("creates function and member folders using stable IDs, even with duplicate names", async () => {
    const ensure = vi.fn().mockResolvedValue({ _id: "folder" });
    const members = vi.fn().mockResolvedValue([
      { _id: "one", displayName: "An", branchId: "branch-a" },
      { _id: "two", displayName: "An" },
    ]);
    const service = createResourceFolderProvisioning({
      company: async () => ({ enabledModules: ["hr", "resource"] }), members, ensure,
    });
    await service.ensure(" acme ");
    expect(members).toHaveBeenCalledWith("ACME");
    expect(ensure).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "ACME", sourceType: "hr.employee", entityId: "one", entityLabel: "An", branchId: "branch-a" }));
    expect(ensure).toHaveBeenCalledWith(expect.objectContaining({ sourceType: "hr.employee", entityId: "two", entityLabel: "An" }));
    expect(ensure.mock.calls.some(([input]) => input.sourceType === "chat.attachment")).toBe(false);
    expect(ensure.mock.calls.some(([input]) => input.sourceType === "hr.training" && input.entityId)).toBe(false);
  });
  it("refreshes changed member names using the same folder identity", async () => {
    const folders = new Map<string, string>();
    let name = "Tên cũ";
    const service = createResourceFolderProvisioning({
      company: async () => ({ enabledModules: ["hr", "resource"] }),
      members: async () => [{ _id: "member", displayName: name }],
      ensure: async input => {
        folders.set(input.companyCode + ":" + input.sourceType + ":" + (input.entityId || ""), input.entityLabel || "");
        return { _id: "folder" } as any;
      },
    });
    await service.ensure("A"); const count = folders.size;
    name = "Tên mới"; await service.ensure("A");
    expect(folders.size).toBe(count);
    expect(folders.get("A:hr.employee:member")).toBe("Tên mới");
    await service.ensure("B");
    expect(folders.size).toBe(count * 2);
  });
  it("does not create disabled function folders and retains chat grouping by room", async () => {
    const ensure = vi.fn().mockResolvedValue({ _id: "folder" });
    await createResourceFolderProvisioning({
      company: async () => ({ enabledModules: ["resource", "chat"] }),
      members: async () => [{ _id: "member", email: "member@test.com" }], ensure,
    }).ensure("ACME");
    expect(ensure.mock.calls.some(([input]) => input.sourceType.startsWith("hr."))).toBe(false);
    expect(ensure).toHaveBeenCalledWith({ companyCode: "ACME", sourceType: "chat.attachment" });
    expect(ensure.mock.calls.some(([input]) => input.sourceType === "chat.attachment" && input.entityId)).toBe(false);
  });
});
