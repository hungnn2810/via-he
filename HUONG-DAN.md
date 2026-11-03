# Xóm Trọ Sinh Viên — game 3D tương tác cho TikTok LIVE

Một dãy nhà trọ **5 tầng × 5 phòng (25 phòng)** vào ban đêm. Có hành lang phơi quần áo, dây điện chằng chịt, bồn nước inox trên mái, xe máy dựng trước cổng, và **chú chủ trọ** mặc áo ba lỗ ngồi uống trà ở dưới. Số tầng và số phòng mỗi tầng chỉnh được trong `config.json`, máy quay tự lùi cho vừa khung.

**Nền động:** mây trôi, sao nhấp nháy, sao băng, máy bay đêm nhấp nháy đèn, xe máy có đèn pha chạy ngang đường (thỉnh thoảng bấm còi), cửa sổ nhà hàng xóm bật tắt đèn.

**Âm thanh:** giọng chủ trọ giống Đi Chùa Online (giọng nam NamMinh, trầm hơn một chút). Có **nhạc nền lofi** tự chơi, tự nhỏ lại khi chủ trọ nói. Muốn dùng nhạc của bạn thì đặt file `nhac-nen.mp3` vào thư mục `public/nhac/`.

**Hai quán trước cổng:**
- Bên trái là **xe bánh mì – xôi**: tủ kính sáng đèn, ổ bánh mì vàng, nồi xôi bốc khói, cô bán hàng đội nón lá. Người xem comment **"bánh mì"** hoặc **"xôi"** để mua: cô bán hàng đưa hàng, món ăn bay lên phòng người mua, quầy đếm số phần đã bán.
- Bên phải là **quán trà đá vỉa hè**: bàn nhựa xanh, ghế nhựa đỏ, bình trà đá, đĩa hướng dương, **điếu cày** dựng cạnh bàn, bà bán trà ngồi ghế thấp. Người xem comment **"trà đá"** (hoặc "điếu cày") thì nhân vật của mình **xuống quán ngồi** 45 giây, có tên trên đầu. Quán có 4 ghế, người ngồi lâu nhất sẽ nhường ghế cho người mới.

**🚌 Bến xe buýt trước cổng (tuyến 32 · Xóm trọ ⇄ Đại học):**
- Có người **vào xem live** thì xe buýt xanh chạy tới bến và dừng lại. Những người mới vào lần lượt **xuống xe** (tên có 👋), đi bộ dọc vỉa hè vào cổng trọ. Chủ trọ đọc tên chào. Mỗi chuyến chở tối đa 6 người, ai chưa kịp lên thì đi chuyến sau.
- Người **rời xóm** (tên có 🧳) dọn đồ, đi ra bến **đứng chờ**. Xe tới thì họ **lên xe** và xe chạy đi. Chủ trọ chào tạm biệt.
- Không có ai lên xuống thì thỉnh thoảng xe vẫn chạy qua cho phố đông vui.

⚠️ **Lưu ý:** TikTok **không báo** khi một người thoát live. Vì vậy game coi một người đã rời đi khi họ **không comment, thả tim hay tặng quà trong 8 phút** (đổi được bằng `phutRoiXom`). Phòng VIP không bao giờ bị tính là rời đi. Người bị "chuyển trọ" khi xóm đầy cũng ra bến đón xe.

Người xem chơi như sau:

| Người xem làm | Trong game |
|---|---|
| **Comment bất kỳ** | Được **thuê một phòng**: cửa sổ sáng đèn, nhân vật 3D ra đứng hành lang, biển tên phòng hiện tên mình. Comment hiện thành **bong bóng thoại** trên đầu nhân vật |
| **Thả tim** | Phòng mình **nấu mì**: khói bay ra cửa sổ. Cả xóm đếm số gói mì đã nấu |
| **Quà dưới 10 xu** | Đóng tiền nước. Chủ trọ cảm ơn |
| **Quà 10–99 xu** | Đóng tiền điện: phòng được **treo dây đèn nháy**, máy quay lia lại gần phòng |
| **Quà 100–499 xu** | **Bao cả xóm trà sữa**: ai cũng có cốc trà sữa trên đầu, bắn pháo hoa |
| **Quà từ 500 xu** | Phòng lên đời **PHÒNG VIP**: cửa vàng, biển neon, vương miện cạnh tên, không bị mất phòng khi xóm đầy |

**Sự kiện tự động:**
- ⚡ **Mất điện** (khoảng 7 phút một lần): cả xóm tối om, chỉ còn đèn pin điện thoại. Mọi người phải **thả tim** đủ số để chủ trọ chạy máy phát. Quà cũng góp vào. Đủ tim thì điện về và có pháo hoa.
- 🌧️ **Mưa to** (khoảng 5 phút một lần, kéo dài 45 giây): ai đang phơi đồ phải **comment "cất"**. Hết mưa, chủ trọ gọi tên mấy đứa để đồ bị ướt.
- 📢 Chủ trọ thỉnh thoảng đọc thông báo vui ("11 giờ khóa cổng", "nấu mì xong nhớ rửa nồi"…), chào người mới vào xóm và cảm ơn người tặng quà. Lời chủ trọ nói cũng hiện thành chữ, nên ai tắt tiếng vẫn đọc được.

Khi xóm đầy phòng, người im lặng lâu nhất (trừ phòng VIP) sẽ "chuyển trọ" để nhường phòng cho người mới. Cột phải có bảng **Phòng gương mẫu** (tặng nhiều quà nhất) và **Phòng ồn nhất** (comment nhiều nhất).

## Cài lần đầu
1. Cài **Node.js** bản LTS từ nodejs.org (bỏ qua nếu đã cài).
2. Bấm đúp `CHAY-THU.bat`. Lần đầu nó tự cài thư viện, mất 1–2 phút.
3. Mở `http://localhost:3002/` để xem game chạy với người xem giả lập.
   - `http://localhost:3002/?event=matdien`: xem ngay cảnh mất điện.
   - `http://localhost:3002/?event=mua`: xem ngay cảnh trời mưa.

## Lên live
1. Kiểm tra `config.json`: mặc định là `"tiktokUsername": "nguoivietsuviet"`.
2. Bấm đúp `BAT-LIVE.bat` và giữ cửa sổ này mở suốt buổi live.
3. Trong TikTok LIVE Studio, thêm nguồn **Link**: `http://lvh.me:3002/`, kích thước **1080 × 1920**.
4. Bấm Go Live. Game tự nối vào live. Nếu chưa nối được, nó tự thử lại mỗi 20 giây.

## Trang quản trị
Mở `http://localhost:3002/admin` trên máy đang chạy game (máy khác trong mạng không mở được). Ở đây có thể:
- Xem trạng thái live: người xem, tim, bình luận, quà, số màn hình live đang mở.
- Đổi kênh TikTok, kết nối lại hoặc ngắt mà không phải tắt cửa sổ đen.
- Gõ một câu cho chủ trọ đọc ngay trên live (nút **Nghe thử ở đây** chỉ phát trên máy mình).
- Bật mất điện, trời mưa, kết thúc sự kiện, đọc một thông báo, bắn pháo hoa, tải lại màn hình live.
- Sửa mọi mục trong bảng dưới đây. Bấm **Lưu** là ghi vào `config.json` và áp dụng ngay. Riêng tên xóm (biển hiệu), số tầng, số phòng, tuyến buýt, điếu cày thì phải bấm **Tải lại màn hình live**.

Cổng mạng: Đi Chùa Online dùng 3000, Đua Thuyền Rồng dùng 3001, Xóm Trọ dùng 3002, nên không đụng nhau. Muốn xem trạng thái kết nối thì mở `http://localhost:3002/?debug`.

## Tùy chỉnh (`config.json`)
| Mục | Ý nghĩa |
|---|---|
| `tenXom` | Tên xóm, hiện ở tiêu đề và biển hiệu |
| `soTang`, `soPhongMoiTang` | Số tầng (2–8) và số phòng mỗi tầng (2–8). Mặc định 5 × 5 = 25 phòng. Càng nhiều phòng thì nhân vật càng nhỏ |
| `tuyenBuyt` | Số tuyến xe buýt hiện trên xe và biển ở bến |
| `phutRoiXom` | Bao nhiêu phút không tương tác thì coi như đã rời live và ra bến lên xe (mặc định 8) |
| `hienDieuCay` | `true`/`false`: hiện hoặc ẩn cái điếu cày ở quán trà đá |
| `tenChuTro`, `xungHo` | Tên hiển thị và cách chủ trọ tự xưng ("chú", "bà", "cô"…). Nhớ sửa luôn các câu trong `thongBaoChuTro` |
| `nhacNen`, `amLuongNhac`, `fileNhac` | Bật/tắt nhạc nền, âm lượng nhạc, tên file nhạc trong `public/nhac/`. Không có file thì game tự chơi lofi |
| `giongDoc`, `caoGiong`, `tocDoDoc`, `docGiong` | Giọng đọc (mặc định `vi-VN-NamMinhNeural` như Đi Chùa Online; giọng nữ là `vi-VN-HoaiMyNeural`), độ cao giọng (`-4%`), tốc độ đọc, bật/tắt giọng |
| `timDeCoDien` | Số tim tối đa cần để có điện lại. Game tự giảm khi xóm ít người |
| `phutGiuaCacLanMatDien`, `phutGiuaCacLanMua` | Bao lâu thì có một lần mất điện, một lần mưa |
| `phutNgayDem` | Bao nhiêu phút thì đổi ngày ↔ đêm (mặc định 2). Nút "Đổi ngày / đêm" ở trang quản trị đổi ngay |
| `giayMoiThongBao`, `thongBaoChuTro` | Bao lâu chủ trọ đọc thông báo một lần, và danh sách thông báo (thêm bớt thoải mái) |
| `amThanh`, `amLuong` | Âm thanh hiệu ứng (gõ cửa, tiền rơi, mưa, pháo hoa, rít điếu cày) |
| `tiengXe` | `true`/`false`: tiếng máy xe máy và xe buýt chạy ngoài đường |
| `tuCam` | Tên hoặc comment chứa các từ này sẽ không hiện |

Sửa trong trang quản trị thì áp dụng ngay. Nếu sửa tay `config.json` thì phải mở lại `BAT-LIVE.bat` rồi làm mới nguồn Link trong LIVE Studio.

## Lưu ý
- Game vẽ 3D bằng card đồ họa. Máy yếu có thể giật, khi đó tắt bớt chương trình khác trong lúc live.
- Comment "điếu cày" / "thuốc lào" thì khách ngồi quán trà đá rít một hơi (tiếng ùng ục, nhả khói); khách đang ngồi quán thỉnh thoảng cũng tự rít. TikTok khá chặt với nội dung liên quan đến thuốc lá. Nếu buổi live bị cảnh báo hoặc bị giảm hiển thị, đặt `"hienDieuCay": false` (ẩn điếu cày, tắt luôn tiếng rít và khói).
- Giọng đọc dùng dịch vụ của Microsoft Edge nên cần mạng Internet. Máy cần có thiết bị phát âm thanh (loa, tai nghe hoặc VB-Cable).
- Mọi hình 3D và nhạc lofi mặc định đều được tạo bằng code, không dùng hình ảnh hay nhạc của người khác. Nếu tự đặt file nhạc, chỉ dùng nhạc bạn có quyền sử dụng, vì TikTok có thể tắt tiếng live khi gặp nhạc có bản quyền.
- Thư viện đọc sự kiện TikTok (`tiktok-live-connector`) là bản không chính thức. Nếu TikTok thay đổi hệ thống, chạy `npm update` trong thư mục game.
