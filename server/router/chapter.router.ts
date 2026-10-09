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

export const chapterRouter = Router();

function fail(res: import("express").Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Không thể xử lý yêu cầu.";
  const duplicate = (error as { code?: number })?.code === 11000;
  return res.status(duplicate ? 409 : 400).json({ status: "error", message: duplicate ? "Yêu cầu đã tồn tại." : message });
}

function chapterAdmin(req: import("express").Request, res: import("express").Response): string | null {
  if (req.user?.role !== "admin" || !req.user.companyCode) {
    res.status(403).json({ status: "error", message: "Chỉ admin chapter được xử lý yêu cầu này." });
    return null;
  }
  return req.user.companyCode;
}

function objectId(id: string) { return mongoose.isValidObjectId(id); }

// The public directory exposes only chapter metadata, never its member roster.
chapterRouter.get("/", async (_req, res) => {
  const chapters = await CompanyModel.find({ isBniChapter: true, lifecycleStatus: { $in: ["active", null] }, acceptsApplications: { $ne: false } })
    .select("code name chapterRegion chapterAddress")
    .sort({ name: 1 }).lean();
  res.json({ data: chapters });
});

chapterRouter.use(requireAuth);

chapterRouter.get("/manage", async (req, res) => {
  if (req.user?.role !== "superadmin") return res.status(403).json({ message: "Chỉ superadmin được quản lý chapter." });
  const chapters = await CompanyModel.find({ isBniChapter: true }).select("code name chapterRegion chapterAddress acceptsApplications lifecycleStatus ownerEmail").sort({ name: 1 }).lean();
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

const createChapterSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]{2,32}$/).required(),
  name: Joi.string().trim().min(2).max(150).required(),
  region: Joi.string().trim().max(120).allow("").default(""),
  address: Joi.string().trim().max(255).allow("").default(""),
  adminName: Joi.string().trim().min(2).max(120).required(),
  adminEmail: Joi.string().email().max(254).required(),
  adminPassword: Joi.string().min(8).max(128).required(),
}).unknown(false);

chapterRouter.post("/manage", async (req, res) => {
  if (req.user?.role !== "superadmin") return res.status(403).json({ message: "Chỉ superadmin được tạo chapter." });
  const { error, value } = createChapterSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
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
  if (error) return res.status(400).json({ message: error.message });
  const chapter = await CompanyModel.findOneAndUpdate(
    { code: req.params.code.toUpperCase() }, { $set: value }, { returnDocument: "after", runValidators: true },
  ).select("code name chapterRegion chapterAddress acceptsApplications lifecycleStatus").lean();
  return chapter ? res.json({ data: chapter }) : res.status(404).json({ message: "Không tìm thấy chapter." });
});

chapterRouter.get("/me/applications", async (req, res) => {
  const data = await MembershipApplicationModel.find({ applicantUserId: req.user!.id }).sort({ createdAt: -1 }).lean();
  return res.json({ data });
});

chapterRouter.post("/me/applications", async (req, res) => {
  const { error, value } = Joi.object({
    chapterCode: Joi.string().trim().uppercase().required(),
  }).unknown(false).validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
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
  if (error) return res.status(400).json({ message: error.message });
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
    decision: Joi.string().valid("approved").required(),
  }).unknown(false).validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try {
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
  if (error) return res.status(400).json({ message: error.message });
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
  }).unknown(false).validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
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
