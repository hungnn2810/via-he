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
| **Quà 100–499 xu** | **Bao cả xóm trà sữa**: ai cũng có cốc trà sữa trên đầu, bắn pháo hoa, người tặng mời mọi người **lên sân thượng ăn lẩu** |
| **Quà từ 500 xu** | Phòng lên đời **PHÒNG VIP**: cửa vàng, biển neon, vương miện cạnh tên, không bị mất phòng khi xóm đầy. Máy quay lia vào phòng, mưa kim tuyến vàng, **xe hoa** chạy qua cổng |
| **Theo dõi kênh** | **Ba gác chuyển trọ** chở đồ người đó tới cổng |
| **Chia sẻ live** | **Mèo Mướp** chạy sang nằm trước phòng người chia sẻ |

**Lệnh comment trong phòng** (mỗi người mỗi lệnh vài giây mới tính lại, chống spam):

| Comment | Trong game |
|---|---|
| **"hát"**, "karaoke" | Nhân vật cầm mic hát, nốt nhạc bay ra. **3 phòng cùng hát** trong 25 giây → *Karaoke cả xóm*, chủ trọ kêu "hát nhỏ thôi" |
| **"quẩy"**, "nhảy" | Nhân vật nhảy lắc lư. **4 phòng cùng quẩy** → *Cả xóm quẩy*, ai cũng nhảy, pháo hoa |
| **"dô"**, "zô" | Cụng ly 🍻. **4 phòng cùng "dô"** trong 15 giây → cả xóm cụng ly |
| **"học"**, "ôn thi" | Cúi đầu học bài 30 giây |
| **"ngủ"**, "zzz", "gn" | Tắt đèn đi ngủ, 💤 bay ra. Comment, thả tim hay tặng quà là tỉnh dậy; tự dậy sau 2 phút |
| **"chào"**, "hi", "hello" | Vẫy tay, hàng xóm cùng tầng vẫy lại |
| **"gõ 203"** (số phòng) | Gõ cửa phòng 203: người trong phòng giật mình nhảy lên (đang ngủ thì bị đánh thức) |

**Trang trí phòng** (miễn phí, giữ lại cho buổi live sau):

| Comment | Trong game |
|---|---|
| **"trồng cây"** | Chậu cây có hoa trên lan can trước phòng |
| **"treo cờ"** | Cờ đỏ sao vàng bay trước phòng |
| **"đèn lồng"** | Đèn lồng đỏ treo trước cửa |
| **"sơn cửa hồng"** (đỏ, xanh, xanh lá, vàng, tím, trắng, đen, cam, nâu) | Sơn lại cửa phòng |
| **"dọn phòng"** | Bỏ hết đồ trang trí |

**Hoạt cảnh khác:** comment **"trà sữa"**, **"đặt cơm"**, "ship"… thì shipper chạy xe máy tới cổng, người đặt xuống nhận đồ · **"đá cầu"** rủ nhau lên sân thượng tòa A đá cầu · **"hát"** lên sân thượng tòa C hát karaoke với loa kẹo kéo · **"kem"**, **"chè"** gọi xe đạp kem chè (xe cũng tự ghé định kỳ) · chủ trọ định kỳ đi dọc hành lang **thu tiền phòng** (ai comment trong 3 phút gần đây là "có mặt") · Tết, Trung thu, Noel tự trang trí (đèn lồng, mai vàng, múa lân, tuyết, cây thông).

Dòng gợi ý dưới tiêu đề tự đổi giữa các lệnh mỗi 7 giây. Đang có sự kiện thì nó chỉ nhắc lệnh của sự kiện đó.

**🏘️ Cấp xóm (mục tiêu chung):** mọi tim (1 điểm), comment (2 điểm), xu quà (10 điểm), người mới (5 điểm), theo dõi / chia sẻ (20 điểm) cộng vào điểm xóm. Điểm **cộng dồn qua các buổi live**. Thanh dưới tiêu đề cho biết còn bao nhiêu điểm tới cấp sau. Mỗi cấp mở khóa đồ mới cho cả xóm: 2 dây đèn hành lang · 3 sơn lại tường · 4 cây xanh lan can · 5 wifi miễn phí · 6 biển neon tên xóm trên mái · 7 đèn lồng giăng sân · 8 pháo hoa mỗi đêm · 9 xóm huyền thoại (mái viền vàng).

**🏆 Thi đua 3 tòa:** mỗi vòng 10 phút (`phutThiDua`), tim, comment, quà của người thuê cộng điểm cho tòa của họ (A, B hoặc C). Hết vòng, tòa nhiều điểm nhất được đội vương miện trên mái tới vòng sau, chủ trọ khen người góp nhiều nhất.

**💾 Người thuê cũ:** game nhớ người thuê qua các buổi live (file `du-lieu-xom.json` cạnh `config.json`; chế độ thử ghi `du-lieu-thu.json`). Người quay lại được nhận lại phòng cũ nếu còn trống, giữ nguyên ngoại hình, phòng VIP, đèn nháy, đồ trang trí, và chủ trọ chào "về xóm rồi". Nút **Xóa dữ liệu xóm** trong trang quản trị xóa hết.

**Sự kiện tự động:**
- ⚡ **Mất điện** (khoảng 7 phút một lần): cả xóm tối om, chỉ còn đèn pin điện thoại. Mọi người phải **thả tim** đủ số để chủ trọ chạy máy phát. Quà cũng góp vào. Đủ tim thì điện về và có pháo hoa.
- 🌧️ **Mưa to** (khoảng 5 phút một lần, kéo dài 45 giây): ai đang phơi đồ phải **comment "cất"**. Hết mưa, chủ trọ gọi tên mấy đứa để đồ bị ướt.
- 🦹 **Có trộm** (khoảng 6 phút một lần, 42 giây): kẻ trộm vác bao tải lén đi dọc vỉa hè. Cả xóm **comment "bắt"** để ném dép 🩴 từ phòng mình vào nó; thả tim và quà cũng góp sức. Đủ lượt thì bắt được, chủ trọ khen 3 người ném nhiều nhất. Không kịp thì trộm chạy mất.
- 🧠 **Đố vui** (khoảng 4 phút một lần, 35 giây): chủ trọ đọc một câu đố mẹo, **ai comment đúng đáp án đầu tiên** thì thắng, được gọi tên và bắn pháo hoa. Hết giờ chủ trọ đọc đáp án. Câu đố sửa trong trang quản trị.
- 🚱 **Cúp nước**: thả tim để gọi xe bồn, xe tới thì vòi nước bơm lên bồn inox trên mái.
- 🌬️ **Gió to**: quần áo phơi bay xuống đường, **comment "nhặt"** để chạy xuống nhặt về.
- 📚 **Mùa thi**: thả tim để cả xóm thức ôn bài, comment **"học bài"** góp thêm.
- Giữa hai sự kiện luôn nghỉ ít nhất 20 giây. Thời gian giữa các lần có xê dịch ngẫu nhiên. Xóm vắng (dưới 3 người đang tương tác) thì không có mất điện / trộm (cần nhiều người), chỉ có mưa và đố vui; xóm đông thì ưu tiên sự kiện cả xóm cùng làm.
- 📢 Chủ trọ thỉnh thoảng đọc thông báo vui ("11 giờ khóa cổng", "nấu mì xong nhớ rửa nồi"…), chào người mới vào xóm và cảm ơn người tặng quà. Lời chủ trọ nói cũng hiện thành chữ, nên ai tắt tiếng vẫn đọc được.

Khi xóm đầy phòng, người im lặng lâu nhất (trừ phòng VIP) sẽ "chuyển trọ" để nhường phòng cho người mới. Cột phải có bảng **Phòng gương mẫu** (tặng nhiều quà nhất), một mục tự đổi mỗi ~9 giây (**Phòng ồn nhất**, **Vua bắt trộm**, **Thánh đố**, **Tay quay số**, **Gương mẫu tuần**) và thanh **Thi đua tòa**.

## Cài lần đầu
1. Cài **Node.js** bản LTS từ nodejs.org (bỏ qua nếu đã cài).
2. Bấm đúp `CHAY-THU.bat`. Lần đầu nó tự cài thư viện, mất 1–2 phút.
3. Mở `http://localhost:3002/` để xem game chạy với người xem giả lập.
   - `http://localhost:3002/?event=matdien`: xem ngay cảnh mất điện.
   - `http://localhost:3002/?event=mua`: xem ngay cảnh trời mưa.
   - `?event=trom`: có trộm ngay · `?event=do`: đố vui ngay.

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
- Bật mất điện, trời mưa, có trộm, đố vui, cúp nước, gió to, mùa thi, kết thúc sự kiện, đọc một thông báo, bắn pháo hoa, tải lại màn hình live.
- Gọi hoạt cảnh: chốt thi đua tòa, chủ trọ thu tiền, xe kem chè, shipper, karaoke, đá cầu, lẩu, xe hoa, ba gác, mèo Mướp. Xóa dữ liệu xóm.
- Sửa mọi mục trong bảng dưới đây. Bấm **Lưu** là ghi vào `config.json` và áp dụng ngay. Riêng tên xóm (biển hiệu), số tầng, số phòng, tuyến buýt, điếu cày thì phải bấm **Tải lại màn hình live**.

Cổng mạng: Đi Chùa Online dùng 3000, Đua Thuyền Rồng dùng 3001, Xóm Trọ dùng 3002, nên không đụng nhau. Muốn xem trạng thái kết nối thì mở `http://localhost:3002/?debug`.

## Tùy chỉnh (`config.json`)
| Mục | Ý nghĩa |
|---|---|
| `tenXom` | Tên xóm, hiện ở tiêu đề và biển hiệu |
| `soTang`, `soPhongMoiTang`, `soPhongToaBen` | Số tầng (2–8), số phòng mỗi tầng của tòa giữa B (2–5) và của tòa trái A / phải C (2–7, bỏ trống = `soPhongMoiTang` + 2). Xóm có 3 tòa (A, B, C) xếp chữ U quanh sân chung (bể bơi, sân bóng rổ, sân chơi); tầng trệt là cửa hàng. Mặc định 6 tầng × (5 + 3 + 5) = 78 phòng |
| `tuyenBuyt` | Số tuyến xe buýt hiện trên xe và biển ở bến |
| `phutRoiXom` | Bao nhiêu phút không tương tác thì coi như đã rời live và ra bến lên xe (mặc định 8) |
| `hienDieuCay` | `true`/`false`: hiện hoặc ẩn cái điếu cày ở quán trà đá |
| `tenChuTro`, `xungHo` | Tên hiển thị và cách chủ trọ tự xưng ("chú", "bà", "cô"…). Nhớ sửa luôn các câu trong `thongBaoChuTro` |
| `nhacNen`, `amLuongNhac`, `fileNhac` | Bật/tắt nhạc nền, âm lượng nhạc, tên file nhạc trong `public/nhac/`. Không có file thì game tự chơi lofi |
| `giongDoc`, `caoGiong`, `tocDoDoc`, `docGiong` | Giọng đọc (mặc định `vi-VN-NamMinhNeural` như Đi Chùa Online; giọng nữ là `vi-VN-HoaiMyNeural`), độ cao giọng (`-4%`), tốc độ đọc, bật/tắt giọng |
| `timDeCoDien` | Số tim tối đa cần để có điện lại. Game tự giảm khi xóm ít người |
| `phutGiuaCacLanMatDien`, `phutGiuaCacLanMua` | Bao lâu thì có một lần mất điện, một lần mưa |
| `phutGiuaCacLanTrom`, `phutGiuaCacLanDo` | Bao lâu thì có trộm một lần (mặc định 6), đố vui một lần (mặc định 4) |
| `timDeCoNuoc`, `timDeOnThi` | Số tim tối đa cho cúp nước (200) và mùa thi (250) |
| `phutGiuaCacLanCupNuoc`, `phutGiuaCacLanGio`, `phutGiuaCacLanMuaThi` | Bao lâu có một lần cúp nước (11), gió to (9), mùa thi (13) |
| `phutGiuaCacLanThuTien`, `phutGiuaCacLanHangRong` | Bao lâu chủ trọ đi thu tiền (15), xe kem chè tự ghé (4) |
| `phutThiDua` | Số phút mỗi vòng thi đua giữa 3 tòa (mặc định 10) |
| `trangTriLe` | `tu-dong` (theo lịch), `tet`, `trungthu`, `noel` hoặc `khong` |
| `bloom` | `true`/`false`: đèn, cửa sổ, pháo hoa tỏa sáng. Tắt nếu máy yếu |
| `tuDongGiamDoHoa` | `true`: máy chạy dưới ~38 khung hình/giây thì tự tắt bloom rồi hạ độ nét |
| `quaySo`, `giayQuaySo` | Bật/tắt quay số may mắn ở đại lý vé số và bao nhiêu giây quay một lần (mặc định 60). Người xem comment một con số 00–99, ai gần nhất được xướng tên. Miễn phí, quà không ảnh hưởng |
| `cauDo` | Danh sách câu đố, mỗi dòng: `Câu hỏi \| đáp án \| đáp án khác…`. Đáp án so khớp không dấu, chỉ cần nằm trong comment. Để trống thì dùng bộ câu đố có sẵn |
| `phutNgayDem` | Bao nhiêu phút thì đổi ngày ↔ đêm (mặc định 2). Nút "Đổi ngày / đêm" ở trang quản trị đổi ngay |
| `giayMoiThongBao`, `thongBaoChuTro` | Bao lâu chủ trọ đọc thông báo một lần, và danh sách thông báo (thêm bớt thoải mái) |
| `amThanh`, `amLuong` | Âm thanh hiệu ứng (gõ cửa, tiền rơi, mưa, pháo hoa, rít điếu cày) |
| `tiengXe` | `true`/`false`: tiếng máy xe máy và xe buýt chạy ngoài đường |
| `tuCam` | Tên hoặc comment chứa các từ này sẽ không hiện |

Sửa trong trang quản trị thì áp dụng ngay. Nếu sửa tay `config.json` thì phải mở lại `BAT-LIVE.bat` rồi làm mới nguồn Link trong LIVE Studio.

## Lưu ý
- Game vẽ 3D bằng card đồ họa. Máy yếu có thể giật: game tự tắt bloom và hạ độ nét khi chậm; có thể mở `http://lvh.me:3002/?nethd=1` để vẽ nhẹ nhất ngay từ đầu, hoặc tắt bớt chương trình khác trong lúc live.
- Comment "điếu cày" / "thuốc lào" thì khách ngồi quán trà đá rít một hơi (tiếng ùng ục, nhả khói); khách đang ngồi quán thỉnh thoảng cũng tự rít. TikTok khá chặt với nội dung liên quan đến thuốc lá. Nếu buổi live bị cảnh báo hoặc bị giảm hiển thị, đặt `"hienDieuCay": false` (ẩn điếu cày, tắt luôn tiếng rít và khói).
- Giọng đọc dùng dịch vụ của Microsoft Edge nên cần mạng Internet. Máy cần có thiết bị phát âm thanh (loa, tai nghe hoặc VB-Cable).
- Mọi hình 3D và nhạc lofi mặc định đều được tạo bằng code, không dùng hình ảnh hay nhạc của người khác. Nếu tự đặt file nhạc, chỉ dùng nhạc bạn có quyền sử dụng, vì TikTok có thể tắt tiếng live khi gặp nhạc có bản quyền.
- Thư viện đọc sự kiện TikTok (`tiktok-live-connector`) là bản không chính thức. Nếu TikTok thay đổi hệ thống, chạy `npm update` trong thư mục game.
