# Thu phí thành viên qua SePay

Cấu hình SePay được lấy **chỉ từ biến môi trường server** (file `.env` được server nạp), không đọc cấu hình cũ trong MongoDB và không cho sửa qua API/giao diện.

Khai báo theo `.env.example`:
```dotenv
SEPAY_ENABLED=true
SEPAY_COMPANY_CODE=BNI
SEPAY_BANK=Vietcombank
SEPAY_ACCOUNT_NUMBER=your_account_number
SEPAY_ACCOUNT_NAME="TEN CHU TAI KHOAN"
SEPAY_API_KEY=your_webhook_api_key_at_least_32_characters
```

`SEPAY_COMPANY_CODE` phải khớp mã đơn vị được thu phí; tài khoản chung này chỉ dùng cho đơn vị đó. Thiếu cấu hình, sai định dạng hoặc đơn vị khác sẽ không bật thanh toán. API key gồm 32–200 ký tự chữ, số, _ hoặc -, không trả về trình duyệt. Không dùng biến VITE_* cho key. Khởi động lại server sau khi sửa .env. Cấu hình cũ trong DB được giữ nguyên nhưng không còn được sử dụng.

Admin mở **Thành viên → Phí thường niên → SePay & giao dịch** để xem trạng thái và URL webhook:
1. Tạo webhook SePay đến URL hiển thị trên tên miền HTTPS công khai: `/api/v1/webhook/sepay/:companyCode`.
2. Chọn POST JSON, tiền vào, xác thực API Key; nhập cùng giá trị SEPAY_API_KEY. Đây là key webhook, không phải token gọi API SePay. Cho phép gửi giao dịch không có mã để đối soát.
3. Tạo khoản phí rồi bấm **Gửi thông báo & QR**. Mỗi khoản gửi tối đa một thông báo/ngày; chỉ admin có thể tạo, gửi hoặc ghi nhận thủ công.

Thông báo trong ứng dụng có QR theo số dư hiện tại và liên kết mở đúng khoản phí. Thành viên chỉ xem các khoản của mình. Chi tiết thanh toán cập nhật mỗi 8 giây; QR trong hộp thông báo cập nhật mỗi 15 giây.

QR dùng `https://vietqr.app/img` với tài khoản, số tiền còn thiếu, nội dung riêng BNI + 20 ký tự hex. Giữ nguyên nội dung chuyển khoản. Tài khoản được chốt khi gửi lần đầu: đổi cấu hình không đổi QR của khoản cũ; duy trì webhook tài khoản cũ đến khi thu xong.

Webhook kiểm tra API key theo đơn vị, ngân hàng và số tài khoản của khoản phí. Mã giao dịch được lưu duy nhất theo đơn vị; cập nhật phiếu thu nguyên tử để chống nhận trùng, kể cả lỗi sau khi ghi tiền nhưng trước khi hoàn tất nhật ký. Lần thử lại tiếp tục xử lý giao dịch pending. Không hủy phiếu thu tự động SePay trong giao diện.

Tiền chuyển thiếu được ghi một phần, QR giảm về số còn thiếu. Tiền chuyển thừa giữ nguyên số thực nhận, hiển thị số thừa để admin xử lý hoàn trả/đối soát ngoài hệ thống. Tiền ra bị bỏ qua; mã không khớp, nhiều mã hoặc sai tài khoản được lưu **Cần kiểm tra**, không cộng vào khoản phí. Admin xem 100 giao dịch mới nhất ở mục SePay & giao dịch. Sau khi đối chiếu ngân hàng, có thể ghi nhận thủ công giao dịch cần kiểm tra với mã tham chiếu; giao dịch review không được tự áp dụng lại.

Xác nhận HTTP `{success:true}` chỉ sau khi đã lưu kết quả. Lỗi xác thực trả 401, dữ liệu sai 400, cùng id khác nội dung 409, lỗi lưu trữ 500 để SePay thử lại. Payload thử có id 0 không ghi tiền.

Khi đưa lên môi trường thật, cần khởi tạo unique indexes của MemberFee, MemberFeeSePayTransaction, WebNotification (nếu tắt autoIndex thì triển khai indexes bằng quy trình DB hiện có). Kiểm tra một giao dịch nhỏ qua tài khoản thật, đối chiếu sổ ngân hàng, thử phát lại webhook và xác nhận chỉ có một phiếu thu. Chưa có cấu hình hoặc giao dịch thật được tạo bởi thay đổi mã nguồn này.

Tài liệu giao thức: https://developer.sepay.vn/vi/sepay-webhooks/tich-hop-webhook
Xác thực: https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc
QR: https://developer.sepay.vn/vi/sepay-webhooks/tao-qr-va-form-thanh-toan
