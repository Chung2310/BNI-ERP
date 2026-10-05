import { afterEach, expect, it, vi } from "vitest";
import { UserModel } from "../model/user.model";
import { crudService } from "./crud.service";
afterEach(() => vi.restoreAllMocks());
it("isolates member lists by company and strips credentials", async () => {
 const query = { sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([{ _id: "member", password: "hash", refreshToken: "token", companyCode: "BNI" }]) };
 const find = vi.spyOn(UserModel, "find").mockReturnValue((query as unknown as Parameters<((value: ReturnType<typeof UserModel.find>) => void)>[0]));
 const count = vi.spyOn(UserModel, "countDocuments").mockResolvedValue(1);
 const result = await crudService.getList("users", "BNI", { filters: { companyCode: "OTHER", $where: "bad" } }, "admin");
 expect(find).toHaveBeenCalledWith({ companyCode: "BNI" });
 expect(count).toHaveBeenCalledWith({ companyCode: "BNI" });
 expect(result.items).toEqual([{ _id: "member", companyCode: "BNI" }]);
});
it("keeps member details scoped to the current company", async () => {
 const find = vi.spyOn(UserModel, "findOne").mockReturnValue(({ lean: vi.fn().mockResolvedValue(null) } as unknown as Parameters<((value: ReturnType<typeof UserModel.findOne>) => void)>[0]));
 await expect(crudService.getById("users", "other-member", "BNI", "admin")).rejects.toThrow();
 expect(find).toHaveBeenCalledWith({ _id: "other-member", companyCode: "BNI" });
});
