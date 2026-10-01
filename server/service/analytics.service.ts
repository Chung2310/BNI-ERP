export interface AnalyticsScope {
  companyCode?: string;
  branchId?: string;
}

export type RevenueGranularity = "day" | "week" | "month";

export interface RevenueRange {
  from: Date;
  to: Date;
  granularity: RevenueGranularity;
}

export interface RevenueBucket {
  bucket: string;
  amount: number;
  count: number;
  tuitionAmount: number;
  tuitionCount: number;
  goodsAmount: number;
  goodsCount: number;
}

export interface RevenueSourceStatus {
  key: "tuition" | "goods";
  label: string;
  available: boolean;
  blockedReason?: string;
  excludedRecords?: number;
}

export const analyticsService = {
  async getTuitionRevenue(_scope: AnalyticsScope, range: RevenueRange) {
    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), granularity: range.granularity },
      series: [] as RevenueBucket[],
      total: 0,
      count: 0,
      previousPeriodTotal: 0,
      growthRate: 0,
      excludedCount: 0,
      currency: "VND",
    };
  },

  async getGoodsRevenue(_scope: AnalyticsScope, range: RevenueRange) {
    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), granularity: range.granularity },
      series: [] as RevenueBucket[],
      total: 0,
      count: 0,
      grossProfit: 0,
      previousPeriodTotal: 0,
      growthRate: 0,
      byCategory: [],
      excludedCostLines: 0,
      currency: "VND",
    };
  },

  async getCombinedRevenue(_scope: AnalyticsScope, range: RevenueRange) {
    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), granularity: range.granularity },
      series: [] as RevenueBucket[],
      total: 0,
      count: 0,
      tuitionTotal: 0,
      tuitionCount: 0,
      goodsTotal: 0,
      goodsCount: 0,
      goodsGrossProfit: 0,
      previousPeriodTotal: 0,
      growthRate: 0,
      excludedCostLines: 0,
      currency: "VND",
    };
  },

  async getReceivables(_scope: AnalyticsScope, asOf: Date) {
    const order = ["notScheduled", "notDue", "0-30", "31-60", "60+"];
    const aging = order.map((bucket) => ({ bucket, amount: 0, count: 0 }));
    return {
      asOf: asOf.toISOString(),
      total: 0,
      count: 0,
      aging,
      agingBasis: "dueAt",
      currency: "VND",
    };
  },

  async getExpenses(_scope: AnalyticsScope, range: RevenueRange) {
    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      total: 0,
      payroll: { amount: 0, count: 0 },
      commission: { amount: 0, count: 0 },
      operating: { amount: 0, count: 0 },
      operatingByCategory: [],
      excludedCommissionRecords: 0,
      currency: "VND",
    };
  },

  async getProfitAndLoss(scope: AnalyticsScope, range: RevenueRange) {
    const expenses = await this.getExpenses(scope, range);
    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), granularity: range.granularity },
      revenue: 0,
      tuitionRevenue: 0,
      goodsRevenue: 0,
      goodsGrossProfit: 0,
      payrollExpense: 0,
      commissionExpense: 0,
      generalOperatingExpense: 0,
      totalOperatingExpenses: expenses.total,
      operatingResult: -expenses.total,
      excludedCostLines: 0,
      excludedCommissionRecords: 0,
      currency: "VND",
    };
  },

  async getMeta(_scope: AnalyticsScope) {
    return {
      sources: [] as RevenueSourceStatus[],
      grossProfitAvailable: false,
      currency: "VND",
      filters: {
        branches: [],
        courses: [],
      },
    };
  },
};
