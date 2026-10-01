import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { CompanyModel } from "../model/company.model";
import { TimekeepingLogModel } from "../model/timekeeping.model";
import { UserModel } from "../model/user.model";
import { toVietnamDate } from "../service/active-attendance-log.service";
import { attendanceResourceService } from "../service/attendance-resource.service";

function vietnamWorkDate(date: Date = new Date()): string {
  return toVietnamDate(date);
}

async function indexAttendanceEvidence(req: AuthenticatedRequest, log: any, action: "check-in" | "check-out") {
  const evidence = (req as any).attendanceEvidence;
  if (!evidence) return;
  await attendanceResourceService.indexAcceptedEvidence({
    companyCode: req.user?.companyCode || "SYSTEM",
    userId: req.user?.id || "",
    userLabel: req.user?.email || req.user?.id || "Nhân viên",
    recordId: String(log._id),
    action,
    mimeType: (req as any).file?.mimetype || "image/jpeg",
    evidence,
  });
}

// Haversine formula to compute distance in meters
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Helper to calculate attendance status based on check-in/out times and limits
function calculateAttendanceStatus(
  checkInTime: Date,
  checkOutTime: Date | null,
  config: {
    checkInLimit?: string;
    checkOutLimit?: string;
    lunchBreakStart?: string;
    lunchBreakEnd?: string;
  }
): string {
  const parseTimeToMinutes = (timeStr?: string, defaultVal: number = 0): number => {
    if (!timeStr) return defaultVal;
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  const T_in_limit = parseTimeToMinutes(config.checkInLimit, 8 * 60 + 30); // default 08:30
  const T_out_limit = parseTimeToMinutes(config.checkOutLimit, 17 * 60 + 30); // default 17:30
  const T_lunch_start = parseTimeToMinutes(config.lunchBreakStart, 12 * 60); // default 12:00
  const T_lunch_end = parseTimeToMinutes(config.lunchBreakEnd, 13 * 60); // default 13:00

  const getLocalMinutes = (date: Date): number => {
    const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localTime.getUTCHours() * 60 + localTime.getUTCMinutes();
  };

  const m_in = getLocalMinutes(checkInTime);

  if (!checkOutTime) {
    if (m_in >= T_lunch_start) {
      return "Half-Day";
    }
    if (m_in > T_in_limit) {
      return "Late";
    }
    return "Present";
  }

  const m_out = getLocalMinutes(checkOutTime);

  const onlyMorning = m_out <= T_lunch_end;
  const onlyAfternoon = m_in >= T_lunch_start;

  if (onlyMorning || onlyAfternoon) {
    return "Half-Day";
  }

  const isLate = m_in > T_in_limit;
  const isEarly = m_out < T_out_limit;

  if (isLate && isEarly) {
    return "Late-Left-Early";
  }
  if (isLate) {
    return "Late";
  }
  if (isEarly) {
    return "Left-Early";
  }
  return "Present";
}

export const timekeepingController = {
  /**
   * GET /api/v1/timekeeping/today
   */
  async getTodayStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const uid = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const todayStr = vietnamWorkDate();

      if (!uid) {
        return res.status(401).json({
          status: "error",
          message: "Không xác định được danh tính nhân sự.",
        });
      }

      const log = await TimekeepingLogModel.findOne({ uid, companyCode, date: todayStr }).sort({ date: -1 }).lean();
      const company = await CompanyModel.findOne({ code: companyCode }).select("locationConfig").lean();
      const workingDays = company?.locationConfig?.workingDays || [1, 2, 3, 4, 5];
      const todayDayOfWeek = new Date().getDay();
      const isWorkingDay = workingDays.includes(todayDayOfWeek);

      return res.status(200).json({
        status: "success",
        data: {
          log: log || null,
          workCalendar: {
            date: todayStr,
            isWorkingDay,
            label: isWorkingDay ? "Ngày làm việc" : "Ngày nghỉ",
          },
        },
      });
    } catch (error: any) {
      console.error("[timekeepingController.getTodayStatus] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi lấy trạng thái chấm công hôm nay.",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/timekeeping/check-in
   */
  async checkIn(req: AuthenticatedRequest, res: Response) {
    try {
      const uid = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const { latitude, longitude, deviceInfo } = req.body;

      if (!uid) {
        return res.status(401).json({
          status: "error",
          message: "Không xác định được danh tính nhân sự.",
        });
      }

      const company = await CompanyModel.findOne({ code: companyCode }).lean();
      const config = {
        latitude: 10.7769,
        longitude: 106.7009,
        allowedRadius: 1000,
        checkInLimit: "08:30",
        checkOutLimit: "17:30",
        lunchBreakStart: "12:00",
        lunchBreakEnd: "13:00",
        ...(company?.locationConfig || {}),
      };

      const lat = Number(latitude);
      const lon = Number(longitude);
      const distance = calculateHaversineDistance(lat, lon, config.latitude, config.longitude);
      const maxRadius = config.allowedRadius || 1000;

      if (distance > maxRadius) {
        return res.status(400).json({
          status: "error",
          reasonCode: "outside_radius",
          message: `Bạn đang ở ngoài khu vực chấm công của công ty (${Math.round(distance)}m > ${maxRadius}m).`,
        });
      }

      const todayStr = vietnamWorkDate();
      const ipAddress = req.ip || (req.headers["x-forwarded-for"] as string) || "";

      let log = await TimekeepingLogModel.findOne({ uid, companyCode, date: todayStr });
      if (log && log.checkIn) {
        return res.status(400).json({
          status: "error",
          message: "Bạn đã thực hiện check-in hôm nay rồi.",
        });
      }

      const now = new Date();
      const me = await UserModel.findById(uid).select("workHoursConfig").lean();
      const custom = me?.workHoursConfig?.useCustom ? me.workHoursConfig : undefined;
      const status = calculateAttendanceStatus(now, null, {
        checkInLimit: custom?.checkInLimit || config.checkInLimit,
        checkOutLimit: custom?.checkOutLimit || config.checkOutLimit,
        lunchBreakStart: custom?.lunchBreakStart || config.lunchBreakStart,
        lunchBreakEnd: custom?.lunchBreakEnd || config.lunchBreakEnd,
      }) as any;

      const checkInDetail = {
        time: now,
        latitude: lat,
        longitude: lon,
        distance,
        deviceInfo: deviceInfo || "",
        ipAddress,
      };

      if (!log) {
        log = new TimekeepingLogModel({
          uid,
          companyCode,
          date: todayStr,
          checkIn: checkInDetail,
          status,
          workDate: todayStr,
        });
      } else {
        log.checkIn = checkInDetail;
        log.status = status;
      }

      await log.save();
      await indexAttendanceEvidence(req, log, "check-in");

      return res.status(200).json({
        status: "success",
        message: "Chấm công vào (Check-in) thành công!",
        data: log,
      });
    } catch (error: any) {
      console.error("[timekeepingController.checkIn] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi check-in.",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/timekeeping/check-out
   */
  async checkOut(req: AuthenticatedRequest, res: Response) {
    try {
      const uid = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const { latitude, longitude, deviceInfo } = req.body;

      if (!uid) {
        return res.status(401).json({
          status: "error",
          message: "Không xác định được danh tính nhân sự.",
        });
      }

      const company = await CompanyModel.findOne({ code: companyCode }).lean();
      const config = {
        latitude: 10.7769,
        longitude: 106.7009,
        allowedRadius: 1000,
        checkInLimit: "08:30",
        checkOutLimit: "17:30",
        lunchBreakStart: "12:00",
        lunchBreakEnd: "13:00",
        ...(company?.locationConfig || {}),
      };

      const lat = Number(latitude);
      const lon = Number(longitude);
      const distance = calculateHaversineDistance(lat, lon, config.latitude, config.longitude);
      const maxRadius = config.allowedRadius || 1000;

      if (distance > maxRadius) {
        return res.status(400).json({
          status: "error",
          reasonCode: "outside_radius",
          message: `Bạn đang ở ngoài khu vực chấm công của công ty (${Math.round(distance)}m > ${maxRadius}m).`,
        });
      }

      const todayStr = vietnamWorkDate();
      const ipAddress = req.ip || (req.headers["x-forwarded-for"] as string) || "";

      const log = await TimekeepingLogModel.findOne({ uid, companyCode, date: todayStr, checkIn: { $ne: null } });
      if (!log || !log.checkIn) {
        return res.status(400).json({
          status: "error",
          message: "Bạn chưa thực hiện Check-in hôm nay. Không thể Check-out.",
        });
      }

      if (log.checkOut) {
        return res.status(400).json({
          status: "error",
          message: "Bạn đã thực hiện check-out hôm nay rồi.",
        });
      }

      const checkOutTime = new Date();
      log.checkOut = {
        time: checkOutTime,
        latitude: lat,
        longitude: lon,
        distance,
        deviceInfo: deviceInfo || "",
        ipAddress,
      };

      const me = await UserModel.findById(uid).select("workHoursConfig").lean();
      const custom = me?.workHoursConfig?.useCustom ? me.workHoursConfig : undefined;
      log.status = calculateAttendanceStatus(log.checkIn.time, checkOutTime, {
        checkInLimit: custom?.checkInLimit || config.checkInLimit,
        checkOutLimit: custom?.checkOutLimit || config.checkOutLimit,
        lunchBreakStart: custom?.lunchBreakStart || config.lunchBreakStart,
        lunchBreakEnd: custom?.lunchBreakEnd || config.lunchBreakEnd,
      }) as any;

      await log.save();
      await indexAttendanceEvidence(req, log, "check-out");

      return res.status(200).json({
        status: "success",
        message: "Chấm công ra (Check-out) thành công!",
        data: log,
      });
    } catch (error: any) {
      console.error("[timekeepingController.checkOut] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi check-out.",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/timekeeping/company-location
   */
  async getCompanyLocation(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = req.user?.companyCode || "SYSTEM";
      const company = await CompanyModel.findOne({ code: companyCode }).lean();

      const fallbackConfig = {
        latitude: 10.7769,
        longitude: 106.7009,
        allowedRadius: 1000,
        addressName: "Tòa nhà Bitexco",
        checkInLimit: "08:30",
        checkOutLimit: "17:30",
        lunchBreakStart: "12:00",
        lunchBreakEnd: "13:00",
        workingDays: [1, 2, 3, 4, 5],
      };

      return res.status(200).json({
        status: "success",
        data: { ...fallbackConfig, ...(company?.locationConfig || {}), annualLeaveDays: company?.annualLeaveDays ?? 12 },
      });
    } catch (error: any) {
      console.error("[timekeepingController.getCompanyLocation] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi lấy vị trí công ty.",
        details: error.message,
      });
    }
  },

  /**
   * PATCH /api/v1/timekeeping/company-location
   */
  async updateCompanyLocation(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = req.user?.companyCode || "SYSTEM";

      const { latitude, longitude, allowedRadius, addressName, checkInLimit, checkOutLimit, lunchBreakStart, lunchBreakEnd, workingDays, annualLeaveDays } = req.body;

      const updatedCompany = await CompanyModel.findOneAndUpdate(
        { code: companyCode },
        {
          $set: {
            annualLeaveDays: Number.isInteger(annualLeaveDays) ? annualLeaveDays : 12,
            locationConfig: {
              latitude,
              longitude,
              allowedRadius,
              addressName: addressName || "",
              checkInLimit: checkInLimit || "08:30",
              checkOutLimit: checkOutLimit || "17:30",
              lunchBreakStart: lunchBreakStart || "12:00",
              lunchBreakEnd: lunchBreakEnd || "13:00",
              workingDays: workingDays || [1, 2, 3, 4, 5],
            },
          },
        },
        { returnDocument: 'after' }
      ).lean();

      if (!updatedCompany) {
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy thông tin doanh nghiệp cần cập nhật.",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Cập nhật tọa độ chấm công doanh nghiệp thành công!",
        data: updatedCompany.locationConfig,
      });
    } catch (error: any) {
      console.error("[timekeepingController.updateCompanyLocation] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi cập nhật vị trí công ty.",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/timekeeping/work-hours
   */
  async listEmployeeWorkHours(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = req.user?.companyCode || "SYSTEM";

      const users = await UserModel.find({ companyCode })
        .select("_id fullName email role employmentStatus officialDate workHoursConfig")
        .lean();

      return res.status(200).json({ status: "success", data: users });
    } catch (error: any) {
      console.error("[timekeepingController.listEmployeeWorkHours] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi lấy giờ làm việc nhân viên.",
        details: error.message,
      });
    }
  },

  /**
   * PATCH /api/v1/timekeeping/work-hours/:uid
   */
  async updateEmployeeWorkHours(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = req.user?.companyCode || "SYSTEM";

      const { uid } = req.params;
      const { useCustom, checkInLimit, checkOutLimit, lunchBreakStart, lunchBreakEnd, workingDays, annualLeaveDays, employmentStatus, officialDate } = req.body;

      const updatedUser = await UserModel.findOneAndUpdate(
        { _id: uid, companyCode },
        {
          $set: {
            workHoursConfig: {
              useCustom: !!useCustom,
              checkInLimit: checkInLimit || "08:30",
              checkOutLimit: checkOutLimit || "17:30",
              lunchBreakStart: lunchBreakStart || "12:00",
              lunchBreakEnd: lunchBreakEnd || "13:00",
              workingDays: workingDays || [1, 2, 3, 4, 5],
              annualLeaveDays: Number.isInteger(annualLeaveDays) ? annualLeaveDays : undefined,
              employmentStatus: employmentStatus || "official",
              officialDate: officialDate || undefined,
            },
          },
        },
        { returnDocument: 'after' }
      )
        .select("_id fullName email role employmentStatus officialDate workHoursConfig")
        .lean();

      if (!updatedUser) {
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy nhân viên cần cập nhật.",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Cập nhật giờ làm việc nhân viên thành công!",
        data: updatedUser,
      });
    } catch (error: any) {
      console.error("[timekeepingController.updateEmployeeWorkHours] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi cập nhật giờ làm việc nhân viên.",
        details: error.message,
      });
    }
  },
};
