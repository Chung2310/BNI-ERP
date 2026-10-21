export const WHEEL_SELECTION_NAME = "Chọn người tham gia";
export const WHEEL_DISPLAY_NAME = "Lượt quay";
export const wheelDisplayName = (name?: string) => name === "Lượt chọn mới" ? "Lượt quay mới" : !name || name === WHEEL_SELECTION_NAME || name === "Lượt chọn" ? WHEEL_DISPLAY_NAME : name;
export const wheelSelectionGuide = {
  updatedAt: "14/10/2026",
  sections: [
    { title: "1. Mục đích", paragraphs: ["Vòng quay may mắn hỗ trợ người điều phối chọn ngẫu nhiên một người từ danh sách để phát biểu, trình bày hoặc tham gia hoạt động trong cuộc họp.", "Tính năng không tổ chức rút thưởng, trao quà, đặt cược hoặc thu tiền cho lượt quay."] },
    { title: "2. Danh sách tham gia", paragraphs: ["Vòng quay chỉ gồm thành viên Chapter đã check-in đến hết giờ được cấu hình trong phần Vòng quay may mắn (mặc định 07:00). Khách mời và thành viên vắng mặt không tham gia.", "Người điều phối có thể chọn thành viên trong danh sách hợp lệ trước mỗi lượt quay."] },
    { title: "3. Cách chọn và ghi nhận kết quả", paragraphs: ["Máy chủ chọn ngẫu nhiên một người trong danh sách khi quay trên màn hình trình chiếu. Hoạt ảnh vòng quay thể hiện người được chọn. Lượt quay trên điện thoại được ghi vào lịch sử của cuộc họp.", "Sau mỗi lượt, người điều phối có thể loại người vừa được chọn khỏi những lượt tiếp theo hoặc giữ họ trong danh sách. Có thể điều chỉnh danh sách trước lượt tiếp theo."] },
    { title: "4. Quyền riêng tư và hỗ trợ", paragraphs: ["Tên và ảnh hồ sơ của người tham gia có thể được hiển thị trên vòng quay, màn hình trình chiếu và lịch sử cuộc họp theo quyền truy cập của Chapter.", "Nếu cần hỗ trợ về vòng quay may mắn, liên hệ igen.work99@gmail.com."] },
  ],
};
