# Bản Đặc Tả Thiết Kế Giao Diện — Phong Cách Hàng Rong Mobile
**Dự án:** Vỉa Hè Online (Unity 6 / Web / Mobile)  
**Tài liệu tham chiếu:** [Tải game Hàng Rong Mobile - Cuộc sống đường phố | Game mô phỏng (Thegioididong.com/game-app/hang-rong-mobile-232331)](https://www.thegioididong.com/game-app/hang-rong-mobile-232331)  
**Phụ trách:** Antigravity (UI/UX Designer & Technical Artist)  
**Trạng thái:** Bản thiết kế hoàn chỉnh & Mô hình mẫu trực quan (Phase 1)

---

## 1. Tinh Thần Cốt Lõi Của "Hàng Rong Mobile"

Bài viết trên Thế Giới Di Động mô tả về **Hàng Rong Mobile**:
> *"Hàng Rong Mobile là tựa game mô phỏng kinh doanh đường phố, đưa người chơi trở về những ký ức tuổi thơ gần gũi nhất: từ gánh hàng rong, tiệm tạp hóa, xe bánh mì, ly trà đá vỉa hè... Đồ họa 2D mang đậm phong cách hoạt hình ngộ nghĩnh, hài hước, màu sắc rực rỡ và tái hiện chân thực nhịp sống đường phố Việt Nam."*

### Điểm Khác Biệt Giữa UI Hiện Tại Và UI Hàng Rong Mobile:
| Tiêu chí | Giao diện Vỉa Hè Online (Cũ) | Giao diện Hàng Rong Mobile (Mới Thiết Kế) |
| :--- | :--- | :--- |
| **Bản sắc thị giác (Theme)** | Hiện đại, phẳng, tone xanh dương lạnh lẽo | **Mộc mạc, hoài niệm, ấm áp**: Gỗ vintage, giấy kraft, ruy-băng đỏ, cờ nheo, vàng kim loại |
| **Khung cửa sổ (Window/Panel)** | Khung xanh viền trắng đơn điệu (`#1c5fa8`) | **Bảng nẹp gỗ bo góc**, ốc vít đồng 4 góc, nền giấy da/giấy kraft ngà sạch sẽ |
| **Nút bấm (Buttons)** | Nút gradient phẳng, viền mỏng | **Nút kẹo ngọt bo tròn 3D (Candy Glossy Buttons)** có highlight bóng kính và bóng đổ dày đàn hồi |
| **Thanh trạng thái (Top HUD)** | Các ô chữ nhật xám đen (`rgba(30,20,10,.62)`) | **Cụm huy hiệu viên thuốc viền gỗ vàng**, khung avatar tròn mạ vàng, sao cấp độ nảy khối |
| **Thanh công cụ đáy (Bottom Dock)**| Hàng nút xếp ngang trên vỉa hè | **Bục gỗ vỉa hè nẹp chỉ vàng**, 8 icon comic chibi nổi bật kèm huy hiệu đỏ thông báo |
| **Trình bày mặt hàng (Item Cards)** | Dòng chữ dài nằm ngang | **Thẻ bài dạng lưới (Grid Cards)**: Hình món ăn to rõ, đầy đủ Vốn - Giá bán - Lãi - Thời gian |

---

## 2. Hệ Thống Design Tokens & Bảng Màu Chuẩn

### 2.1. Bảng màu vật liệu (Material Palette)
* **Gỗ Nâu Trầm (Wood Frames & Bevels):**
  - Viền ngoài tối: `#2b1404` / `#341806`
  - Bề mặt nẹp gỗ: `#542c10` $\rightarrow$ `#73411b` (Độ dốc bóng tự nhiên)
  - Viền chỉ nẹp đồng: `#f1c40f` (Vàng brass vintage)
* **Giấy Kraft & Giấy Da Ngà (Parchment Inner Boards):**
  - Giấy kraft sáng: `#fffdf5`
  - Giấy da ngà trung tính: `#fdf8e8` $\rightarrow$ `#f5e8cc`
  - Đường kẻ chỉ carô/sọc mờ: `#ecd9b6`
* **Ruy-băng Tiêu Đề Đỏ Hội Hè (Festive Header Ribbons):**
  - Sắc đỏ rực rỡ: `#ff4757` $\rightarrow$ `#ee5253` $\rightarrow$ `#b33939`
  - Nếp gấp tối 3D: `#871c1c` / `#4d0e0e`
  - Đường chỉ thêu vàng: `#fed330`
* **Bộ Nút Bấm Kẹo Ngọt (Candy Glossy Buttons):**
  - **Cam Bày Bán / Hành Động Chính:** Gradient `#ffa502` $\rightarrow$ `#ff7f50` $\rightarrow$ `#e65100` $\rightarrow$ `#b23b00`
  - **Xanh Lá Nhập Hàng / Mua Sắm:** Gradient `#7bed9f` $\rightarrow$ `#2ed573` $\rightarrow$ `#1e9e50` $\rightarrow$ `#147539`
  - **Xanh Lam Tiện Ích / Xã Hội / Chat:** Gradient `#70a1ff` $\rightarrow$ `#1e90ff` $\rightarrow$ `#0960bd` $\rightarrow$ `#064283`
  - **Đỏ Hủy / Đóng Bảng:** Gradient `#ff6b81` $\rightarrow$ `#ff4757` $\rightarrow$ `#c0392b` $\rightarrow$ `#96281b`
  - **Xám Vô Hiệu / Khóa:** Gradient `#dcdde1` $\rightarrow$ `#bdc3c7` $\rightarrow$ `#7f8c8d`

### 2.2. Đường viền và hiệu ứng (Strokes & Shadows)
* **Đường viền Comic chủ đạo (Outline):** Nâu hạt cà phê `#3a2416` (Độ dày 2.5px - 3.5px tùy kích thước).
* **Bóng đổ 3D đáy nút (Button Base):** Offset `dy = 4px`, màu `#2b1404`.
* **Bóng đổ khung Panel (Drop Shadow):** Blur `12px`, offset `dy = 8px`, màu `#1e1005` với opacity 45%.

---

## 3. Kiến Trúc Chi Tiết Các Cụm Giao Diện

### 3.1. Top HUD (Thanh Trạng Thái Đỉnh)
Khung canvas tham chiếu chuẩn `1280 x 720 px`:
1. **Khung Avatar & Cấp Độ (Tọa độ `x = 24, y = 16`):**
   - Kích thước `310 x 74 px`, bo tròn hình viên thuốc viền gỗ nẹp vàng.
   - Vòng tròn Avatar `r = 37px`, viền kim loại vàng bóng, chân dung Chibi hóm hỉnh bên trong.
   - Ngôi sao vàng 5 cánh Cấp Độ (Level Star) gắn ở góc 5 giờ, số cấp màu đen comic nổi bật.
   - Thanh đo Kinh Nghiệm (EXP Tube Gauge): Kích thước `206 x 22 px`, dải gradient tím lavender phản quang `#c56cf0` $\rightarrow$ `#5f27cd`, hiển thị số KN và tỷ lệ phần trăm (vd: `390 / 600 KN (65%)`).
2. **Cụm Năng Lượng & Kinh Tế (Tọa độ `y = 22`):**
   - **Thể Lực (Stamina):** Viên thuốc gỗ `145 x 52 px`, icon Tia Chớp Sét vàng ⚡ viền cam, hiển thị `18 / 20` (năng lượng buôn bán và sang quậy xóm trọ).
   - **Tiền Mặt (Cash):** Viên thuốc gỗ `205 x 52 px`, icon Đồng Tiền Xu Vàng ₫ viền đỏ, hiển thị số tiền có định dạng phân cách hàng nghìn (vd: `1.450.000 đ`).
   - **Kho Hàng (Capacity):** Viên thuốc gỗ `145 x 52 px`, icon Thùng Carton 📦, hiển thị sức chứa món ăn trong kho (vd: `38 / 60`).
3. **Biển Tên Phố & Thời Tiết (Tọa độ `x = 980, y = 16`):**
   - Biển hiệu gỗ treo xích đồng hoặc ruy-băng đỏ cờ nheo `256 x 58 px`: `"PHỐ TRÀNG TIỀN · KHU 1"`.
   - Dòng phụ trạng thái thời tiết/sự kiện: `☀️ Khách đông (+25%)` hoặc `🌧️ Mưa phùn - Bán đồ nóng`.

---

### 3.2. Cửa Sổ Bật Lên (Modal Window) — Tiêu Chuẩn "Bảng Tạp Hóa Vỉa Hè"
Kích thước chuẩn `640 x 480 px`, đặt căn giữa màn hình:
1. **Khung Nẹp Gỗ Vintage:**
   - Bo góc mềm `rx = 22px`, vân gỗ nâu sẫm, nẹp chỉ vàng brass.
   - 4 đinh tán đồng ở 4 góc chống cong vênh.
2. **Ruy-băng Tiêu Đề Đỏ (Header Ribbon):**
   - Rộng `420 x 60 px`, nhô cao khỏi cạnh trên panel `22px`.
   - Hai dải đuôi cá gấp nếp 3D ở hai bên.
   - Chữ tiêu đề in hoa đậm nét, viền nổi comic: `"NHẬP HÀNG ĐẦU MỐI"`, `"KÊ BÀN BÁN HÀNG"`, `"TIỆM TẠP HÓA"`.
3. **Nút Đóng ✕ Tròn Nổi:**
   - Bán kính `r = 22px`, màu đỏ tươi viền trắng viền bóng 3D, đặt đè lên góc phải trên khung gỗ (`x = 605, y = 5`).
4. **Hệ Thống Tab Gỗ Phân Loại:**
   - 4 tab nằm ngang trên đầu nền giấy: `[ 🍜 Đồ Ăn Vặt ]`, `[ 🥤 Giải Khát ]`, `[ 🪀 Đồ Chơi ]`, `[ ⭐ Nâng Cấp ]`.
   - Tab kích hoạt nổi bật với màu cam vàng và chiều cao nhô hơn 4px.
5. **Lưới Thẻ Mặt Hàng (Item Cards 2x2 Grid):**
   - Mỗi thẻ bài kích thước `280 x 165 px`, bo góc `14px`, nền giấy trắng ngà viền nâu hạt dẻ.
   - Ô hình thumbnail món ăn `76 x 76 px` có viền tròn: Hình vẽ Bánh mì kẹp, Kem chuối cốt dừa, Ly trà đào, Đĩa nem chua rán...
   - Cột thông số kinh doanh cực kỳ trực quan:
     - Giá vốn (Chi phí nhập): màu đỏ cam (`8.000 đ`)
     - Giá bán (Doanh thu): màu xanh lá (`18.000 đ`)
     - Lợi nhuận ròng & Thời gian bán: màu cam đậm (`Lãi: +10.000 đ (15 phút)`)
   - Nút bấm hành động toàn chiều rộng thẻ: `[ BÀY BÁN NGAY ]` (Xanh lá/Cam bóng bẩy) hoặc `[ CHƯA MỞ KHÓA 🔒 ]` (Xám).

---

### 3.3. Bottom Dock (Thanh Công Cụ Đáy Màn Hình)
Kích thước `840 x 90 px`, bo góc `20px`, nằm ở góc dưới bên trái (`x = 24, y = 615`):
* Gồm **8 nút chức năng Hàng Rong** xếp đều:
  1. **Dọn Hàng:** Icon sạp hàng mái che sọc đỏ trắng vỉa hè.
  2. **Chợ Sỉ:** Icon xe tải nhỏ chở hàng (khi mở chợ sẽ phát sáng viền vàng).
  3. **Kho Đồ:** Icon thùng carton mở nắp đựng hoa quả/chuối.
  4. **Nhân Viên:** Icon cậu bé phụ quán xì-tin đội mũ ngược.
  5. **Hàng Xóm:** Icon dãy nhà phố kèm **huy hiệu đỏ thông báo `(3)`** báo có 3 nhà cần dọn rác/tưới cây.
  6. **Nhiệm Vụ:** Icon sổ tay bìa đỏ có bút chì và dấu tích hoàn thành.
  7. **Tủ Đồ:** Icon móc áo treo áo thun hoa sặc sỡ.
  8. **Xe Buýt:** Icon xe buýt xanh đưa người chơi du ngoạn các phố khác.
* **Khung Chat Phố Xá (`x = 880, y = 625`):**
  - Khung gỗ bo tròn `376 x 70 px`.
  - Ô nhập liệu màu giấy ngà: `"Nói gì đó với xóm phố..."`.
  - Nút `"NÓI"` xanh lam bóng bẩy bên cạnh.

---

## 4. Các Tệp Triển Khai Được Tạo Mới

1. **Tệp Vector Mockup Đầy Đủ 1280x720:**  
   `client/Tools/concept/ui-hang-rong-mockup.svg`  
   Tái hiện trọn vẹn 100% màn hình game: Phố xá Hà Nội/Sài Gòn, sạp hàng bánh mì của Bác Ba, dù che vỉa hè, bàn ghế nhựa con, khách đòi ăn, tiền bay `+15.000đ`, toàn bộ Top HUD, Bottom Dock, và Cửa sổ popup Nhập hàng.
2. **Trang Viewer Tương Tác Trực Quan:**  
   `client/Tools/concept/ui-hang-rong-viewer.html`  
   Cho phép mở trình duyệt để:
   - Chuyển đổi các chế độ xem: Toàn cảnh / Chỉ màn hình phố / Chỉ Modal / Chỉ HUD & Dock.
   - Thu phóng 100% (1280x720), 125%, 150%.
   - Bấm thử nghiệm trực tiếp 4 loại nút bấm kẹo ngọt (Candy Buttons) với âm thanh tương tác.
   - Bảng tra cứu Color Swatches.

---

## 5. Kế Hoạch Đưa Vào Mã Nguồn Game (Unity & Sprites)

Khi người dùng duyệt bản thiết kế này, các bước kỹ thuật tiếp theo sẽ bao gồm:
1. **Cập nhật `client/Tools/sprites.js`**:
   - `ui_panel`: Vẽ lại bằng Canvas 2D theo dạng bảng nẹp gỗ vintage viền vàng + nền giấy kraft ngà (9-slice `[32, 32, 32, 32]`).
   - `ui_ribbon`: Vẽ lại ruy-băng đỏ nếp gấp 3D với viền chỉ vàng chanh.
   - `ui_button_*`: Nâng cấp gradient lên chuẩn Candy Glossy (thêm vệt highlight trắng và đường bóng đáy đậm).
   - `ui_avatar_frame`: Viền gỗ mạ vàng đính ốc vít.
   - `ui_bar` & `ui_bar_fill`: Ống thủy tinh phản quang đo EXP tím lavender và Thể lực vàng.
   - Thêm các icon mới cho Bottom Dock (`icon_truck`, `icon_crate`, `icon_neighbor_badge`).
2. **Cập nhật `client/Assets/Scripts/UIBuilder.cs`**:
   - Thêm màu sắc text mới: `TextTitleRed`, `TextWood`, `TextGold`.
   - Bổ sung hàm tạo `ItemCard` lưới 2 cột cho các cửa sổ Kê bàn, Nhập hàng, Trồng trọt.
3. **Cập nhật `client/Assets/Scripts/Game.cs`**:
   - Áp dụng bố cục Top HUD viên thuốc gỗ và Bottom Dock bục gỗ.
