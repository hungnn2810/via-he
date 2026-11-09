# Screens

Extracted from `Game.cs` and `GameExpansion.cs` before they were deleted.
The Vietnamese strings are player-facing copy and must be carried over verbatim
into the rebuilt UI. `{...}` are C# interpolations.

## client/Assets/Scripts/Game.cs

### ShowLogin

- Player-facing text (9):

  - `VỈA HÈ ONLINE`
  - `Tên của bạn`
  - `Nhập tên...`
  - `Máy chủ`
  - `Mã khôi phục (khi đổi máy)`
  - `Bỏ trống nếu chơi mới`
  - `VÀO PHỐ`
  - `Đang kết nối...`
  - `Không vào được: `

### StartPlaying

- Player-facing text (6):

  - `Thu được {Network.Money(amount)} từ cửa hàng`
  - `Cửa hàng chưa có tiền để thu`
  - `Giao đủ đơn hàng! Thưởng {Network.Money(reward)}`
  - `Chúc mừng! Bạn lên cấp {m.level}`
  - `{m.name} lên cấp {m.level}`
  - `Mất kết nối với phố. Bấm Về nhà để vào lại.`

### AskForCharacter

- Sends: `createCharacter`

### BuildHud

- Sends: `shuttleKick`, `say`
- Player-facing text (11):

  - `ĐÁ!`
  - `Dọn hàng`
  - `Nhân viên`
  - `Tủ đồ`
  - `Cửa hàng`
  - `Nhật ký`
  - `Xe buýt`
  - `Về nhà`
  - `Thêm`
  - `Nói gì đó...`
  - `Nói`

### RefreshHud

- Player-facing text (18):

  - `Chào cháu! Bãi đất này giờ là của cháu. Chạm vào ô đất, chọn Chuối để trồng nhé.`
  - `Tốt lắm! Chạm vào cây chuối để tưới, cây sẽ chín nhanh hơn.`
  - `Giờ chờ chuối chín, rồi chạm vào cây để thu hoạch.`
  - `Có chuối rồi! Chạm vào ô trống trên vỉa hè, chọn Chuối để dọn hàng.`
  - `Chạm vào khách muốn mua chuối để mời họ tới sạp của cháu.`
  - `Bán giỏi lắm! Giờ chạm ô đất trống trồng thêm vụ chuối nữa, vụ này chín sau 10 phút.`
  - `Xây quán cho phố đông vui nào. Chạm ô đất trống, chọn Quán trà đá. Thiếu tiền thì bán thêm nhé.`
  - `Hàng xóm đang cần giúp đấy. Bấm Xe buýt để sang một phố khác nhé.`
  - `Về phố mình thôi. Chuối chín thì chạm vào cây để thu hoạch.`
  - `Trồng một vụ mới trước khi nghỉ nhé. Vụ này lâu hơn, cháu quay lại là vừa chín.`
  - `Chạm vào cây chuối trên phố này để tưới giúp, cả hai cùng có thưởng.`
  - `Cảm ơn cháu! Bấm Về nhà để quay lại phố mình.`
  - `Bảng phố nổi tiếng`
  - `Hoạt động xóm phố`
  - `Xe cộ`
  - `Đơn giao`
  - `Bản đồ khu phố`
  - `Nghề`

### RefreshBar

- Player-facing text (10):

  - `Dọn hàng`
  - `Xe buýt`
  - `Về nhà`
  - `Nhật ký`
  - `Thêm`
  - `Tủ đồ`
  - `Cửa hàng`
  - `Nhân viên`
  - `Trưởng xóm: mở thêm `
  - ` cho cháu rồi đấy!`

### RefreshTutorial

- Player-facing text (2):

  - `Bán được nải đầu tiên rồi, giỏi lắm cháu!`
  - `Xong rồi! Nhật ký và Thêm đã mở. Chuối và quán trà sẽ chờ cháu quay lại.`

### Toast


### Update

- Player-facing text (1):

  - `Sự kiện: `

### OpenWindow


### RunStreetAction


### OpenStallWindow

- Player-facing text (7):

  - `Phố hết chỗ dọn hàng rồi, đi xe buýt sang phố khác nhé`
  - `Dọn hàng ô {slot + 1}`
  - `Chọn món và người đứng bán. Hàng thừa được hoàn tiền hoặc trả về kho khi dọn sạp.`
  - `trong kho {Stock(product.id)} → bán {Network.Money(product.price)}`
  - `nhập {Network.Money(product.cost)} → bán {Network.Money(product.price)}`
  - `{product.name}   (mở ở cấp {product.unlockLevel})`
  - `Tự bán`

### OpenStall

- Sends: `openStall`
- Player-facing text (3):

  - `Kho hết hàng này rồi`
  - `Không đủ tiền nhập hàng`
  - `Dọn {quantity} phần {product.name}. Chạm vào khách đi ngang để mời!`

### AskCloseStall

- Window title: `Sạp của bạn`
- Sends: `closeStall`
- Player-facing text (6):

  - `Sạp của bạn`
  - `{product?.name} còn {s.remaining} phần. Người bán: {s.sellerName}`
  - `Dọn sạp sẽ trả {s.remaining} nải chuối về kho.`
  - `Dọn sạp sẽ hoàn {Network.Money(s.remaining * (product?.cost ?? 0))} tiền hàng còn lại.`
  - `Dọn sạp`
  - `Bán tiếp`

### OpenStaff

- Window title: `Nhân viên`
- Sends: `setGardener`, `fire`, `hire`
- Player-facing text (14):

  - `Nhân viên`
  - `Đã thuê {p.employees.Count}/{p.maxEmployees}. Đẹp: hút khách · Khéo: bán nhanh · Khỏe: chở nhiều hàng. Nhân viên đứng sạp vẫn bán khi bạn rời phố. Lương trả mỗi ngày.`
  - `{employee.name} ({TraitName(employee.trait)})   Đẹp {employee.charm} · Khéo {employee.skill} · Khỏe {employee.strength} · Lương {Network.Money(Wage(employee))}`
  - `Thôi trông vườn`
  - `Trông vườn`
  - `Cho nghỉ`
  - `Người xin việc`
  - `{candidate.name} ({TraitName(candidate.trait)})   Đẹp {candidate.charm} · Khéo {candidate.skill} · Khỏe {candidate.strength}`
  - `Thuê {Network.Money(candidate.hireCost)}`
  - `Nhanh nhảu`
  - `Dẻo miệng`
  - `Chăm vườn`
  - `Hay buôn chuyện`
  - `Bình thường`

### OpenBarber

- Sends: `changeLook`

### OpenMenu

- Window title: `Thêm`
- Sends: `professionHelp`, `collectIncome`, `addFriend`, `report`, `tidyStreet`, `giveGift`, `donateBananas`, `claimCommunity`
- Player-facing text (23):

  - `Thêm`
  - `Bản đồ khu phố`
  - `Kho hàng`
  - `Hàng xóm`
  - `Hoạt động xóm phố`
  - `Đơn giao`
  - `Xe cộ`
  - `Nghề`
  - `Giúp phố này bằng nghề của bạn`
  - `Việc hằng ngày`
  - `Bảng phố nổi tiếng`
  - `Thu tiền các cửa hàng`
  - `Kết bạn với {st.ownerName}`
  - `Báo cáo phố này`
  - `Đã gửi báo cáo`
  - `Dọn phố cùng cả xóm`
  - `Đồ trang trí dịp lễ`
  - `{st.eventName}: cả game đã góp {st.communityProgress:#,0}/{st.communityTarget:#,0} nải`
  - `Góp {Math.Min(20, Stock(`
  - `))} nải chuối`
  - `Nhận thưởng lễ hội`
  - `Mã khôi phục: {p.recoveryCode}. Giữ mã này để lấy lại tài khoản khi đổi máy.`
  - `Danh hiệu: `

### OpenDecorations

- Window title: `Đồ trang trí`
- Sends: `buyDecoration`
- Player-facing text (3):

  - `Đồ trang trí`
  - `Mua trong dịp lễ, giữ mãi trên phố của bạn.`
  - `Đã có`

### OpenDaily

- Window title: `Việc hằng ngày`
- Player-facing text (2):

  - `Việc hằng ngày`
  - `Bác tổ trưởng giao việc mỗi ngày. Xong mỗi việc nhận 20.000đ và 15 kinh nghiệm.`

### OpenLeaderboard

- Player-facing text (7):

  - `Không tải được bảng xếp hạng: `
  - `Phố nổi tiếng mùa {board.season}`
  - `{rank}. Phố {street.name} (cấp {street.level})   {street.fame} điểm`
  - `Mũ`
  - `Áo`
  - `Quần`
  - `Phụ kiện`

### OpenWardrobe

- Window title: `Tủ đồ`
- Sends: `takeOff`, `wear`
- Player-facing text (9):

  - `Tủ đồ`
  - `Mặc cho:`
  - `Tôi`
  - `   +{worn.moneyPct}% tiền · +{worn.charm} đẹp`
  - `Cởi`
  - `Tủ trống. Mua đồ ở Cửa hàng.`
  - `Trong tủ`
  - `{w.name}   +{w.moneyPct}% tiền · +{w.xpPct}% KN · +{w.charm} đẹp`
  - `Mặc`

### OpenShop

- Window title: `Cửa hàng quần áo`
- Sends: `buyWearable`
- Player-facing text (3):

  - `Cửa hàng quần áo`
  - `{w.name}   +{w.moneyPct}% tiền · +{w.xpPct}% KN · +{w.charm} đẹp`
  - `   (cấp {w.unlockLevel})`

### OpenLog

- Window title: `Nhật ký`
- Player-facing text (6):

  - `Nhật ký`
  - `Chưa có gì. Ai ghé phố bạn, bày hàng ké hay tưới giúp sẽ hiện ở đây.`
  - `Cảm ơn {entry.who} đã bày hàng ké, bán được {Network.Money(entry.amount)}`
  - `{entry.who} đã tưới giúp vườn của bạn`
  - `Nộp {Network.Money(entry.amount)} phí vỉa hè cho phố {entry.who}`
  - `{entry.who} ghé thăm phố bạn`

### OpenBus

- Window title: `Xe buýt`
- Player-facing text (10):

  - `Không tải được danh sách phố: `
  - `Xe buýt`
  - `Sang phố bạn để bày hàng ké, tưới giúp và trò chuyện. Chủ phố nhận 10% phí vỉa hè.`
  - `Chưa có phố nào khác.`
  - `Bạn · `
  - `Phố {s.ownerName} (cấp {s.ownerLevel})   `
  - `<color=#2f9e44>{s.playerCount} người · {s.stallCount} sạp</color>`
  - `<color=#8aa1b8>vắng</color>`
  - `Đi`
  - `Không vào được phố: `

## client/Assets/Scripts/GameExpansion.cs

### OpenLot

- Sends: `water`, `harvest`

### OpenEmptyLot

- Sends: `plant`, `build`
- Player-facing text (9):

  - `Ô đất {index + 1}`
  - `Trồng cây`
  - `{c.name}   chín sau {minutes} phút · {c.yield} sản phẩm`
  - `   (cấp {c.unlockLevel})`
  - `Miễn phí`
  - `Xây công trình`
  - ` · {Network.Money(b.incomePerHour)}/giờ`
  - `(cấp {b.unlockLevel})`
  - `(cần {b.needsFame} điểm nổi tiếng)`

### OpenCrop

- Window title: `Cây đang lớn`
- Sends: `water`, `clearCrop`
- Player-facing text (4):

  - `Cây đang lớn`
  - `{ItemName(lot.crop)} còn khoảng {left / 60 + 1} phút nữa chín.`
  - `Tưới cây`
  - `Bỏ cây này`

### OpenBuilding

- Window title: `Công trình`
- Sends: `collectIncome`, `upgradeLot`, `demolish`
- Player-facing text (9):

  - `Công trình`
  - `{info.name}: đang xây, còn khoảng {left / 60 + 1} phút.`
  - `{info.name}, cấp {lot.level}/{info.maxLevel}`
  - `Thu {Network.Money(info.incomePerHour * lot.level)} mỗi giờ, tích tối đa 8 giờ.`
  - `Thu tiền`
  - `Nâng cấp {Network.Money(info.cost * (lot.level + 1))}`
  - `Đổi diện mạo`
  - `Vào bếp`
  - `Phá công trình (hoàn {Network.Money(info.cost / 2)})`

### OpenKitchen

- Window title: `Bếp nhà`
- Sends: `collectCooking`, `cook`
- Player-facing text (8):

  - `Bếp nhà`
  - `Đang nấu {ItemName(lot.recipe)}, còn khoảng {left / 60 + 1} phút.`
  - `{ItemName(lot.recipe)} đã chín!`
  - `Lấy món`
  - `{input.amount} {ItemName(input.item)} (có {Stock(input.item)})`
  - `, inputs)} · {r.seconds / 60} phút`
  - `   (cấp {r.unlockLevel})`
  - `Nấu`

### OpenStore

- Window title: `Kho hàng`
- Player-facing text (2):

  - `Kho hàng`
  - `Đang chứa {StoreUsed()}/{p.storeCapacity}. Kho dùng chung cho mọi khu phố.`

### OpenMap

- Window title: `Bản đồ khu phố`
- Sends: `buyDistrict`
- Player-facing text (4):

  - `Bản đồ khu phố`
  - `, {d.needsFame} điểm nổi tiếng`
  - `Khu {i + 1}: {d.name}   cấp {d.unlockLevel}{needs}`
  - `Đi`

### OpenNeighbours

- Window title: `Hàng xóm`
- Player-facing text (3):

  - `Hàng xóm`
  - `{n.name}   Thân thiết {Friendship(n.id)}/5`
  - `Gặp`

### OpenNeighbour

- Sends: `finishQuest`, `neighbourGift`
- Player-facing text (6):

  - `Cảm ơn cháu nhiều lắm, cả xóm quý cháu!`
  - `Thân thiết {Friendship(n.id)}/5. Phần thưởng cao nhất: {n.reward}`
  - `Cần mang: {quest.target} {ItemName(quest.item)} (có {Stock(quest.item)})`
  - `Tiến độ: {progress}/{quest.target}`
  - `Xong việc`
  - `Tặng {ItemName(n.likes)} (có {Stock(n.likes)})`

### OpenProfession

- Window title: `Nghề`
- Sends: `chooseProfession`
- Player-facing text (6):

  - `Nghề`
  - `Từ cấp 5 được chọn một nghề. Mỗi mùa đổi được một lần.`
  - `Bậc {p.profession.rank}/3, đã làm {p.profession.work} việc.`
  - `{job.name}   Giúp bạn: {job.help}`
  - `   (đang làm)`
  - `Chọn`

### OpenVehicles

- Window title: `Xe cộ`
- Sends: `buyVehicle`, `useVehicle`
- Player-facing text (4):

  - `Xe cộ`
  - `{v.name}   Tốc độ {v.speedPct}% · Chở {v.capacity} phần`
  - `   (đang dùng)`
  - `Dùng`

### OpenOrders

- Window title: `Đơn giao`
- Sends: `sendDelivery`, `collectDeliveries`
- Player-facing text (6):

  - `Đơn giao`
  - `Gửi xe đi giao rồi quay lại nhận tiền. Bảng đơn làm mới mỗi 2 giờ.`
  - `{kind?.name}: {o.quantity} {ItemName(o.item)} (có {Stock(o.item)}) · {Network.Money(o.reward)}`
  - `Đang giao {running} đơn, xong {ready} đơn.`
  - `Nhận tiền giao hàng`
  - `Đơn của người chơi khác`

### OpenPlayerOrders

- Window title: `Đơn người chơi`
- Sends: `fulfilOrder`, `postOrder`
- Player-facing text (6):

  - `Không tải được đơn: `
  - `Đơn người chơi`
  - `Giao hàng từ kho của bạn và nhận tiền ngay.`
  - `Chưa có đơn nào.`
  - `{o.buyer_name}: {o.quantity} {ItemName(o.item)} (có {Stock(o.item)}) · {Network.Money(o.price)}`
  - `Đăng đơn mua 10 nải chuối ({Network.Money(banana.price * 10)})`

### OpenActivities

- Window title: `Hoạt động xóm phố`
- Sends: `shuttleStart`, `caroStart`, `startWedding`, `weddingGive`
- Player-facing text (10):

  - `Hoạt động xóm phố`
  - `Không cược tiền. Mỗi hoạt động trả thưởng 3 lần mỗi ngày.`
  - `Đá cầu`
  - `Vào đá cầu cùng mọi người`
  - `Cờ vỉa hè`
  - `Xem bàn cờ đang chơi`
  - `Họp tổ dân phố`
  - `Tổ chức đám cưới trong xóm`
  - `Đám cưới: đã góp {st.weddingProgress}/100 phần`
  - `Góp {Math.Min(10, kv.Value)} {ItemName(item)}`

### OpenMeeting

- Window title: `Họp tổ dân phố`
- Sends: `vote`
- Player-facing text (2):

  - `Họp tổ dân phố`
  - `Tối Chủ nhật cả xóm bỏ phiếu chọn sự kiện cho tối thứ Sáu tuần sau. Ai bỏ phiếu đều được thưởng.`

### OpenCaro

- Window title: `Cờ vỉa hè`
- Sends: `caroMove`
- Player-facing text (7):

  - `Cờ vỉa hè`
  - `Tới lượt bạn`
  - `Chờ đối thủ`
  - `Bạn thắng!`
  - `Hòa`
  - `Bạn thua rồi`
  - `. Xếp 5 quân liền nhau để thắng.`

### UpdateActivities

- Player-facing text (2):

  - `ĐÁ! ({st.shuttleScore})`
  - `Chờ lượt ({st.shuttleScore})`

