<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c9f16f0c-380d-4f8a-bd87-6bcf8a623f13

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## 🚀 Hướng dẫn cấu hình CI/CD (GitHub Actions)

Dự án này sử dụng GitHub Actions để tự động hóa toàn bộ quá trình Tích hợp liên tục (CI) và Triển khai liên tục (CD) lên Firebase cùng máy chủ VPS chạy Docker.

### 1. Cấu hình GitHub Secrets
Để kích hoạt luồng triển khai tự động (CD), bạn cần truy cập vào Repo GitHub của mình -> **Settings** -> **Secrets and variables** -> **Actions** và tạo mới các **Repository Secrets** sau:

| Tên Secret | Mô tả chi tiết | Cách lấy thông tin |
| :--- | :--- | :--- |
| `GCP_SA_KEY` | Khóa tài khoản dịch vụ (JSON Key) để xác thực và deploy Rules & Functions lên Firebase. | Tạo Service Account với vai trò Editor trong GCP IAM Console và tải file JSON Key về. |
| `SSH_HOST` | Địa chỉ IP hoặc tên miền của máy chủ VPS đích. | Địa chỉ máy chủ VPS của bạn. |
| `SSH_USER` | Tên tài khoản đăng nhập SSH của VPS. | Thường là `root`, `ubuntu`, hoặc `centos`. |
| `SSH_KEY` | Nội dung khóa Private Key SSH dùng để xác thực kết nối. | Khóa SSH Private tương ứng với Public Key được thêm vào `authorized_keys` của VPS. |
| `SSH_PORT` | Cổng kết nối SSH (tùy chọn). | Mặc định là `22` nếu không thiết lập. |

### 2. Quy trình kiểm tra tích hợp (CI)
Mỗi khi bạn thực hiện **Push** hoặc **Tạo Pull Request** hướng về nhánh `develop` hoặc `production`, GitHub Actions sẽ tự động chạy:
1. **Kiểm tra kiểu dữ liệu (Type check)**: Chạy `yarn typecheck` (`tsc --noEmit`) trên toàn bộ dự án.
2. **Kiểm tra biên dịch (chỉ trên Pull Request)**: Chạy thử build dự án (`yarn build`) để bắt lỗi build trước khi merge. Khi push, bước này được bỏ qua vì Docker image đã build lại toàn bộ.

### 3. Quy trình triển khai tự động (CD)
Khi mã nguồn được merge thành công vào các nhánh chỉ định, CD sẽ tự động triển khai tương ứng:
* **Nhánh `develop`**: Triển khai lên môi trường **Staging** trên VPS (đường dẫn `/opt/igen-erp/staging`).
* **Nhánh `production`**: Triển khai lên môi trường **Production** trên VPS (đường dẫn `/opt/igen-erp/production`).
* Cả hai môi trường đều tự động cập nhật Firebase Cloud Functions, Firestore & Storage Security Rules.


## Slide giới thiệu BNI

Trong **Cuộc họp → mở buổi họp → Slide**, chọn người đã check-in để xem trước.
Hệ thống tự chọn mẫu Member/Guest và lấy tên, công ty, avatar, ảnh bìa,
SĐT, lĩnh vực từ hồ sơ thành viên; khách mời dùng dữ liệu check-in và không hiển thị ngày sinh/lĩnh vực.
Người có quyền quản lý cuộc họp có thể bổ sung bio và chỉnh thông tin riêng cho
slide của buổi họp. **Dùng lại hồ sơ** xóa bản chỉnh riêng và lấy dữ liệu mới nhất.

Có ba chế độ: chuyển thủ công, tự chạy (3–120 giây), theo người đang phát biểu.
**Trình chiếu** mở toàn màn hình; dùng ← / → để chuyển, Esc để thoát.
**Tải PNG** xuất slide đang xem ở 1920×1080, cùng bố cục với màn hình chiếu.
Font tiếng Việt được đóng gói trong ứng dụng. Chữ dài được thu nhỏ/rút gọn;
ảnh không tải được sẽ dùng ảnh thay thế và có thông báo trong phần xem trước.
Ảnh ngoài hệ thống cần cho phép CORS để trình duyệt có thể ghép và xuất PNG.

Thiết kế tham chiếu: `public/slide-for-member.png`, `public/slide-for-guest.png`.
Logo dùng khi dựng slide: `public/bni-logo.png`.
