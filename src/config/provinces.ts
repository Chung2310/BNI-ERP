/**
 * Danh sách 34 đơn vị hành chính cấp tỉnh của Việt Nam
 * (gồm 28 tỉnh và 6 thành phố trực thuộc Trung ương sau khi sắp xếp, hợp nhất)
 */

export interface VietnamProvinceItem {
  id: string;
  name: string;
  shortName: string;
  type: "city" | "province";
  note?: string;
}

export const VIETNAM_PROVINCES: readonly VietnamProvinceItem[] = [
  // 6 Thành phố trực thuộc Trung ương
  { id: "HN", name: "Thành phố Hà Nội", shortName: "Hà Nội", type: "city", note: "Không thay đổi" },
  { id: "HUE", name: "Thành phố Huế", shortName: "Huế", type: "city", note: "Trước đây là tỉnh Thừa Thiên Huế" },
  { id: "HP", name: "Thành phố Hải Phòng", shortName: "Hải Phòng", type: "city", note: "Hợp nhất Hải Phòng + Hải Dương; trung tâm tại Hải Phòng" },
  { id: "DN", name: "Thành phố Đà Nẵng", shortName: "Đà Nẵng", type: "city", note: "Hợp nhất Đà Nẵng + Quảng Nam; trung tâm tại Đà Nẵng" },
  { id: "HCM", name: "Thành phố Hồ Chí Minh", shortName: "Hồ Chí Minh", type: "city", note: "Hợp nhất TP.HCM + Bà Rịa – Vũng Tàu + Bình Dương; trung tâm tại TP.HCM" },
  { id: "CT", name: "Thành phố Cần Thơ", shortName: "Cần Thơ", type: "city", note: "Hợp nhất Cần Thơ + Sóc Trăng + Hậu Giang; trung tâm tại Cần Thơ" },

  // 11 Tỉnh không thay đổi
  { id: "LC", name: "Tỉnh Lai Châu", shortName: "Lai Châu", type: "province", note: "Không thay đổi" },
  { id: "DB", name: "Tỉnh Điện Biên", shortName: "Điện Biên", type: "province", note: "Không thay đổi" },
  { id: "SL", name: "Tỉnh Sơn La", shortName: "Sơn La", type: "province", note: "Không thay đổi" },
  { id: "LS", name: "Tỉnh Lạng Sơn", shortName: "Lạng Sơn", type: "province", note: "Không thay đổi" },
  { id: "QN", name: "Tỉnh Quảng Ninh", shortName: "Quảng Ninh", type: "province", note: "Không thay đổi" },
  { id: "TH", name: "Tỉnh Thanh Hóa", shortName: "Thanh Hóa", type: "province", note: "Không thay đổi" },
  { id: "NA", name: "Tỉnh Nghệ An", shortName: "Nghệ An", type: "province", note: "Không thay đổi" },
  { id: "HT", name: "Tỉnh Hà Tĩnh", shortName: "Hà Tĩnh", type: "province", note: "Không thay đổi" },
  { id: "CB", name: "Tỉnh Cao Bằng", shortName: "Cao Bằng", type: "province", note: "Không thay đổi" },

  // Các tỉnh mới hình thành sau sắp xếp, sáp nhập
  { id: "TQ", name: "Tỉnh Tuyên Quang", shortName: "Tuyên Quang", type: "province", note: "Hợp nhất tỉnh Tuyên Quang + tỉnh Hà Giang; trung tâm tại Tuyên Quang" },
  { id: "LCA", name: "Tỉnh Lào Cai", shortName: "Lào Cai", type: "province", note: "Hợp nhất tỉnh Lào Cai + tỉnh Yên Bái; trung tâm tại Yên Bái" },
  { id: "TN", name: "Tỉnh Thái Nguyên", shortName: "Thái Nguyên", type: "province", note: "Hợp nhất tỉnh Bắc Kạn + tỉnh Thái Nguyên; trung tâm tại Thái Nguyên" },
  { id: "PT", name: "Tỉnh Phú Thọ", shortName: "Phú Thọ", type: "province", note: "Hợp nhất tỉnh Vĩnh Phúc + Hòa Bình + Phú Thọ; trung tâm tại Phú Thọ" },
  { id: "BN", name: "Tỉnh Bắc Ninh", shortName: "Bắc Ninh", type: "province", note: "Hợp nhất tỉnh Bắc Ninh + Bắc Giang; trung tâm tại Bắc Giang" },
  { id: "HY", name: "Tỉnh Hưng Yên", shortName: "Hưng Yên", type: "province", note: "Hợp nhất tỉnh Hưng Yên + Thái Bình; trung tâm tại Hưng Yên" },
  { id: "NB", name: "Tỉnh Ninh Bình", shortName: "Ninh Bình", type: "province", note: "Hợp nhất Hà Nam + Nam Định + Ninh Bình; trung tâm tại Ninh Bình" },
  { id: "QT", name: "Tỉnh Quảng Trị", shortName: "Quảng Trị", type: "province", note: "Hợp nhất Quảng Bình + Quảng Trị; trung tâm tại Quảng Bình" },
  { id: "QNG", name: "Tỉnh Quảng Ngãi", shortName: "Quảng Ngãi", type: "province", note: "Hợp nhất Kon Tum + Quảng Ngãi; trung tâm tại Quảng Ngãi" },
  { id: "GL", name: "Tỉnh Gia Lai", shortName: "Gia Lai", type: "province", note: "Hợp nhất Bình Định + Gia Lai; trung tâm tại Gia Lai" },
  { id: "KH", name: "Tỉnh Khánh Hòa", shortName: "Khánh Hòa", type: "province", note: "Hợp nhất Ninh Thuận + Khánh Hòa; trung tâm tại Khánh Hòa" },
  { id: "LD", name: "Tỉnh Lâm Đồng", shortName: "Lâm Đồng", type: "province", note: "Hợp nhất Đắk Nông + Bình Thuận + Lâm Đồng; trung tâm tại Lâm Đồng" },
  { id: "DL", name: "Tỉnh Đắk Lắk", shortName: "Đắk Lắk", type: "province", note: "Hợp nhất Phú Yên + Đắk Lắk; trung tâm tại Đắk Lắk" },
  { id: "DNA", name: "Tỉnh Đồng Nai", shortName: "Đồng Nai", type: "province", note: "Hợp nhất Đồng Nai + Bình Phước; trung tâm tại Đồng Nai" },
  { id: "TN2", name: "Tỉnh Tây Ninh", shortName: "Tây Ninh", type: "province", note: "Hợp nhất Tây Ninh + Long An; trung tâm tại Tây Ninh" },
  { id: "VL", name: "Tỉnh Vĩnh Long", shortName: "Vĩnh Long", type: "province", note: "Hợp nhất Vĩnh Long + Bến Tre + Trà Vinh; trung tâm tại Vĩnh Long" },
  { id: "DT", name: "Tỉnh Đồng Tháp", shortName: "Đồng Tháp", type: "province", note: "Hợp nhất Đồng Tháp + Tiền Giang; trung tâm tại Đồng Tháp" },
  { id: "CM", name: "Tỉnh Cà Mau", shortName: "Cà Mau", type: "province", note: "Hợp nhất Cà Mau + Bạc Liêu; trung tâm tại Cà Mau" },
  { id: "AG", name: "Tỉnh An Giang", shortName: "An Giang", type: "province", note: "Hợp nhất Kiên Giang + An Giang; trung tâm tại An Giang" },
] as const;

/** Danh sách tên 34 tỉnh/thành phố */
export const VIETNAM_PROVINCE_NAMES: readonly string[] = VIETNAM_PROVINCES.map((p) => p.name);
