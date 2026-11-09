# Bản Đặc Tả Bố Cục Giao Diện (đề xuất)

> ## ⚠ Trạng thái: phần **phong cách thị giác** của tài liệu này đã bị thay thế
>
> Tài liệu nguồn của style giờ là **`docs/client/art-direction.md`**, và bảng màu /
> token thật nằm ở **`client/Tools/theme.js`** + **`client/Assets/Scripts/Theme.cs`**.
>
> **Vì sao:** bản đặc tả này dựng từ một bài báo mô tả **Hàng Rong Mobile** (bản fan làm
> lại trên di động), không phải từ **Hàng Rong gốc trên Zing Me**. Nó mô tả theme gỗ
> vintage + giấy kraft + ruy-băng đỏ. Khi đối chiếu với screenshot và video quay bản gốc
> (`client/Tools/ui_ref/`, `street_source*.png`), bản gốc **không** như vậy: đó là
> cartoon bóng, nền trắng và xanh cyan, dock navy, và có **6 skin cửa sổ** khác nhau chứ
> không phải một.
>
> **Phần còn dùng được:** cấu trúc tài liệu, ý tưởng item card dạng lưới, danh sách nút
> trong dock, hệ tab, và các toạ độ bố cục ở §3 — xem chúng là **đề xuất bố cục**, không
> phải quan sát từ bản gốc.

**Dự án:** Vỉa Hè Online (Unity 6 / Web / Mobile)
**Phụ trách ban đầu:** Antigravity (UI/UX Designer & Technical Artist)
**Nguồn tham chiếu cũ:** một bài viết về bản mobile remake — không dùng cho style nữa

---

## 1. Tinh Thần Cốt Lõi

Game mô phỏng kinh doanh đường phố Việt Nam: gánh hàng rong, tiệm tạp hóa, xe bánh mì,
trà đá vỉa hè. Đồ họa 2D hoạt hình, màu rực, nhịp sống đường phố.

Tinh thần đó giữ nguyên. Chỉ có cách thể hiện là đổi: theo bản gốc Zing Me, không theo
bản mobile remake.

### Khác biệt so với giao diện cũ của Vỉa Hè Online

| Tiêu chí | Giao diện cũ (đã xoá) | Hướng mới (theo bản gốc Zing Me) |
| :--- | :--- | :--- |
| **Bản sắc thị giác** | Hiện đại, phẳng, tone xanh dương lạnh | **Cartoon bóng, màu rực**: nền trắng/kem và xanh cyan, viền nâu-đen mảnh ~2–3px trên mọi thứ |
| **Khung cửa sổ** | Một khung xanh viền trắng dùng chung (`#1c5fa8`) | **Một frame primitive có tham số skin** — hổ phách cho danh sách/log, xanh dương cho form. Mỗi skin: dải màu dày + keyline sáng bên trong + board lõm |
| **Nút bấm** | Gradient phẳng, viền mỏng, đổi màu lúc nhấn | **Ba state vẽ thật** (`_normal` / `_pressed` / `_disabled`): gờ tối bên dưới tạo độ dày, gloss nửa trên, nhấn thì hạ xuống và mất gloss |
| **Nút đóng** | Nút chữ ✕ vuông | **Badge tròn** ghim đè lên góc trên-phải khung |
| **Số hiển thị** | Chữ trắng | **Vàng hổ phách viền tối**; trong câu, số lợi đọc xanh dương, số chi phí đọc đỏ |
| **Trình bày mặt hàng** | Dòng chữ dài nằm ngang | **Thẻ bài dạng lưới**: hình món to rõ, đủ Vốn – Giá bán – Lãi – Thời gian |

---

## 2. Design Tokens — xem `theme.js`, đừng chép số ở đây

Bảng màu gỗ/kraft/ruy-băng đỏ trong bản đặc tả gốc đã bị gỡ khỏi mục này: nó mô tả bản
mobile remake, và việc giữ một bảng màu thứ hai trong tài liệu chính là lý do trước đây
màu bị hardcode ở hai nơi rồi lệch nhau.

**Nguồn duy nhất:**

| Việc | Đọc từ |
| :--- | :--- |
| Code vẽ sprite (`sprites.js`) | `client/Tools/theme.js` |
| Code layout (C#) | `client/Assets/Scripts/Theme.cs` |
| Lý do đằng sau từng lựa chọn | `docs/client/art-direction.md` |

Tóm tắt những gì hai file đó định nghĩa — **không** phải để chép lại, chỉ để định hướng:

* **Viền (`INK`)** — nâu-đen đậm, dùng cho mọi thứ. Độ dày theo `STROKE`: 2 / 3 / 4.5.
* **Skin cửa sổ (`SKIN`)** — `amber` và `blue`. Mỗi skin có `frameLight` → `frame` →
  `frameDark`, một `keyline` sáng, và board bên trong kèm đường kẻ.
* **Board** — kem (`COLOR.cream`) cho skin hổ phách, xanh rất nhạt cho skin xanh.
* **Nút (`BUTTON`)** — 5 vai: `green`, `blue`, `red`, `gold`, `gray`. Mỗi vai có `top` /
  `mid` / `low` / `rim`, dựng ra 3 state vẽ thật.
* **Chữ hiển thị** — `COLOR.gold` viền tối. Trong câu: `figureGain` xanh dương cho khoản
  lợi, `figureCost` đỏ cho chi phí.
* **`RADIUS`, `BORDER`, `SIZE`, `SPACE`, `TYPE`, `SHADOW`** — bán kính bo, bảng border
  9-slice, kích thước frame sprite, thang khoảng cách, thang cỡ chữ, bóng đổ.

Bản gốc dùng **6 skin cửa sổ** (hổ phách, xanh dương, giấy cuộn, gỗ, overlay, novelty).
Mới dựng 2 skin đầu — xem `docs/client/art-direction.md` để biết 4 cái còn lại trông
thế nào khi cần tới.

---

## 3. Kiến Trúc Chi Tiết Các Cụm Giao Diện

> **Đọc mục này như đề xuất bố cục, không phải quan sát từ bản gốc.** Toạ độ, kích thước
> và cách chia cụm vẫn dùng được. Nhưng mọi mô tả vật liệu (nẹp gỗ, ốc vít đồng, giấy
> kraft, ruy-băng đỏ, ống thủy tinh) thì thay bằng skin trong `theme.js`.
>
> Ba chỗ mâu thuẫn trực tiếp với bản gốc, sửa khi dựng:
> * **Tiêu đề** không phải ruy-băng đỏ có đuôi cá — bản gốc dùng một tấm plate sẫm
>   (`title_plate`) với chữ vàng viền tối, nằm vắt ngang dải trên của khung.
> * **Nút đóng** không phải đỏ viền trắng — bản gốc là **badge tròn xanh dương** ghim đè
>   góc trên-phải (`btn_close`).
> * **Cụm HUD** không phải viên thuốc nẹp gỗ — bản gốc là huy hiệu trắng viền tối, số
>   vàng viền tối, thanh EXP dạng capsule mảnh.

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

## 4. Tham Chiếu Thị Giác & Mockup

> Hai file mockup theo theme gỗ/kraft cũ (`ui-hang-rong-mockup.svg` và `ui-hang-rong-viewer.html`)
> đã được gỡ bỏ khỏi dự án để tránh nhầm lẫn với kế hoạch Remaster Hàng Rong Zing Me chính thức.
> 
> Ảnh tham chiếu thật của bản gốc Zing Me nằm ở `client/Tools/street_source_2.png` và
> `client/Tools/ui_ref/` (được cắt bằng `python client/Tools/cut_ui.py`).
> Đặc tả chuẩn được lưu tại `docs/client/art-direction.md`.

---

## 5. Trạng Thái Triển Khai

Kế hoạch triển khai cũ ở mục này đã lỗi thời: nó bảo sửa `ui_panel`, `ui_ribbon`,
`ui_button_*`, `UIBuilder.cs` và `Game.cs` — **tất cả đều đã bị xoá** trong đợt làm lại
client (xem `docs/client-remaster-plan.md`). Thay bằng trạng thái thật:

### Đã có

| Thành phần | Nơi |
| :--- | :--- |
| Design tokens | `client/Tools/theme.js`, `client/Assets/Scripts/Theme.cs` |
| Frame primitive có tham số skin | `client/Tools/sprites.js`, hàm `windowFrame()` |
| 25 sprite UI đã export | `client/Assets/Resources/Sprites/` + `sprites.txt` |

25 sprite gồm: `panel_amber`, `panel_blue`, `board_cream`, `board_blue`, `row_card`,
`slot_item`, `btn_{green,blue,red,gold,gray}_{normal,pressed,disabled}`, `btn_close`,
`progress_track`, `progress_fill`, `title_plate`.

Tra tên sprite qua `Theme.PanelSprite()`, `Theme.BoardSprite()`, `Theme.ButtonSprite()` —
đừng viết chuỗi tên thẳng trong code layout.

### Chưa có

1. **Widget kit** dựng trên `Theme.cs`: `Screen`, `Modal`, `ListView` (phải pool row —
   bản cũ dựng lại toàn bộ row mỗi lần mở, gây GC spike trên Android tầm trung), `Card`,
   `StatChip`, `IconButton`, `Toast`, `Confirm`, `EmptyState`.
2. **Icon** — cần ~40 cái, hiện chưa vẽ cái nào. Danh mục trong `docs/client/art-direction.md`.
3. **Item card** theo §3.2 — vẫn là ý tưởng tốt, dựng bằng `row_card` + `slot_item`.
4. **Top HUD và Bottom Dock** theo §3.1 và §3.3.
5. **Scene** (Wave 2) — `smoke-test-game` không pass được cho tới khi có.

### Quy ước phải giữ

* Chữ người chơi đọc giữ tiếng Việt; mọi định danh, tên file, tên sprite bằng tiếng Anh
  (`CLAUDE.md`).
* Mỗi nút / icon / nhân vật / đồ vật là **một sprite riêng**, bố cục ghép bằng code.
  Không bao giờ vẽ nguyên một màn hình thành một ảnh.
* Lấy từ ảnh tham chiếu là **ngôn ngữ thị giác** — palette, độ dày viền, giải phẫu panel,
  tỉ lệ. Đồ nội thất giao diện dựng thẳng theo ngôn ngữ đó; còn nhân vật, linh vật, biển
  hiệu, logo thì **thiết kế mới**, không chép lại từ bản gốc.
* Sau khi sửa `sprites.js`: chạy `node client/Tools/export-runner.mjs`.
