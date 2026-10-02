import { CompanyModel } from "../model/company.model";
import { UserModel } from "../model/user.model";
import { listResourceSourceDefinitions } from "../config/resource-source-registry";
import { resourceIndexingService } from "./resource-indexing.service";

type Member = { _id: unknown; displayName?: string; email?: string; branchId?: unknown };
type Dependencies = {
  company: (companyCode: string) => Promise<{ enabledModules?: string[] } | null>;
  members: (companyCode: string) => Promise<Member[]>;
  ensure: typeof resourceIndexingService.ensureSourceFolders;
};

// Only sources whose entity ID is a member ID can have member folders pre-created.
// Room, task and other record folders continue to be created by their source uploads.
const memberSources = new Map([
  ["hr.employee", "employee"],
  ["hr.contract", "employee"],
  ["profile.avatar", "user"],
  ["profile.cover", "user"],
]);
const supportedModules = new Set(["hr", "settings", "chat", "resource", "workflow"]);

export function createResourceFolderProvisioning(dependencies: Dependencies) {
  return {
    async ensure(companyCode: string) {
      const code = companyCode.trim().toUpperCase();
      if (!code) throw new Error("Mã công ty là bắt buộc.");
      const company = await dependencies.company(code);
      const enabled = company?.enabledModules?.length ? company.enabledModules : ["hr", "chat", "resource"];
      const sources = listResourceSourceDefinitions().filter(source =>
        supportedModules.has(source.moduleKey)
        && (source.moduleKey === "settings" || enabled.includes(source.moduleKey === "workflow" ? "hr" : source.moduleKey)),
      );
      // Upserts use stable company/source/member keys, so repeated calls update labels.
      for (const source of sources) await dependencies.ensure({ companyCode: code, sourceType: source.sourceType });
      const memberDefinitions = sources.filter(source => memberSources.has(source.sourceType));
      if (!memberDefinitions.length) return;
      const members = await dependencies.members(code);
      // Bound concurrent writes when a company has many members.
      for (let offset = 0; offset < members.length; offset += 5) {
        await Promise.all(members.slice(offset, offset + 5).map(async member => {
          const entityId = String(member._id);
          for (const source of memberDefinitions) {
            await dependencies.ensure({
              companyCode: code, sourceType: source.sourceType,
              entityType: memberSources.get(source.sourceType),
              entityId, entityLabel: member.displayName?.trim() || member.email || entityId,
              branchId: member.branchId ? String(member.branchId) : undefined,
            });
          }
        }));
      }
    },
  };
}

const provisioning = createResourceFolderProvisioning({
  company: async companyCode => CompanyModel.findOne({ code: companyCode }).select("enabledModules").lean(),
  members: async companyCode => UserModel.find({ companyCode, isActive: { $ne: false } })
    .select("_id displayName email branchId").lean(),
  ensure: input => resourceIndexingService.ensureSourceFolders(input),
});

// Coalesce simultaneous explorer requests without caching roster/name changes.
const pending = new Map<string, Promise<void>>();
export function ensureAutomaticResourceFolders(companyCode: string) {
  const key = companyCode.trim().toUpperCase();
  const existing = pending.get(key);
  if (existing) return existing;
  const work = provisioning.ensure(key).finally(() => pending.delete(key));
  pending.set(key, work);
  return work;
}
