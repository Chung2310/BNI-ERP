/**
 * Helper tự động đính kèm companyCode vào bộ lọc truy vấn dữ liệu (Mongoose filter)
 * giúp cô lập tài nguyên giữa các công ty một cách an toàn.
 *
 * @param filter Bộ lọc truy vấn ban đầu
 * @param user Thông tin người dùng hiện tại từ token
 */
export function applyCompanyFilter(
  filter: any = {},
  user?: { role: string; companyCode?: string }
): any {
  if (!user) {
    return filter;
  }

  return {
    ...filter,
    companyCode: user.companyCode,
  };
}
