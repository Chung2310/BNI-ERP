# Thiết kế tham chiếu: nhiều chapter và xét duyệt thành viên BNI

> Trạng thái: các quyết định nghiệp vụ ở mục 9 đã được chốt. Cần kiểm thử và rà soát phân quyền toàn bộ module trước khi dùng dữ liệu thật.

## 1. Mục tiêu và quyết định kiến trúc

- Hệ thống phục vụ nhiều chapter BNI tại Việt Nam. Mỗi chapter có dữ liệu và tài khoản quản trị riêng.
- **Superadmin** tạo, quản lý vòng đời chapter và cấp tài khoản admin ban đầu cho chapter.
- **Admin chapter** quản lý thành viên, cuộc họp và đơn đăng ký thuộc chapter của mình; không có quyền quản lý chapter khác hoặc tạo chapter mới.
- Mỗi người dùng chỉ có **một đơn gia nhập đang chờ** và tại một thời điểm chỉ sinh hoạt trong **một chapter**. Có thể sửa chapter trong đơn hoặc xóa đơn trước khi admin xác nhận.
- Khi admin chapter xác nhận đơn, tài khoản trở thành thành viên chapter đó. Muốn chuyển chapter phải hoàn tất quy trình rời chapter rồi nộp đơn mới.
- Thành viên có thể xin rời chapter. Tư cách thành viên vẫn còn hiệu lực khi đơn rời đang chờ; **admin chapter hiện tại phải duyệt** thì việc rời chapter mới có hiệu lực.

### Ranh giới dữ liệu được khuyến nghị

Tạm ánh xạ **một `Company` = một chapter**. `companyCode` là khóa phạm vi dữ liệu của chapter; `Branch` hiện có giữ nghĩa chi nhánh/địa điểm bên trong một đơn vị và không dùng làm ranh giới chapter trong giai đoạn này. Có thể thêm tên, mã chapter BNI, khu vực, địa chỉ, trạng thái và thông tin liên hệ vào hồ sơ chapter, thay vì đổi tên toàn bộ model ngay.

Lý do: thành viên, cuộc họp, QR check-in, quyền vai trò và nhiều module đang dựa vào `companyCode`. Nếu dùng một `Company` chứa nhiều `Branch` đại diện cho các chapter, phải chuyển hàng loạt truy vấn, quyền và tích hợp sang `branchId`; nguy cơ lộ dữ liệu giữa các chapter lớn hơn.

## 2. Hiện trạng trong mã nguồn

| Thành phần | Hiện trạng | Việc cần làm |
| --- | --- | --- |
| `Company`, `User` | User có một `companyCode`; email là duy nhất toàn hệ thống. Luồng tạo `Company` tạo kèm một admin. | Giữ `companyCode` cho chapter đang sinh hoạt; bổ sung trạng thái thành viên và một đơn đang chờ. |
| Quyền quản trị | `admin` hiện được phép gọi endpoint tạo `Company`; `superadmin` xuất hiện rải rác nhưng chưa là vai trò xuyên suốt. | Tách superadmin cấp hệ thống khỏi admin chapter trên cả API, service và giao diện. |
| Đăng ký công khai | Tạo user cơ bản với `role: user`, chưa gắn `companyCode`; chưa có đơn xét duyệt. | Thêm hồ sơ đăng ký và khu vực người dùng chưa là thành viên. |
| Check-in khách | Là dữ liệu tham dự **một cuộc họp**, gồm tên, điện thoại, công ty, lĩnh vực, ảnh. | Có thể dùng lại trường và giao diện; không đồng nhất check-in khách với tài khoản hoặc đơn thành viên. |
| Phân quyền module | Nhiều API kiểm tra quyền hoặc module dựa trên `companyCode`; menu chỉ kiểm soát phía giao diện. | Chặn tài khoản chưa được duyệt tại backend bằng trạng thái thành viên. |
| Phiên đăng nhập | Access/refresh token chứa `role` và `companyCode`. | Sau duyệt/rời chapter phải làm mới hoặc vô hiệu hóa phiên cũ; backend không tin phạm vi cũ trong token. |

Các điểm tham chiếu: `server/model/company.model.ts`, `server/model/user.model.ts`, `server/model/branch.model.ts`, `server/service/auth.service.ts`, `server/router/auth.router.ts`, `server/middleware/auth.ts`, `server/middleware/require-module.ts`, `server/modules/meetings/meeting.model.ts`, `server/modules/meetings/meeting.router.ts`, `src/pages/MeetingCheckInPage.tsx`.

## 3. Vai trò và trạng thái

### Vai trò

| Vai trò | Phạm vi |
| --- | --- |
| Superadmin | Tạo/quản lý chapter và xem dữ liệu của các chapter qua bộ lọc chapter. Mọi dữ liệu hiển thị phải thuộc chapter đang chọn. |
| Admin chapter | Chỉ xác nhận đơn vào/rời chapter, quản lý thành viên và dữ liệu trong `companyCode` của chính mình; không có quyền từ chối đơn. |
| Người dùng chưa là thành viên | Đăng nhập, sửa hồ sơ cá nhân, xem chapter công khai, nộp/rút đơn, xem kết quả; không truy cập dữ liệu nội bộ chapter. |
| Thành viên | Dùng chức năng hiện tại trong đúng chapter đang sinh hoạt và gửi yêu cầu rời chapter. |

Không dùng `role: user` hoặc `isActive` làm bằng chứng duy nhất cho tư cách thành viên. Trạng thái tài khoản (có thể đăng nhập hay bị khóa) và trạng thái thành viên là hai khái niệm khác nhau. `companyCode` chỉ được gán khi phê duyệt vào chapter thành công.

### Đơn gia nhập

`pending → approved | withdrawn` (hoặc xóa đơn chờ).

- Một người dùng có tối đa **một đơn `pending` trên toàn hệ thống**.
- Người đang là thành viên không được nộp thêm đơn gia nhập trong phiên bản đầu. Sau khi rời chapter, họ có thể nộp đơn mới.
- Có thể sửa chapter trong đơn đang chờ, rút hoặc xóa đơn rồi nộp đơn mới.

### Yêu cầu rời chapter

`pending → approved | withdrawn`.

- Chỉ thành viên hiện tại được gửi yêu cầu rời; tối đa một yêu cầu `pending`.
- Trong thời gian chờ, quyền thành viên vẫn có hiệu lực. Nếu muốn khóa ngay khi nộp yêu cầu, cần quyết định nghiệp vụ riêng.
- Admin **của chapter hiện tại** chỉ có nút xác nhận rời; không được từ chối hoặc xử lý yêu cầu của chapter khác. Khi xác nhận, tư cách thành viên và quyền truy cập chapter được thu hồi; tài khoản cá nhân vẫn được giữ.
- Không cho admin chapter duy nhất tự rời khi chưa có admin thay thế.

## 4. Luồng người dùng

1. Superadmin tạo chapter và admin chapter. Chapter chỉ xuất hiện trong danh sách đăng ký khi đang hoạt động và cho phép nhận đơn.
2. Người mới tạo tài khoản với họ tên, email, điện thoại, công ty, lĩnh vực và mật khẩu; ảnh đại diện có thể bổ sung sau. Hồ sơ có thể sửa sau khi tạo tài khoản và sau khi nộp đơn.
3. Người dùng đăng nhập vào khu vực giới hạn, chọn một chapter để nộp **một đơn đang chờ**. Trước khi được xác nhận, họ có thể sửa chapter trong đơn, rút hoặc xóa đơn.
4. Admin chapter xem hàng đợi và hồ sơ hiện tại của người nộp, rồi bấm **Xác nhận**; không có thao tác từ chối.
5. Xác nhận hợp lệ gắn tài khoản với chapter đó và cập nhật phiên/quyền truy cập.
6. Thành viên có thể gửi yêu cầu rời chapter. Sau khi admin hiện tại duyệt, người dùng trở lại trạng thái chưa là thành viên và có thể nộp đơn gia nhập mới.

**Check-in khách mời** vẫn hoạt động độc lập. Việc check-in khách không tự tạo đơn gia nhập hoặc cấp quyền thành viên. Có thể cung cấp lời mời tạo tài khoản sau check-in và điền trước các trường hồ sơ được người dùng xác nhận.

## 5. Mô hình dữ liệu đề xuất

- `User`: giữ danh tính toàn hệ thống và hồ sơ cá nhân. `companyCode`/`activeChapterId` biểu thị chapter đang sinh hoạt, rỗng nếu chưa có. Nên có `membershipStatus` rõ ràng (`none`, `active`; các đơn chờ nằm ở collection riêng) và `authVersion`/cơ chế tương đương để thu hồi quyền phiên cũ.
- `Chapter` hoặc metadata mở rộng trên `Company`: mã chapter duy nhất, tên, khu vực, địa chỉ, trạng thái hoạt động, có nhận đơn hay không, admin được phân công. Giai đoạn đầu có thể dùng `Company` làm bản ghi gốc.
- `MembershipApplication`: `applicantUserId`, `chapterCode`, `status`, `submittedAt`, `decidedAt`, `decidedBy`. Admin xem dữ liệu hồ sơ hiện tại của tài khoản; không cần quyết định bản chụp hay bản mới.
- `LeaveRequest`: `userId`, `chapterCode`, `status`, `requestedAt`, `decidedAt`, `decidedBy`, lý do.
- Nếu sau này cần lưu nhiều nhiệm kỳ hoặc chuyển chapter với báo cáo lịch sử, thêm `Membership`/`MembershipTerm` riêng thay vì chỉ dựa vào `User.companyCode`.

Ràng buộc dữ liệu cần có: duy nhất `applicantUserId` cho đơn đang `pending`; duy nhất một chapter đang hoạt động cho mỗi user; duy nhất một yêu cầu rời đang `pending` cho một tư cách thành viên. Email tài khoản vẫn duy nhất toàn hệ thống.

## 6. Quy tắc nhất quán khi xác nhận đơn

Một tài khoản chỉ có một đơn chờ. Nếu đơn vừa được sửa, xóa hoặc xác nhận trong lúc admin thao tác, server phải từ chối thao tác cũ và tải lại dữ liệu.

Xác nhận phải là thao tác nguyên tử: kiểm tra đơn còn `pending`, chapter còn hoạt động và user chưa thuộc chapter nào; chỉ một thao tác được chuyển user sang `active` và gắn `companyCode`. Nếu hai thao tác đến gần nhau, thao tác sau nhận lỗi xung đột. Cần kiểm tra khả năng chạy transaction trên cấu hình MongoDB thực tế.

Đơn đã xác nhận được giữ làm lịch sử khi người dùng rời chapter. Sau khi rời, người dùng nộp đơn mới nếu muốn gia nhập chapter khác.

## 7. Phân quyền và an toàn dữ liệu

- Tài khoản chưa là thành viên chỉ được dùng API hồ sơ cá nhân, danh sách chapter công khai, đơn của chính mình và thông báo của chính mình. Mọi API nội bộ (roster, cuộc họp, check-in thành viên, chat, tài nguyên, báo cáo, phí…) phải chặn ở **backend**, kể cả khi gọi URL trực tiếp.
- Admin chapter chỉ đọc/duyệt đơn có `chapterCode` bằng phạm vi admin được gán. `chapterCode`, `role`, `companyCode` và trạng thái phê duyệt không được lấy từ dữ liệu client làm nguồn tin cậy.
- Kiểm tra phạm vi cả ở danh sách lẫn thao tác theo ID. Rà các tác vụ nền, socket, thông báo, file/media, QR và dữ liệu export để không trộn chapter.
- Sau khi vào hoặc rời chapter, làm mới/vô hiệu hóa token cũ và kiểm tra trạng thái hiện tại từ server.
- Ghi audit log cho tạo chapter, thay admin, nộp/sửa/xóa đơn và xác nhận gia nhập/rời chapter.

## 8. Phạm vi triển khai và đánh giá khả thi

**Khả thi cao**, nhưng là thay đổi **trung bình đến lớn** vì chạm tài khoản, phân quyền, dữ liệu và giao diện. Nền tảng `Company` theo `companyCode` giúp tránh việc phải thiết kế lại toàn bộ module. Rủi ro chính là tài khoản chưa duyệt truy cập API nội bộ, admin chapter vượt phạm vi, và hai chapter cùng duyệt một người.

Thứ tự triển khai đề xuất:

1. Chốt mô hình chapter và phân quyền superadmin/admin chapter; kiểm tra dữ liệu chapter hiện tại để lập phương án chuyển đổi.
2. Thêm trạng thái thành viên, collection đơn và ràng buộc; kiểm tra backend cho tài khoản chưa duyệt và phạm vi chapter.
3. Xây đăng ký/hồ sơ, danh sách chapter và nộp/sửa/xóa một đơn; xây hàng đợi xác nhận của admin.
4. Xây phê duyệt nguyên tử, thông báo, làm mới phiên; sau đó xây yêu cầu rời chapter và thu hồi quyền.
5. Kiểm thử xuyên chapter, xác nhận đồng thời, token cũ, rời chapter, nộp lại và hồi quy các module hiện có trước khi chuyển dữ liệu thật.

### Điều kiện nghiệm thu quan trọng

- Người chưa được duyệt đăng nhập được nhưng không truy cập được API/nội dung nội bộ chapter.
- Một người chỉ có một đơn chờ; có thể sửa chapter hoặc xóa đơn trước khi được xác nhận.
- Admin chapter A không thấy hoặc xử lý đơn, thành viên, cuộc họp của chapter B.
- Thành viên gửi yêu cầu rời vẫn là thành viên cho đến khi admin chapter của mình duyệt; sau duyệt, token cũ không còn truy cập được dữ liệu chapter.
- Người đã rời có thể nộp đơn mới; lịch sử tư cách thành viên và quyết định cũ còn để đối soát.

## 9. Quyết định nghiệp vụ đã chốt

- Hồ sơ chỉ cần mức thông tin tương đương check-in khách mời: họ tên, điện thoại, công ty, lĩnh vực, ảnh đại diện nếu có; email và mật khẩu phục vụ đăng nhập. Người dùng có thể sửa hồ sơ sau khi tạo tài khoản hoặc nộp đơn.
- Đơn gia nhập đơn giản: chọn một chapter và gửi. Một tài khoản chỉ có một đơn đang chờ; người dùng có thể sửa chapter, rút hoặc xóa đơn khi còn chờ.
- Admin chapter chỉ có nút **Xác nhận** cho đơn gia nhập và yêu cầu rời chapter; không có quyền từ chối.
- Superadmin có thể xem dữ liệu các chapter. Giao diện theo chapter như admin thông thường, bổ sung bộ lọc chapter; mọi dữ liệu phải thuộc chapter được chọn. Bộ lọc và quyền truy cập phải được kiểm tra tại backend, không chỉ ở giao diện.

## 10. Vận hành bản triển khai đầu tiên

- Cấu hình `SEED_SUPERADMIN_EMAIL`, `SEED_SUPERADMIN_PASSWORD` (ít nhất 12 ký tự) và tùy chọn `SEED_SUPERADMIN_NAME` trên backend, rồi khởi động server để tạo superadmin. Email này phải khác email admin chapter mặc định. Không đặt mật khẩu thật trong repo.
- Superadmin đăng nhập và mở `/chapter` để tạo chapter cùng tài khoản admin đầu tiên. Người mới mở `/dang-ky-thanh-vien`, tạo tài khoản rồi nộp đơn trong `/chapter`. Admin chapter mở `/chapter` để xét duyệt.
- Kết quả đơn và hàng đợi admin được làm mới định kỳ trong `/chapter`. Bản này chưa gửi email hoặc push riêng cho đơn gia nhập/rời chapter.
- Superadmin hiện có bộ lọc chapter trong `/chapter` để xem thành viên, đơn chờ và yêu cầu rời. Yêu cầu xem toàn bộ các module ERP theo chapter là phạm vi triển khai tiếp theo: mỗi API phải xác thực chapter được chọn ở backend trước khi mở giao diện tương ứng.
- Trước khi áp dụng index một đơn chờ trên dữ liệu đã tồn tại, kiểm tra và xử lý các tài khoản đang có nhiều đơn `pending`; nếu không, MongoDB không tạo được unique index mới.
- Trên MongoDB replica set, thao tác duyệt chạy trong transaction. Trên MongoDB standalone, hệ thống dùng cập nhật có điều kiện để bảo đảm mỗi tài khoản chỉ nhận một `companyCode`; transaction nhiều bản ghi không khả dụng. Nếu yêu cầu độ bền nhất quán tuyệt đối khi máy chủ dừng giữa chừng, triển khai MongoDB replica set trước khi mở chức năng cho người dùng thật.
- Kiểm thử tích hợp: `npx vitest run server/router/chapter.router.integration.test.ts`. Kiểm tra kiểu: `npm run typecheck`. Build: `npm run build`.
