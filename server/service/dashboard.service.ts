import mongoose from "mongoose";
import { TimekeepingLogModel } from "../model/timekeeping.model";
import { UserModel } from "../model/user.model";
import { ChatRoomModel } from "../model/chat-room.model";
import { ChatMessageModel } from "../model/chat-message.model";
import { ResourceItemModel } from "../model/resource-item.model";
import { resolveDashboardModuleAccess } from "./dashboard-module-access";
import { HRLeaveApplicationModel } from "../model/hr-leave-application.model";

export interface DashboardUser {
  id: string;
  role: string;
  companyCode?: string;
  branchId?: string;
  enabledModules?: string[];
  permissions?: Set<string>;
}

export interface DashboardRange {
  start: Date;
  end: Date;
  filter: string;
}

function buildCompanyQuery(user: DashboardUser): Record<string, any> {
  return { companyCode: user.companyCode };
}

function getLocalDateString(): string {
  const localOffset = new Date().getTimezoneOffset() * 60000;
  return new Date(Date.now() - localOffset).toISOString().slice(0, 10);
}

async function getTimekeepingStats(user: DashboardUser) {
  const todayStr = getLocalDateString();
  const tkQ = user.companyCode ? { companyCode: user.companyCode } : {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  const [checkedInToday, lateToday, totalEmployees, onApprovedLeaveToday] = await Promise.all([
    TimekeepingLogModel.countDocuments({ ...tkQ, date: todayStr, checkIn: { $ne: null } }),
    TimekeepingLogModel.countDocuments({ ...tkQ, date: todayStr, status: "Late" }),
    UserModel.countDocuments(tkQ),
    HRLeaveApplicationModel.countDocuments({
      ...tkQ,
      status: "approved",
      startDate: { $lte: endOfToday },
      endDate: { $gte: today },
    }),
  ]);

  const absentWithoutLeave = Math.max(0, totalEmployees - checkedInToday - onApprovedLeaveToday);

  return { checkedInToday, lateToday, totalEmployees, onApprovedLeaveToday, absentWithoutLeave, date: todayStr };
}

async function getChatStats(user: DashboardUser) {
  const userObjectId = new mongoose.Types.ObjectId(user.id);
  const rooms = await ChatRoomModel.find({
    ...(user.companyCode ? { companyCode: user.companyCode } : {}),
    "members.userId": userObjectId,
  })
    .select("_id")
    .lean();

  const unreadMessages = rooms.length
    ? await ChatMessageModel.countDocuments({
        roomId: { $in: rooms.map((r) => r._id) },
        senderId: { $ne: userObjectId },
        readBy: { $ne: userObjectId },
        isDeleted: false,
      })
    : 0;

  return { unreadMessages, roomCount: rooms.length };
}

async function getResourceStats(companyQ: Record<string, any>, range: DashboardRange) {
  const [fileCount, recentUploads, sizeAgg] = await Promise.all([
    ResourceItemModel.countDocuments({ ...companyQ, type: "file" }),
    ResourceItemModel.countDocuments({
      ...companyQ,
      type: "file",
      createdAt: { $gte: range.start, $lte: range.end },
    }),
    ResourceItemModel.aggregate([
      { $match: { ...companyQ, type: "file" } },
      { $group: { _id: null, totalSize: { $sum: "$size" } } },
    ]),
  ]);

  return { fileCount, recentUploads, totalSize: sizeAgg[0]?.totalSize || 0 };
}

const isManagerOrAbove = (role: string) => role === "admin" || role === "manager";

async function getActionItems(user: DashboardUser) {
  const companyQ = buildCompanyQuery(user);
  const access = resolveDashboardModuleAccess(user);
  const manages = isManagerOrAbove(user.role);

  const pendingApprovalsRaw = access.hr && manages
    ? await HRLeaveApplicationModel.find({ ...companyQ, status: "pending" })
        .select("_id employeeName createdAt")
        .sort({ createdAt: 1 })
        .limit(5)
        .lean()
    : [];

  return {
    overdueTasks: [],
    pendingApprovals: pendingApprovalsRaw.map((a: any) => ({
      id: String(a._id),
      type: "leave" as const,
      employeeName: a.employeeName,
      since: a.createdAt,
    })),
    lowStockAlerts: [],
  };
}

export const dashboardService = {
  getActionItems,
  async getSummary(user: DashboardUser, range: DashboardRange) {
    const companyQ = buildCompanyQuery(user);
    const access = resolveDashboardModuleAccess(user);

    const [timekeeping, chat, resources] = await Promise.all([
      access.timekeeping
        ? getTimekeepingStats(user)
        : Promise.resolve({ checkedInToday: 0, lateToday: 0, totalEmployees: 0, onApprovedLeaveToday: 0, absentWithoutLeave: 0, date: getLocalDateString() }),
      access.chat ? getChatStats(user) : Promise.resolve({ unreadMessages: 0, roomCount: 0 }),
      access.resource ? getResourceStats(companyQ, range) : Promise.resolve({ fileCount: 0, recentUploads: 0, totalSize: 0 }),
    ]);

    return {
      range: { start: range.start, end: range.end, filter: range.filter },
      projects: { activeProjects: 0, tasks: { todo: 0, doing: 0, done: 0, total: 0 }, overdueTasks: 0 },
      students: { totalStudents: 0, newStudents: 0, tuitionRevenue: 0, paymentCount: 0, outstandingDebt: 0, activeCourses: 0, activeBatches: 0, unpaidStudentCount: 0 },
      batches: { activeCount: 0, openingTodayCount: 0, missingInstructorCount: 0, endingSoonCount: 0, frequentAbsentStudents: 0 },
      timekeeping,
      chat,
      resources,
      training: { totalCourses: 0, ongoingCourses: 0, enrollments: { notStarted: 0, inProgress: 0, completed: 0, total: 0 } },
      receivables: { overdueAmount: 0, dueTodayAmount: 0, collectedTodayAmount: 0 },
      instructors: { onLeaveToday: 0 },
    };
  },
};
