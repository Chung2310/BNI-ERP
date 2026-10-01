import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

const forbiddenCopy: Record<string, string[]> = {
  "src/components/common/ChatbotWidget.tsx": ["Khách hàng (CRM)", "pipeline", "Pipeline CRM"],
  "src/pages/Header.tsx": ["Omni-Inbox Chat"],
  "src/pages/LandingPage.tsx": ["Omni-Channel CRM", "Sales CRM & OmniChat", "CRM OmniChat", "sales CRM"],
  "src/pages/DashboardTab.tsx": [">SKU:", " SKU</span>"],
  "src/components/hr/KanbanTab.tsx": [">Kanban<", "{task.category || \"Onboarding\"}", "{editCategory || \"Onboarding\"}", "Ví dụ: Onboarding", "VD: Onboarding"],
  "src/components/hr/WorkflowTab.tsx": ["vd: Onboarding", "VD: Onboarding"],
  "src/pages/ChatTab.tsx": ["Kanban Task"],
};

test("user-facing business terms use plain Vietnamese", () => {
  for (const [file, phrases] of Object.entries(forbiddenCopy)) {
    if (!existsSync(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const phrase of phrases) assert.equal(source.includes(phrase), false, `${file}: ${phrase}`);
  }
});

const additionalForbiddenCopy: Record<string, string[]> = {
  "src/components/hr/KanbanTab.tsx": [">Tasks<", "Ví dụ: backend, api, security"],
  "src/components/resource/FileExplorer.tsx": [">Send to chat<"],
  "src/pages/LandingPage.tsx": ["OmniChat Inbox", "OMNICHAT INBOX", "Facebook Graph API", "Zalo Business API"],
  "src/pages/SubmitProofPage.tsx": ["Đang tải tệp lên Cloudinary"],
  "src/pages/UserAdminTab.tsx": ["chỉnh sửa balance"],
};

test("additional technical labels are not shown to users", () => {
  for (const [file, phrases] of Object.entries(additionalForbiddenCopy)) {
    if (!existsSync(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const phrase of phrases) assert.equal(source.includes(phrase), false, `${file}: ${phrase}`);
  }
});
