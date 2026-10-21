import { Router } from "express";
import Joi from "joi";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth";
import { CompanyModel } from "../model/company.model";
import { UserModel } from "../model/user.model";
import { MembershipApplicationModel } from "../model/membership-application.model";
import { ChapterLeaveRequestModel } from "../model/chapter-leave-request.model";
import { authService } from "../service/auth.service";
import { runInTransaction } from "../config/database";
import { disconnectUserSockets } from "../socket";
import { MeetingModel } from "../modules/meetings/meeting.model";
import { notificationService } from "../service/notification.service";

export const chapterRouter = Router();

async function chapterDeletionBlocker(code: string, ownerEmail: string): Promise<string | null> {
  const member = await UserModel.exists({
    companyCode: code,
    $nor: [{ role: "admin", email: ownerEmail.toLowerCase() }],
  });
  return member ? "Chapter đã có thành viên, không thể xóa." : null;
}

function fail(res: import("express").Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Không thể xử lý yêu cầu.";
  const duplicate = (error as { code?: number })?.code === 11000;
  return res.status(duplicate ? 409 : 400).json({ status: "error", message: duplicate ? "Yêu cầu đã tồn tại." : message });
}

function chapterAdmin(req: import("express").Request, res: import("express").Response): string | null {
  if (req.user?.role === "superadmin") {
    const code = (req.query.chapterCode || req.body?.chapterCode || req.user.companyCode) as string;
    if (code) return String(code).toUpperCase();
  }
  if (req.user?.role !== "admin" || !req.user.companyCode) {
    res.status(403).json({ status: "error", message: "Chỉ admin chapter được xử lý yêu cầu này." });
    return null;
  }
  return req.user.companyCode;
}

function objectId(id: string) { return mongoose.isValidObjectId(id); }

// The public directory exposes chapter metadata and the chairperson's display name, never its member roster.
chapterRouter.get("/", async (_req, res) => {
  const chapters = await CompanyModel.find({ isBniChapter: true, lifecycleStatus: { $in: ["active", null] }, acceptsApplications: { $ne: false } })
    .select("code name chapterRegion chapterAddress ownerEmail")
    .sort({ name: 1 }).lean();
  const admins = await UserModel.find({ role: "admin", companyCode: { $in: chapters.map(chapter => chapter.code) } })
    .select("companyCode email displayName").lean();
  const chairpersons = new Map<string, string>();
  for (const chapter of chapters) {
    const admin = admins.find(user => user.companyCode === chapter.code && user.email?.toLowerCase() === chapter.ownerEmail?.toLowerCase());
    if (admin?.displayName) chairpersons.set(chapter.code, admin.displayName);
  }
  res.json({ data: chapters.map(chapter => ({
    code: chapter.code,
    name: chapter.name,
    chapterRegion: chapter.chapterRegion,
    chapterAddress: chapter.chapterAddress,
    chairpersonName: chairpersons.get(chapter.code) || "",
  })) });
});

chapterRouter.get("/directory/:code", requireAuth, async (req, res) => {
  const code = req.params.code.toUpperCase();
  const chapter = await CompanyModel.findOne({
    code, isBniChapter: true, lifecycleStatus: { $in: ["active", null] }, acceptsApplications: { $ne: false },
  }).select("code name chapterRegion chapterAddress ownerEmail").lean();
  if (!chapter) return res.status(404).json({ message: "Không tìm thấy chapter." });

  const [chairperson, memberCount, completedMeetingCount] = await Promise.all([
    UserModel.findOne({ companyCode: code, role: "admin", email: chapter.ownerEmail.toLowerCase() }).select("displayName").lean(),
    UserModel.countDocuments({ companyCode: code, role: { $ne: "superadmin" }, isActive: { $ne: false } }),
    MeetingModel.countDocuments({ companyCode: code, status: "ended" }),
  ]);
  return res.json({ data: {
    code: chapter.code,
    name: chapter.name,
    chapterRegion: chapter.chapterRegion,
    chapterAddress: chapter.chapterAddress,
    chairpersonName: chairperson?.displayName || "",
    memberCount,
    completedMeetingCount,
  } });
});

chapterRouter.use(requireAuth);

chapterRouter.get("/manage", async (req, res) => {
  if (req.user?.role !== "superadmin") return res.status(403).json({ message: "Chỉ superadmin được quản lý chapter." });
  const chapters = await CompanyModel.find({ isBniChapter: true, lifecycleStatus: { $nin: ["archived", "scheduled-deletion"] } }).select("code name chapterRegion chapterAddress acceptsApplications lifecycleStatus ownerEmail").sort({ name: 1 }).lean();
  return res.json({ data: chapters });
});

chapterRouter.get("/manage/:code/overview", async (req, res) => {
  if (req.user?.role !== "superadmin") return res.status(403).json({ message: "Chỉ superadmin được xem toàn bộ chapter." });
  const code = req.params.code.toUpperCase();
  const chapter = await CompanyModel.exists({ code, isBniChapter: true });
  if (!chapter) return res.status(404).json({ message: "Không tìm thấy chapter." });
  const [members, applications, leaves] = await Promise.all([
    UserModel.find({ companyCode: code }).select("displayName email phone companyName industry photoURL role").sort({ displayName: 1 }).lean(),
    MembershipApplicationModel.find({ chapterCode: code, status: "pending" }).sort({ createdAt: 1 }).lean(),
    ChapterLeaveRequestModel.find({ chapterCode: code, status: "pending" }).populate("userId", "displayName email").sort({ createdAt: 1 }).lean(),
  ]);
  const applicants = await UserModel.find({ _id: { $in: applications.map(application => application.applicantUserId) } })
    .select("displayName email phone companyName industry photoURL").lean();
  const byId = new Map(applicants.map(user => [String(user._id), user]));
  return res.json({ data: { members, leaves, applications: applications.map(application => ({
    ...application, profileSnapshot: byId.has(String(application.applicantUserId))
      ? { ...application.profileSnapshot, ...byId.get(String(application.applicantUserId)) }
      : application.profileSnapshot,
  })) } });
});

chapterRouter.get("/manage/:code/delete-check", async (req, res) => {
  if (req.user?.role !== "superadmin") return res.status(403).json({ message: "Chỉ superadmin được kiểm tra Chapter." });
  const code = req.params.code.toUpperCase();
  const chapter = await CompanyModel.findOne({ code, isBniChapter: true, lifecycleStatus: { $nin: ["archived", "scheduled-deletion"] } })
    .select("ownerEmail").lean();
  if (!chapter) return res.status(404).json({ message: "Không tìm thấy chapter." });
  try {
    const reason = await chapterDeletionBlocker(code, chapter.ownerEmail);
    return res.json({ data: { canDelete: !reason, reason } });
  } catch { return res.status(503).json({ message: "Chưa thể kiểm tra thành viên Chapter. Vui lòng thử lại." }); }
});

const createChapterSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]{2,32}$/).required(),
  name: Joi.string().trim().min(2).max(150).required(),
  region: Joi.string().trim().max(120).allow("").default(""),
  address: Joi.string().trim().max(255).allow("").default(""),
  adminName: Joi.string().trim().min(2).max(120).required(),
  adminEmail: Joi.string().email().max(254).required(),
  adminPassword: Joi.string().min(8).max(128).required(),
}).unknown(false);

const validationFieldNames: Record<string, string> = {
  code: "Mã Chapter", name: "Tên Chapter", region: "Khu vực / Tỉnh thành",
  address: "Địa chỉ sinh hoạt định kỳ", adminName: "Họ tên Admin Chapter",
  adminEmail: "Email đăng nhập Admin", adminPassword: "Mật khẩu Admin ban đầu",
  chapterRegion: "Khu vực / Tỉnh thành", chapterAddress: "Địa chỉ sinh hoạt định kỳ",
  acceptsApplications: "Nhận đơn gia nhập", chapterCode: "Mã Chapter",
  decision: "Quyết định", reason: "Lý do",
};

function validationMessage(error: Joi.ValidationError): string {
  const detail = error.details[0];
  const key = String(detail?.path[0] ?? "");
  const field = validationFieldNames[key] || "Dữ liệu";
  const limit = detail?.context?.limit;
  switch (detail?.type) {
    case "any.required": case "string.empty": return `Vui lòng nhập ${field}.`;
    case "string.min": return `${field} phải có ít nhất ${limit} ký tự.`;
    case "string.max": return `${field} không được vượt quá ${limit} ký tự.`;
    case "string.email": return `${field} không đúng định dạng email.`;
    case "string.pattern.base": return `${field} chỉ được gồm chữ cái không dấu, số, dấu gạch ngang hoặc gạch dưới (2–32 ký tự).`;
    case "any.only": return `${field} không hợp lệ.`;
    case "object.unknown": return "Yêu cầu chứa trường dữ liệu không được hỗ trợ.";
    case "object.min": return "Vui lòng nhập ít nhất một thông tin cần cập nhật.";
    default: return `${field} không hợp lệ.`;
  }
}

chapterRouter.post("/manage", async (req, res) => {
  if (req.user?.role !== "superadmin") return res.status(403).json({ message: "Chỉ superadmin được tạo chapter." });
  const { error, value } = createChapterSchema.validate(req.body);
  if (error) return res.status(400).json({ message: validationMessage(error) });
  try {
    const result = await authService.registerCompanyAndAdmin({
      companyCode: value.code, companyName: value.name, ownerName: value.adminName,
      ownerEmail: value.adminEmail, ownerPassword: value.adminPassword,
    });
    await CompanyModel.updateOne({ _id: result.company._id }, { $set: {
      chapterRegion: value.region, chapterAddress: value.address, acceptsApplications: true,
    } });
    return res.status(201).json({ data: { code: value.code, name: value.name, adminEmail: value.adminEmail } });
  } catch (e) { return fail(res, e); }
});

chapterRouter.patch("/manage/:code", async (req, res) => {
  if (req.user?.role !== "superadmin") return res.status(403).json({ message: "Chỉ superadmin được cập nhật chapter." });
  const { error, value } = Joi.object({
    name: Joi.string().trim().min(2).max(150),
    chapterRegion: Joi.string().trim().max(120).allow(""),
    chapterAddress: Joi.string().trim().max(255).allow(""),
    acceptsApplications: Joi.boolean(),
  }).min(1).unknown(false).validate(req.body);
  if (error) return res.status(400).json({ message: validationMessage(error) });
  const chapter = await CompanyModel.findOneAndUpdate(
    { code: req.params.code.toUpperCase(), isBniChapter: true, lifecycleStatus: { $nin: ["archived", "scheduled-deletion"] } }, { $set: value }, { returnDocument: "after", runValidators: true },
  ).select("code name chapterRegion chapterAddress acceptsApplications lifecycleStatus").lean();
  return chapter ? res.json({ data: chapter }) : res.status(404).json({ message: "Không tìm thấy chapter." });
});

chapterRouter.delete("/manage/:code", async (req, res) => {
  if (req.user?.role !== "superadmin") return res.status(403).json({ message: "Chỉ superadmin được xóa chapter." });
  const code = req.params.code.toUpperCase();
  const existing = await CompanyModel.findOne({ code, isBniChapter: true, lifecycleStatus: { $nin: ["archived", "scheduled-deletion"] } })
    .select("ownerEmail").lean();
  if (!existing) return res.status(404).json({ message: "Không tìm thấy chapter." });
  try {
    const reason = await chapterDeletionBlocker(code, existing.ownerEmail);
    if (reason) return res.status(409).json({ message: reason });
    const chapter = await CompanyModel.findOneAndUpdate(
      { code, isBniChapter: true, lifecycleStatus: { $nin: ["archived", "scheduled-deletion"] } },
      { $set: { lifecycleStatus: "archived", lifecycleChangedAt: new Date(), acceptsApplications: false, deletionReason: "Đã xóa bởi superadmin." } },
      { returnDocument: "after" },
    ).select("code name lifecycleStatus").lean();
    return chapter ? res.json({ data: chapter }) : res.status(404).json({ message: "Không tìm thấy chapter." });
  } catch { return res.status(503).json({ message: "Chưa thể kiểm tra thành viên Chapter. Vui lòng thử lại." }); }
});

chapterRouter.get("/me/applications", async (req, res) => {
  const data = await MembershipApplicationModel.find({ applicantUserId: req.user!.id }).sort({ createdAt: -1 }).lean();
  return res.json({ data });
});

chapterRouter.post("/me/applications", async (req, res) => {
  const { error, value } = Joi.object({
    chapterCode: Joi.string().trim().uppercase().required(),
  }).unknown(false).validate(req.body);
  if (error) return res.status(400).json({ message: validationMessage(error) });
  if (req.user?.role === "superadmin" || req.user?.role === "admin" || req.user?.companyCode) {
    return res.status(409).json({ message: "Tài khoản đã thuộc một chapter hoặc không đủ điều kiện nộp đơn." });
  }
  try {
    const chapter = await CompanyModel.findOne({ code: value.chapterCode, isBniChapter: true, lifecycleStatus: { $in: ["active", null] }, acceptsApplications: { $ne: false } }).select("code").lean();
    if (!chapter) return res.status(404).json({ message: "Chapter không tồn tại hoặc chưa nhận đơn." });
    const user = await UserModel.findById(req.user!.id).select("displayName email phone companyName industry photoURL companyCode").lean();
    if (!user || user.companyCode) return res.status(409).json({ message: "Tài khoản đã thuộc chapter." });
    if (await MembershipApplicationModel.exists({ applicantUserId: user._id, status: "pending" })) {
      return res.status(409).json({ message: "Bạn đã có một đơn đang chờ. Hãy sửa hoặc xóa đơn đó trước." });
    }
    const application = await MembershipApplicationModel.create({
      applicantUserId: user._id, chapterCode: chapter.code,
      profileSnapshot: {
        displayName: user.displayName, email: user.email, phone: user.phone,
        companyName: user.companyName, industry: user.industry, photoURL: user.photoURL,
      },
    });
    const currentMember = await UserModel.findById(req.user!.id).select("companyCode").lean();
    if (currentMember?.companyCode) {
      await MembershipApplicationModel.updateOne(
        { _id: application._id, status: "pending" },
        { $set: { status: "superseded", decidedAt: new Date(), decisionReason: "Đã được chapter khác tiếp nhận." } },
      );
      return res.status(409).json({ message: "Tài khoản vừa được một chapter khác tiếp nhận." });
    }
    return res.status(201).json({ data: application });
  } catch (e) { return fail(res, e); }
});

chapterRouter.patch("/me/applications/:id", async (req, res) => {
  if (!objectId(req.params.id)) return res.status(400).json({ message: "Mã đơn không hợp lệ." });
  const { error, value } = Joi.object({ chapterCode: Joi.string().trim().uppercase().required() }).unknown(false).validate(req.body);
  if (error) return res.status(400).json({ message: validationMessage(error) });
  if (req.user?.companyCode) return res.status(409).json({ message: "Tài khoản đã thuộc chapter." });
  const chapter = await CompanyModel.findOne({ code: value.chapterCode, isBniChapter: true, lifecycleStatus: { $in: ["active", null] }, acceptsApplications: { $ne: false } }).select("code").lean();
  if (!chapter) return res.status(404).json({ message: "Chapter không tồn tại hoặc chưa nhận đơn." });
  const application = await MembershipApplicationModel.findOneAndUpdate(
    { _id: req.params.id, applicantUserId: req.user!.id, status: "pending" },
    { $set: { chapterCode: chapter.code } }, { returnDocument: "after" },
  ).lean();
  return application ? res.json({ data: application }) : res.status(409).json({ message: "Đơn không còn ở trạng thái chờ." });
});

chapterRouter.delete("/me/applications/:id", async (req, res) => {
  if (!objectId(req.params.id)) return res.status(400).json({ message: "Mã đơn không hợp lệ." });
  const application = await MembershipApplicationModel.findOneAndDelete({ _id: req.params.id, applicantUserId: req.user!.id, status: "pending" }).lean();
  return application ? res.json({ data: application }) : res.status(409).json({ message: "Đơn không còn ở trạng thái chờ." });
});

chapterRouter.post("/me/applications/:id/withdraw", async (req, res) => {
  if (!objectId(req.params.id)) return res.status(400).json({ message: "Mã đơn không hợp lệ." });
  const application = await MembershipApplicationModel.findOneAndUpdate(
    { _id: req.params.id, applicantUserId: req.user!.id, status: "pending" },
    { $set: { status: "withdrawn", decidedAt: new Date() } }, { returnDocument: "after" },
  ).lean();
  return application ? res.json({ data: application }) : res.status(409).json({ message: "Đơn không còn ở trạng thái chờ." });
});

chapterRouter.get("/admin/applications", async (req, res) => {
  const code = chapterAdmin(req, res);
  if (!code) return;
  const applications = await MembershipApplicationModel.find({ chapterCode: code, status: "pending" }).sort({ createdAt: 1 }).lean();
  const users = await UserModel.find({ _id: { $in: applications.map(application => application.applicantUserId) } })
    .select("displayName email phone companyName industry photoURL").lean();
  const byId = new Map(users.map(user => [String(user._id), user]));
  return res.json({ data: applications.map(application => ({
    ...application,
    profileSnapshot: byId.has(String(application.applicantUserId))
      ? { ...application.profileSnapshot, ...byId.get(String(application.applicantUserId)) }
      : application.profileSnapshot,
  })) });
});

chapterRouter.post("/admin/applications/:id/decision", async (req, res) => {
  const code = chapterAdmin(req, res);
  if (!code) return;
  if (!objectId(req.params.id)) return res.status(400).json({ message: "Mã đơn không hợp lệ." });
  const { error } = Joi.object({
    decision: Joi.string().valid("approved", "rejected").required(),
    chapterCode: Joi.string().trim().uppercase().optional(),
  }).unknown(true).validate(req.body);
  if (error) return res.status(400).json({ message: validationMessage(error) });
  try {
    if (req.body.decision === "rejected") {
      const application = await MembershipApplicationModel.findOneAndUpdate(
        { _id: req.params.id, chapterCode: code, status: "pending" },
        { $set: { status: "rejected", decidedAt: new Date(), decidedBy: req.user!.id } },
        { returnDocument: "after" },
      ).lean();
      return application ? res.json({ data: application }) : res.status(409).json({ message: "Đơn đã được xử lý." });
    }
    const approved = await runInTransaction(async session => {
        const chapter = await CompanyModel.findOne({ code, isBniChapter: true, lifecycleStatus: { $in: ["active", null] } }).select("_id").session(session || null);
        if (!chapter) throw new Error("Chapter không còn hoạt động.");
        const application = await MembershipApplicationModel.findOneAndUpdate(
          { _id: req.params.id, chapterCode: code, status: "pending" },
          { $set: { status: "approved", decidedAt: new Date(), decidedBy: req.user!.id } },
          { session, returnDocument: "after" },
        );
        if (!application) throw new Error("Đơn đã được xử lý.");
        const joined = await UserModel.findOneAndUpdate(
          { _id: application.applicantUserId, $or: [{ companyCode: { $exists: false } }, { companyCode: null }, { companyCode: "" }] },
          { $set: { companyCode: code, membershipStatus: "active", role: "user" } },
          { session, returnDocument: "after" },
        );
        if (!joined) {
          if (!session) await MembershipApplicationModel.updateOne(
            { _id: application._id, status: "approved", decidedBy: req.user!.id },
            { $set: { status: "superseded", decisionReason: "Đã được chapter khác tiếp nhận." } },
          );
          throw new Error("Người này đã là thành viên của chapter khác.");
        }
        await MembershipApplicationModel.updateMany(
          { applicantUserId: application.applicantUserId, _id: { $ne: application._id }, status: "pending" },
          { $set: { status: "superseded", decidedAt: new Date(), decisionReason: "Đã được chapter khác tiếp nhận." } },
          { session },
        );
        return application.toObject();
    });
    disconnectUserSockets(String((approved as { applicantUserId: unknown }).applicantUserId));
    try {
      const chapter = await CompanyModel.findOne({ code }).select("name").lean();
      await notificationService.createNotification({
        companyCode: code,
        recipientUid: String(approved.applicantUserId),
        idempotencyKey: `chapter-application:${approved._id}:approved`,
        title: "Đơn gia nhập Chapter đã được duyệt",
        body: `Bạn đã được gia nhập Chapter ${chapter?.name || code}.`,
        type: "he-thong",
        action: { tab: "CHAPTER", kind: "chapter_approved", applicationId: String(approved._id) },
      }, { showDetailsInPush: true, route: "/notifications" });
    } catch (notificationError) {
      if ((notificationError as { code?: number }).code !== 11000) console.error("[chapter-approval-notification]", notificationError);
    }
    return res.json({ data: approved });
  } catch (e) { return fail(res, e); }
});

chapterRouter.get("/me/leave-requests", async (req, res) => {
  const data = await ChapterLeaveRequestModel.find({ userId: req.user!.id }).sort({ createdAt: -1 }).lean();
  return res.json({ data });
});

chapterRouter.post("/me/leave-requests", async (req, res) => {
  if (!req.user?.companyCode || req.user.role === "admin" || req.user.role === "superadmin") {
    return res.status(409).json({ message: "Tài khoản chưa thể gửi yêu cầu rời chapter." });
  }
  const { error, value } = Joi.object({ reason: Joi.string().trim().max(1000).allow("").default("") }).unknown(false).validate(req.body);
  if (error) return res.status(400).json({ message: validationMessage(error) });
  try {
    const request = await ChapterLeaveRequestModel.create({ userId: req.user.id, chapterCode: req.user.companyCode, reason: value.reason });
    return res.status(201).json({ data: request });
  } catch (e) { return fail(res, e); }
});

chapterRouter.post("/me/leave-requests/:id/withdraw", async (req, res) => {
  if (!objectId(req.params.id)) return res.status(400).json({ message: "Mã yêu cầu không hợp lệ." });
  const request = await ChapterLeaveRequestModel.findOneAndUpdate(
    { _id: req.params.id, userId: req.user!.id, status: "pending" },
    { $set: { status: "withdrawn", decidedAt: new Date() } }, { returnDocument: "after" },
  ).lean();
  return request ? res.json({ data: request }) : res.status(409).json({ message: "Yêu cầu không còn ở trạng thái chờ." });
});

chapterRouter.get("/admin/leave-requests", async (req, res) => {
  const code = chapterAdmin(req, res);
  if (!code) return;
  const data = await ChapterLeaveRequestModel.find({ chapterCode: code, status: "pending" }).populate("userId", "displayName email").sort({ createdAt: 1 }).lean();
  return res.json({ data });
});

chapterRouter.post("/admin/leave-requests/:id/decision", async (req, res) => {
  const code = chapterAdmin(req, res);
  if (!code) return;
  if (!objectId(req.params.id)) return res.status(400).json({ message: "Mã yêu cầu không hợp lệ." });
  const { error } = Joi.object({
    decision: Joi.string().valid("approved").required(),
    chapterCode: Joi.string().trim().uppercase().optional(),
  }).unknown(true).validate(req.body);
  if (error) return res.status(400).json({ message: validationMessage(error) });
  try {
    const approved = await runInTransaction(async session => {
        const request = await ChapterLeaveRequestModel.findOneAndUpdate(
          { _id: req.params.id, chapterCode: code, status: "pending" },
          { $set: { status: "approved", decidedAt: new Date(), decidedBy: req.user!.id } },
          { session, returnDocument: "after" },
        );
        if (!request) throw new Error("Yêu cầu đã được xử lý.");
        const user = await UserModel.findOneAndUpdate(
          { _id: request.userId, companyCode: code, role: { $ne: "admin" } },
          { $set: { membershipStatus: "none", role: "user", permissions: [] }, $unset: { companyCode: "", branchId: "", parentId: "" } },
          { session, returnDocument: "after" },
        );
        if (!user) {
          if (!session) await ChapterLeaveRequestModel.updateOne(
            { _id: request._id, status: "approved", decidedBy: req.user!.id },
            { $set: { status: "rejected", decisionReason: "Người dùng không còn thuộc chapter này." } },
          );
          throw new Error("Người dùng không còn thuộc chapter này.");
        }
        return request.toObject();
    });
    disconnectUserSockets(String((approved as { userId: unknown }).userId));
    return res.json({ data: approved });
  } catch (e) { return fail(res, e); }
});
