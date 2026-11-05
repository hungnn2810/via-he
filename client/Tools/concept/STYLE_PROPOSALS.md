# Đề Xuất Khái Niệm Thiết Kế Nhân Vật — Vỉa Hè Online (Giai Đoạn 1)

**Vai trò:** Art Director kiêm Technical Artist  
**Mục tiêu:** Thiết kế lại bộ nhân vật người chơi cho game mobile *Vỉa Hè Online* (Unity 6, Android và iOS), đối tượng người chơi Việt Nam 18–35 tuổi.  
**Trạng thái hiện tại:** **Giai đoạn 1: Khái niệm** (chưa sửa code game, chờ duyệt phong cách trước khi sang Giai đoạn 2 Mẫu chuẩn).

---

## 1. Ràng buộc kỹ thuật cốt lõi (Technical Hard Constraints)

Mọi hướng thiết kế bên dưới đều được đo đạc và thử nghiệm trên hệ tọa độ pixel chuẩn của dự án:
1. **Khung hình chuẩn:** Mọi layer chia sẻ khung `160 x 256 px`, nền trong suốt (`transparent`). Chân chạm cạnh dưới (`y = 256`), đảm bảo khi các layer xếp chồng trong Unity `Character.cs` không cần bất kỳ offset pixel nào.
2. **Quy tắc xếp lớp (Layer Draw Order):**
   - `hairback_<gender>_<n>`: Layer `-1` (sau đầu)
   - `body_<gender>`: Layer `0` (thân, cổ, đầu, tai, mắt, mũi, nội y/đồ mặc định, giày dép)
   - `earrings_<n>`: Layer `1` (khuyên tai)
   - `cheeks_<n>`: Layer `2` (má hồng / tàn nhang)
   - `brows_<n>`: Layer `3` (lông mày)
   - `lips_<n>`: Layer `4` (môi / miệng)
   - `hair_<gender>_<n>`: Layer `5` (tóc trước)
   - `wear_<id>` (Quần áo theo thứ tự trong `Character.cs`):
     - `pants` (quần jean, quần kaki): Order `6` (nằm dưới áo)
     - `shirt` (áo ba lỗ, áo sơ mi hoa, áo dài): Order `7` (đè lên quần)
     - `hat` (nón lá, mũ bảo hiểm xanh, mũ lưỡi trai): Order `9` (đè lên tóc)
     - `acc` (kính râm, loa kẹo kéo): Order `10`
3. **Chu kỳ di chuyển (Walk Cycle):**
   - Gồm 3 tư thế: Đứng (`body_<gender>`), Bước 1 (`body_<gender>_step1`), Bước 2 (`body_<gender>_step2`).
   - Lật trái/phải bằng `transform.localScale.x = -1`. Thiết kế góc nhìn 3/4 được cân bằng để khi lật ngược chiều di chuyển vẫn tự nhiên, không bị méo lệch.
4. **Quy tắc mỹ thuật:**
   - Đường viền nâu mảnh đặc trưng (`#3a2416`), đổ bóng mềm (soft gradient).
   - Nét mặt nhỏ, tập trung ở nửa dưới khuôn mặt, vầng trán rộng hóm hỉnh.
   - Nhân vật là người lớn mang nét đời thường vỉa hè Việt Nam, vẽ để gây cười, ấm áp, không gợi dục, không theo khuôn mẫu anime chung chung.

---

## 2. Ba Hướng Phong Cách Đề Xuất

### HƯỚNG 1: "Hóm Hỉnh Đời Thường" (Chibi Comedic Street) — *Đề xuất chính*
> **Tệp vector:** `client/Tools/concept/concept-style-1-hom-hinh.svg`

* **Ý tưởng chủ đạo:** Khắc họa trọn vẹn nét duyên dáng, lười biếng, hài hước của đời sống vỉa hè Việt Nam. Nhân vật trông như anh chàng xóm trọ vui tính hay cô bạn gái bình dân bước ra từ một quán trà đá vỉa hè.
* **Tỷ lệ đầu / thân:** **1 : 2.05** (Chibi cân bằng)
  - Đầu: cao ~136 px (~53% tổng chiều cao). Hình khối quả lê tròn trĩnh, có đường nọng cằm nhẹ gây cười duyên.
  - Thân + Chân: cao ~120 px (~47%). Dáng đứng hơi chùng gối tự nhiên, nam có bụng hơi nhô nhẹ (bụng bia trà đá).
* **Nét mặt & Biểu cảm:**
  - Mắt hạt cườm đen nhánh (bead eyes) với đốm sáng tinh nghịch, đặt ở 1/3 dưới khuôn mặt.
  - Mũi là một nét móc cong mảnh tối giản.
  - Miệng nhỏ nhếch mép cười mỉm ngộ nghĩnh hoặc hé lộ răng thỏ duyên.
* **Trang phục mặc định:**
  - **Nam:** Áo ba lỗ trắng cổ khoét chữ U rộng có nếp gân nhẹ, quần đùi thể thao xanh dương đậm 2 sọc trắng xẻ tà, mang **dép tổ ong huyền thoại màu vàng nghệ** (có lỗ lưới tổ ong).
  - **Nữ:** Áo croptop thun ôm màu cam san hô ấm, quần short bò denim gấu sờn, **dép tông xỏ ngón màu hồng cánh sen**, khuyên tai tròn to mạ vàng.
* **Bảng màu:**
  - Viền nâu ấm: `#3a2416` (2.2 px)
  - Da bánh mật ấm: `#ffe4c7` $\rightarrow$ `#f0b887` $\rightarrow$ `#b87342`
  - Quần nam / Áo nữ: Xanh dương `#155aa8` / Cam san hô `#d94f35`
  - Dép tổ ong / Dép tông: Vàng nghệ `#e5a93b` / Hồng cánh sen `#c92850`
  - Denim: `#3f6d9f` / Tóc: Nâu sô-cô-la đen `#28130a`
* **Ưu điểm lớn nhất:** Rất "đời", gần gũi tức thì với game thủ Việt Nam 18–35 tuổi, tạo visual comedy tự nhiên, cực kỳ rõ nét ở kích thước nhỏ trên điện thoại.

---

### HƯỚNG 2: "Phố Cổ Mộc Mạc" (Retro Saigon / Hà Nội 90s)
> **Tệp vector:** `client/Tools/concept/concept-style-2-moc-mac.svg`

* **Ý tưởng chủ đạo:** Lấy cảm hứng từ tranh minh họa thiếu nhi Việt Nam thập niên 90 và phong cách cổ động hoài cổ (như các quán cà phê Cộng / tiệm trà cổ). Đậm chất mộc mạc, chất phác.
* **Tỷ lệ đầu / thân:** **1 : 2.35** (Thanh mảnh hoài niệm)
  - Đầu: cao ~124 px (~48% tổng chiều cao). Đầu thon gọn hơn, cằm nhỏ.
  - Thân + Chân: cao ~132 px (~52%). Tứ chi mảnh mai, uyển chuyển, uốn cong mềm mại.
* **Nét mặt & Biểu cảm:**
  - Đôi mắt híp cong hình trăng khuyết cười tít mắt (squint smile), lông mày sâu róm mộc mạc.
  - Má có chấm tàn nhang nhẹ, nốt ruồi duyên cạnh khóe miệng.
  - Nét mặt hiền hậu, thân thương, ấm áp của người buôn bán phố xưa.
* **Trang phục mặc định:**
  - **Nam:** Áo may ô ba lỗ dệt kim màu ngà cháo lòng (off-white gân sợi), quần đùi vải thô xanh rêu bộ đội có túi hộp gập nắp, **dép lốp cao su đen** (dép lào lốp xe). Tóc rẽ ngôi 7/3 hoài niệm.
  - **Nữ:** Áo lửng croptop thun vàng bơ cổ tròn, quần short kaki nâu hạt dẻ xắn gấu đính cúc gỗ, **dép rọ sandal be**, tóc bob ngắn mái ngố kẹp tăm màu sắc.
* **Bảng màu:**
  - Viền nâu hạt cà phê: `#342014` (2.0 px)
  - Da mật ong nung: `#fff0dc` $\rightarrow$ `#f5c292` $\rightarrow$ `#be7945`
  - May ô ngà: `#faf5ea` / Xanh rêu lính: `#375530`
  - Vàng bơ: `#ffeaa7` / Kaki sáp: `#b6895d` / Cao su đen: `#1e2226`
* **Ưu điểm lớn nhất:** Chạm đúng xu hướng retro/vintage đang rất được người trẻ 18–35 ưa chuộng; cực kỳ tôn dáng khi nhân vật khoác lên trang phục truyền thống như Áo dài, Nón lá, Sơ mi hoa.

---

### HƯỚNG 3: "Sắc Màu Gen Z" (Vibrant Pop Cartoon)
> **Tệp vector:** `client/Tools/concept/concept-style-3-gen-z.svg`

* **Ý tưởng chủ đạo:** Phong cách hoạt hình hiện đại với năng lượng bùng nổ, đầu siêu to tròn trịa, biểu cảm hài hước dạng sticker meme mạng xã hội.
* **Tỷ lệ đầu / thân:** **1 : 1.85** (Super Chibi)
  - Đầu: cao ~148 px (~58% tổng chiều cao). Trán dô tròn, má phúng phính căng múp míp.
  - Thân + Chân: cao ~108 px (~42%). Thân mình ngắn tí hon, tay chân tròn vo như củ khoai múp míp.
* **Nét mặt & Biểu cảm:**
  - Mắt to tròn với con ngươi ngoại cỡ và 2 đốm sáng anime lấp lánh (hoặc mắt tròn ngơ ngác poker-face).
  - Vệt má hồng tròn to nổi bật (`r = 14px`).
  - Khuôn miệng mèo lém lỉnh hoặc cười toác mép tinh quái.
* **Trang phục mặc định:**
  - **Nam:** Áo ba lỗ khoét nách sâu phong cách streetwear viền cyan, quần short dù bóng rổ xanh coban rực rỡ, **dép sục bánh mì màu vàng mù tạt**.
  - **Nữ:** Áo baby-tee croptop sọc ngang tím lavender và trắng, quần short biker thể thao đen xám, **dép bánh mì quai chéo màu xanh mint pastel**, khuyên tai nhựa tròn màu kẹo ngọt.
* **Bảng màu:**
  - Viền socola đậm: `#381e14` (2.4 px)
  - Da trắng hồng tươi sáng: `#fff5ea` $\rightarrow$ `#f8c69d` $\rightarrow$ `#c47a50`
  - Xanh Coban: `#0984e3` / Vàng mù tạt: `#fed330`
  - Tím Lavender: `#8b5cf6` / Xanh Mint: `#10b981` / Neon Pink: `#ec4899`
* **Ưu điểm lớn nhất:** Bắt mắt tức thì trên màn hình di động nhỏ 5–6 inch; độ tương phản cực cao không bao giờ bị chìm vào background phố; tính biểu cảm "meme" giúp người chơi thích thú chụp ảnh màn hình chia sẻ mạng xã hội.

---

## 3. Bảng So Sánh Tổng Hợp

| Tiêu chí | Hướng 1: Hóm Hỉnh Đời Thường *(Đề xuất)* | Hướng 2: Phố Cổ Mộc Mạc | Hướng 3: Sắc Màu Gen Z |
| :--- | :--- | :--- | :--- |
| **Tỷ lệ Đầu / Thân** | **1 : 2.05** (Đầu ~136px / Thân ~120px) | **1 : 2.35** (Đầu ~124px / Thân ~132px) | **1 : 1.85** (Đầu ~148px / Thân ~108px) |
| **Cảm giác hình thể** | Thoải mái, lười nhác tự nhiên, bụng bia nhẹ | Thanh mảnh, dẻo dai, mộc mạc hoài cổ | Tròn căng nảy, múp míp, siêu ngắn |
| **Đặc trưng Nam** | Áo ba lỗ trắng, quần đùi xanh, dép tổ ong | May ô ngà gân, quần rêu túi hộp, dép lốp | Ba lỗ khoét nách, quần bóng rổ, dép bánh mì |
| **Đặc trưng Nữ** | Croptop san hô, short jean, dép tông hồng | Áo lửng vàng bơ, short kaki nâu, dép rọ | Baby-tee tím sọc, short biker, dép mint |
| **Đường viền** | `#3a2416` (2.2 px) nâu ấm | `#342014` (2.0 px) nâu cà phê | `#381e14` (2.4 px) socola đậm |
| **Biểu cảm mặt** | Mắt hạt cườm, khóe miệng nhếch mép ngộ | Mắt híp cười hiền, nốt ruồi duyên, tàn nhang | Mắt to tròn long lanh, má hồng to, mặt meme |
| **Mức độ tương thích WEARABLES** | **Tối ưu nhất**: Khớp hoàn hảo cả mũ hiện đại lẫn truyền thống | **Rất tốt**: Rất đẹp với Áo dài, Nón lá, Sơ mi hoa | **Tốt**: Rất đẹp với Kính râm, Loa kéo, Mũ lưỡi trai |
| **Độ nhận diện trên màn hình 5"** | **Rất cao** | **Khá** (nét vẽ mảnh và hoài cổ hơn) | **Cực cao** (mắt to, tương phản gắt) |

---

## 4. Các Tệp Đã Tạo Trong Thư Mục `client/Tools/concept/`

1. `concept-style-1-hom-hinh.svg`: Chi tiết Nam và Nữ Hướng 1 kèm bảng màu và thông số.
2. `concept-style-2-moc-mac.svg`: Chi tiết Nam và Nữ Hướng 2 kèm bảng màu và thông số.
3. `concept-style-3-gen-z.svg`: Chi tiết Nam và Nữ Hướng 3 kèm bảng màu và thông số.
4. `concept-comparison.svg`: Bản vẽ so sánh tổng quan cả 6 nhân vật của 3 hướng trên cùng một thước đo.
5. `index.html`: Giao diện trực quan tương tác xem trước (có nút đổi nền vỉa hè, đổi zoom 0.7x / 1x / 1.3x).
6. `STYLE_PROPOSALS.md`: Tài liệu phân tích mỹ thuật và kiến trúc kỹ thuật này.

---

## 5. Quyết Định Cần Duyệt Trước Khi Sang Giai Đoạn 2

Xin mời Art Director / Producer lựa chọn:
- **Lựa chọn phong cách:** Bạn muốn chọn **Hướng 1**, **Hướng 2**, hay **Hướng 3**?
- **Góp ý tinh chỉnh (nếu có):** Bạn có muốn điều chỉnh thêm chi tiết nào ở trang phục mặc định, kiểu mắt hay phụ kiện của hướng được chọn trước khi triển khai **Giai đoạn 2 (Mẫu chuẩn: đủ layer, đủ 3 tư thế đi bộ, xuất PNG và ảnh tổng hợp trên nền phố)** không?
