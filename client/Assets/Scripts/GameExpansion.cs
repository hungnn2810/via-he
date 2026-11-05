// Windows for land, cooking, the store, districts, neighbours, professions, vehicles, deliveries and street activities.
// All player-facing text stays Vietnamese (see CLAUDE.md).
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public partial class Game
    {
        static Dictionary<string, object> Msg(string key, object value) => new Dictionary<string, object> { [key] = value };

        string ItemName(string id)
        {
            var product = _net.GetProduct(id);
            if (product != null) return product.name;
            return _net.Catalog.crops.Find(c => c.id == id)?.name ?? id;
        }

        int Stock(string id) => _net.Profile.store.TryGetValue(id, out var n) ? n : 0;

        bool OnOwnStreet => _net.Room.State.ownerId == _net.Account.id;

        void Entry(Transform content, string label, string color, Action action) =>
            UIBuilder.Button(UIBuilder.Row(content, 62, false).transform, label, () => action(), color, 20);

        // ---------- Land ----------

        void OpenLot(int index)
        {
            var st = _net.Room.State;
            if (!st.lots.TryGetValue(index.ToString(), out var lot)) return;
            if (!OnOwnStreet)
            {
                if (lot.building == "barber") OpenBarber();
                else if (lot.crop != "") _net.Send("water", Msg("lot", index));
                return;
            }
            if (lot.building != "") OpenBuilding(index);
            else if (lot.crop == "") OpenEmptyLot(index);
            else if (_net.ServerNow >= (long)lot.readyAt) { SoundFx.Harvest(); _net.Send("harvest", Msg("lot", index)); }
            else OpenCrop(index);
        }

        void OpenEmptyLot(int index)
        {
            OpenWindow($"Ô đất {index + 1}", content =>
            {
                var p = _net.Profile;
                UIBuilder.Label(content, "Trồng cây", 22, Draw.Hex("#c92a2a"));
                foreach (var crop in _net.Catalog.crops)
                {
                    var c = crop;
                    var row = UIBuilder.Row(content).transform;
                    bool unlocked = p.level >= c.unlockLevel;
                    bool free = c.id == "banana" && p.freeSeeds > 0;
                    // Must match cropSeconds in server/src/world.ts
                    int minutes = c.id != "banana" ? c.seconds / 60 : p.tutorial < 5 ? 3 : p.tutorial < 9 ? 10 : c.seconds / 60;
                    UIBuilder.Label(row, $"{c.name}   chín sau {minutes} phút · {c.yield} sản phẩm" + (unlocked ? "" : $"   (cấp {c.unlockLevel})"), 19, unlocked ? UIBuilder.TextDark : UIBuilder.TextMuted);
                    if (!unlocked) continue;
                    UIBuilder.Button(row, free ? "Miễn phí" : Network.Money(c.seedCost), () =>
                    {
                        SoundFx.Plant();
                        _net.Send("plant", new Dictionary<string, object> { ["lot"] = index, ["crop"] = c.id });
                        CloseWindow();
                    }, "green", 17).GetComponent<LayoutElement>().minWidth = 150;
                }
                UIBuilder.Label(content, "Xây công trình", 22, Draw.Hex("#c92a2a"));
                foreach (var building in _net.Catalog.buildings)
                {
                    var b = building;
                    var row = UIBuilder.Row(content).transform;
                    bool unlocked = p.level >= b.unlockLevel && p.fame >= b.needsFame;
                    var income = b.incomePerHour > 0 ? $" · {Network.Money(b.incomePerHour)}/giờ" : "";
                    var needs = p.level < b.unlockLevel ? $"(cấp {b.unlockLevel})" : p.fame < b.needsFame ? $"(cần {b.needsFame} điểm nổi tiếng)" : "";
                    UIBuilder.Label(row, $"{b.name}{income}   {needs}", 19, unlocked ? UIBuilder.TextDark : UIBuilder.TextMuted);
                    if (!unlocked) continue;
                    UIBuilder.Button(row, Network.Money(b.cost), () => { _net.Send("build", new Dictionary<string, object> { ["lot"] = index, ["type"] = b.id }); CloseWindow(); }, "orange", 17)
                        .GetComponent<LayoutElement>().minWidth = 170;
                }
            });
        }

        void OpenCrop(int index)
        {
            OpenWindow("Cây đang lớn", content =>
            {
                if (!_net.Room.State.lots.TryGetValue(index.ToString(), out var lot) || lot.crop == "") { CloseWindow(); return; }
                long left = Math.Max(0, ((long)lot.readyAt - _net.ServerNow) / 1000);
                UIBuilder.Label(content, $"{ItemName(lot.crop)} còn khoảng {left / 60 + 1} phút nữa chín.", 22);
                var row = UIBuilder.Row(content, 64, false).transform;
                if (!lot.watered) UIBuilder.Button(row, "Tưới cây", () => { SoundFx.Water(); _net.Send("water", Msg("lot", index)); CloseWindow(); }, "blue");
                UIBuilder.Button(row, "Bỏ cây này", () => { _net.Send("clearCrop", Msg("lot", index)); CloseWindow(); }, "red");
            });
        }

        void OpenBuilding(int index)
        {
            OpenWindow("Công trình", content =>
            {
                if (!_net.Room.State.lots.TryGetValue(index.ToString(), out var lot) || lot.building == "") { CloseWindow(); return; }
                var info = _net.Catalog.buildings.Find(b => b.id == lot.building);
                long left = ((long)lot.readyAt - _net.ServerNow) / 1000;
                UIBuilder.Label(content, left > 0 ? $"{info.name}: đang xây, còn khoảng {left / 60 + 1} phút." : $"{info.name}, cấp {lot.level}/{info.maxLevel}", 22);
                if (info.incomePerHour > 0) UIBuilder.Label(content, $"Thu {Network.Money(info.incomePerHour * lot.level)} mỗi giờ, tích tối đa 8 giờ.", 18, UIBuilder.TextMuted);
                var row = UIBuilder.Row(content, 64, false).transform;
                if (info.incomePerHour > 0) UIBuilder.Button(row, "Thu tiền", () => _net.Send("collectIncome"), "green");
                if (left <= 0 && lot.level < info.maxLevel)
                    UIBuilder.Button(row, $"Nâng cấp {Network.Money(info.cost * (lot.level + 1))}", () => _net.Send("upgradeLot", Msg("lot", index)), "orange", 17);
                if (lot.building == "barber" && left <= 0) UIBuilder.Button(row, "Đổi diện mạo", OpenBarber, "blue");
                if (lot.building == "kitchen" && left <= 0) UIBuilder.Button(row, "Vào bếp", () => OpenKitchen(index), "blue");
                Entry(content, $"Phá công trình (hoàn {Network.Money(info.cost / 2)})", "red", () => { _net.Send("demolish", Msg("lot", index)); CloseWindow(); });
            });
        }

        void OpenKitchen(int index)
        {
            OpenWindow("Bếp nhà", content =>
            {
                var p = _net.Profile;
                if (!_net.Room.State.lots.TryGetValue(index.ToString(), out var lot)) { CloseWindow(); return; }
                if (lot.recipe != "")
                {
                    long left = ((long)lot.cookReadyAt - _net.ServerNow) / 1000;
                    UIBuilder.Label(content, left > 0 ? $"Đang nấu {ItemName(lot.recipe)}, còn khoảng {left / 60 + 1} phút." : $"{ItemName(lot.recipe)} đã chín!", 22);
                    if (left <= 0) Entry(content, "Lấy món", "green", () => _net.Send("collectCooking", Msg("lot", index)));
                    return;
                }
                foreach (var recipe in _net.Catalog.recipes)
                {
                    var r = recipe;
                    if (!string.IsNullOrEmpty(r.needsFriend) && Friendship(r.needsFriend) < 5) continue;
                    var inputs = new List<string>();
                    foreach (var input in r.inputList) inputs.Add($"{input.amount} {ItemName(input.item)} (có {Stock(input.item)})");
                    var row = UIBuilder.Row(content).transform;
                    bool unlocked = p.level >= r.unlockLevel;
                    UIBuilder.Label(row, $"{r.name} ×{r.yield}   {string.Join(", ", inputs)} · {r.seconds / 60} phút" + (unlocked ? "" : $"   (cấp {r.unlockLevel})"), 18, unlocked ? UIBuilder.TextDark : UIBuilder.TextMuted);
                    if (unlocked) UIBuilder.Button(row, "Nấu", () => _net.Send("cook", new Dictionary<string, object> { ["lot"] = index, ["recipe"] = r.id }), "orange", 17);
                }
            });
        }

        void OpenStore()
        {
            OpenWindow("Kho hàng", content =>
            {
                var p = _net.Profile;
                UIBuilder.Label(content, $"Đang chứa {StoreUsed()}/{p.storeCapacity}. Kho dùng chung cho mọi khu phố.", 18, UIBuilder.TextMuted);
                foreach (var kv in p.store)
                {
                    var row = UIBuilder.Row(content).transform;
                    UIBuilder.Label(row, $"{ItemName(kv.Key)}   {kv.Value}", 20);
                }
            });
        }

        int StoreUsed()
        {
            int total = 0;
            foreach (var kv in _net.Profile.store) total += kv.Value;
            return total;
        }

        // ---------- Districts ----------

        void OpenMap()
        {
            OpenWindow("Bản đồ khu phố", content =>
            {
                var p = _net.Profile;
                for (int i = 0; i < _net.Catalog.districts.Count; i++)
                {
                    int district = i;
                    var d = _net.Catalog.districts[i];
                    var row = UIBuilder.Row(content).transform;
                    bool owned = i < p.districts.Count;
                    var needs = d.needsFame > 0 ? $", {d.needsFame} điểm nổi tiếng" : "";
                    UIBuilder.Label(row, owned ? $"Khu {i + 1}: {d.name}" : $"Khu {i + 1}: {d.name}   cấp {d.unlockLevel}{needs}", 20, owned ? UIBuilder.TextDark : UIBuilder.TextMuted);
                    if (owned) UIBuilder.Button(row, "Đi", () => _ = JoinStreet(null, district), "green", 18);
                    else if (i == p.districts.Count) UIBuilder.Button(row, Network.Money(d.cost), () => _net.Send("buyDistrict"), "orange", 17).GetComponent<LayoutElement>().minWidth = 170;
                }
            });
        }

        // ---------- Neighbours ----------

        int Friendship(string id) =>
            _net.Profile.neighbours.TryGetValue(id, out var n) ? Math.Min(5, n.points / 3) : 0;

        void OpenNeighbours()
        {
            OpenWindow("Hàng xóm", content =>
            {
                foreach (var neighbour in _net.Catalog.neighbours)
                {
                    var n = neighbour;
                    var row = UIBuilder.Row(content, 72).transform;
                    UIBuilder.Icon(row, n.portrait, 60);
                    UIBuilder.Label(row, $"{n.name}   Thân thiết {Friendship(n.id)}/5", 20);
                    UIBuilder.Button(row, "Gặp", () => OpenNeighbour(n), "green", 18);
                }
            });
        }

        void OpenNeighbour(NeighbourInfo n)
        {
            OpenWindow(n.name, content =>
            {
                var p = _net.Profile;
                p.neighbours.TryGetValue(n.id, out var state);
                int done = state?.quests ?? 0, progress = state?.progress ?? 0;
                var top = UIBuilder.Row(content, 110, false).transform;
                UIBuilder.Icon(top, n.portrait, 100);
                UIBuilder.Label(top, done < n.quests.Count ? n.quests[done].text : "Cảm ơn cháu nhiều lắm, cả xóm quý cháu!", 19);
                UIBuilder.Label(content, $"Thân thiết {Friendship(n.id)}/5. Phần thưởng cao nhất: {n.reward}", 18, UIBuilder.TextMuted);
                if (done < n.quests.Count)
                {
                    var quest = n.quests[done];
                    UIBuilder.Label(content, quest.type == "give" ? $"Cần mang: {quest.target} {ItemName(quest.item)} (có {Stock(quest.item)})" : $"Tiến độ: {progress}/{quest.target}", 20);
                    Entry(content, "Xong việc", "green", () => _net.Send("finishQuest", Msg("id", n.id)));
                }
                Entry(content, $"Tặng {ItemName(n.likes)} (có {Stock(n.likes)})", "orange", () => _net.Send("neighbourGift", Msg("id", n.id)));
            });
        }

        // ---------- Professions ----------

        void OpenProfession()
        {
            OpenWindow("Nghề", content =>
            {
                var p = _net.Profile;
                UIBuilder.Label(content, p.profession == null ? "Từ cấp 5 được chọn một nghề. Mỗi mùa đổi được một lần." : $"Bậc {p.profession.rank}/3, đã làm {p.profession.work} việc.", 18, UIBuilder.TextMuted);
                foreach (var profession in _net.Catalog.professions)
                {
                    var job = profession;
                    var row = UIBuilder.Row(content).transform;
                    bool current = p.profession?.id == job.id;
                    UIBuilder.Label(row, $"{job.name}   Giúp bạn: {job.help}" + (current ? "   (đang làm)" : ""), 19);
                    if (!current) UIBuilder.Button(row, "Chọn", () => _net.Send("chooseProfession", Msg("id", job.id)), "green", 17);
                }
            });
        }

        // ---------- Vehicles and deliveries ----------

        void OpenVehicles()
        {
            OpenWindow("Xe cộ", content =>
            {
                var p = _net.Profile;
                foreach (var vehicle in _net.Catalog.vehicles)
                {
                    var v = vehicle;
                    var row = UIBuilder.Row(content).transform;
                    bool owned = v.price == 0 || p.vehicles.Contains(v.id);
                    bool using_ = p.vehicle == v.id;
                    UIBuilder.Label(row, $"{v.name}   Tốc độ {v.speedPct}% · Chở {v.capacity} phần" + (using_ ? "   (đang dùng)" : ""), 19);
                    if (!owned) UIBuilder.Button(row, Network.Money(v.price), () => _net.Send("buyVehicle", Msg("id", v.id)), "orange", 17).GetComponent<LayoutElement>().minWidth = 160;
                    else if (!using_) UIBuilder.Button(row, "Dùng", () => _net.Send("useVehicle", Msg("id", v.id)), "green", 17);
                }
            });
        }

        void OpenOrders()
        {
            OpenWindow("Đơn giao", content =>
            {
                var p = _net.Profile;
                UIBuilder.Label(content, "Gửi xe đi giao rồi quay lại nhận tiền. Bảng đơn làm mới mỗi 2 giờ.", 18, UIBuilder.TextMuted);
                foreach (var order in p.orders)
                {
                    var o = order;
                    var kind = _net.Catalog.orderKinds.Find(k => k.id == o.kind);
                    var row = UIBuilder.Row(content).transform;
                    UIBuilder.Label(row, $"{kind?.name}: {o.quantity} {ItemName(o.item)} (có {Stock(o.item)}) · {Network.Money(o.reward)}", 19);
                    UIBuilder.Button(row, "Giao", () => _net.Send("sendDelivery", Msg("orderId", o.id)), "green", 17);
                }
                int running = 0, ready = 0;
                foreach (var d in p.deliveries) { if (_net.ServerNow >= d.doneAt) ready++; else running++; }
                UIBuilder.Label(content, $"Đang giao {running} đơn, xong {ready} đơn.", 19);
                if (ready > 0) Entry(content, "Nhận tiền giao hàng", "green", () => _net.Send("collectDeliveries"));
                Entry(content, "Đơn của người chơi khác", "blue", OpenPlayerOrders);
            });
        }

        async void OpenPlayerOrders()
        {
            List<PlayerOrderInfo> orders;
            try { orders = await _net.GetPlayerOrders(); }
            catch (Exception e) { Toast("Không tải được đơn: " + e.Message); return; }
            OpenWindow("Đơn người chơi", content =>
            {
                UIBuilder.Label(content, "Giao hàng từ kho của bạn và nhận tiền ngay.", 18, UIBuilder.TextMuted);
                if (orders.Count == 0) UIBuilder.Label(content, "Chưa có đơn nào.", 20);
                foreach (var order in orders)
                {
                    var o = order;
                    var row = UIBuilder.Row(content).transform;
                    UIBuilder.Label(row, $"{o.buyer_name}: {o.quantity} {ItemName(o.item)} (có {Stock(o.item)}) · {Network.Money(o.price)}", 19);
                    if (o.buyer != _net.Account.id) UIBuilder.Button(row, "Giao", () => { _net.Send("fulfilOrder", Msg("id", o.id)); CloseWindow(); }, "green", 17);
                }
                var banana = _net.GetProduct("banana");
                Entry(content, $"Đăng đơn mua 10 nải chuối ({Network.Money(banana.price * 10)})", "orange", () =>
                    _net.Send("postOrder", new Dictionary<string, object> { ["item"] = "banana", ["quantity"] = 10, ["price"] = banana.price * 10 }));
            });
        }

        // ---------- Activities ----------

        void OpenActivities()
        {
            OpenWindow("Hoạt động xóm phố", content =>
            {
                var st = _net.Room.State;
                UIBuilder.Label(content, "Không cược tiền. Mỗi hoạt động trả thưởng 3 lần mỗi ngày.", 18, UIBuilder.TextMuted);
                Entry(content, st.shuttlePlayers == "" ? "Đá cầu" : "Vào đá cầu cùng mọi người", "green", () => { _net.Send("shuttleStart"); CloseWindow(); });
                Entry(content, "Cờ vỉa hè", "green", () => { _net.Send("caroStart"); OpenCaro(); });
                if (st.caroBoard != "" && st.caroWinner == "") Entry(content, "Xem bàn cờ đang chơi", "blue", OpenCaro);
                Entry(content, "Họp tổ dân phố", "orange", OpenMeeting);
                if (OnOwnStreet) Entry(content, "Tổ chức đám cưới trong xóm", "orange", () => _net.Send("startWedding"));
                if (st.weddingEndsAt > _net.ServerNow)
                {
                    UIBuilder.Label(content, $"Đám cưới: đã góp {st.weddingProgress}/100 phần", 19);
                    foreach (var kv in _net.Profile.store)
                    {
                        var item = kv.Key;
                        if (_net.GetProduct(item) == null) continue;
                        Entry(content, $"Góp {Math.Min(10, kv.Value)} {ItemName(item)}", "green", () =>
                            _net.Send("weddingGive", new Dictionary<string, object> { ["item"] = item, ["quantity"] = Math.Min(10, Stock(item)) }));
                    }
                }
            });
        }

        void OpenMeeting()
        {
            OpenWindow("Họp tổ dân phố", content =>
            {
                UIBuilder.Label(content, "Tối Chủ nhật cả xóm bỏ phiếu chọn sự kiện cho tối thứ Sáu tuần sau. Ai bỏ phiếu đều được thưởng.", 18, UIBuilder.TextMuted);
                foreach (var choice in _net.Catalog.meetingChoices)
                {
                    var c = choice;
                    Entry(content, c.name, "orange", () => { _net.Send("vote", Msg("choice", c.id)); CloseWindow(); });
                }
            });
        }

        const int CaroSize = 9;
        string _caroShown = "";

        void OpenCaro()
        {
            OpenWindow("Cờ vỉa hè", content =>
            {
                var st = _net.Room.State;
                _caroShown = st.caroBoard + st.caroWinner;
                string status = st.caroWinner == "" ? (st.caroTurn == _net.Account.id ? "Tới lượt bạn" : "Chờ đối thủ")
                    : st.caroWinner == _net.Account.id ? "Bạn thắng!" : st.caroWinner == "draw" ? "Hòa" : "Bạn thua rồi";
                UIBuilder.Label(content, status + ". Xếp 5 quân liền nhau để thắng.", 20);
                for (int y = 0; y < CaroSize; y++)
                {
                    var row = UIBuilder.Row(content, 40, false).transform;
                    for (int x = 0; x < CaroSize; x++)
                    {
                        int cell = y * CaroSize + x;
                        char mark = cell < st.caroBoard.Length ? st.caroBoard[cell] : '.';
                        UIBuilder.Button(row, mark == '.' ? "" : mark.ToString(), () => _net.Send("caroMove", Msg("cell", cell)), mark == 'X' ? "orange" : mark == 'O' ? "blue" : "gray", 20);
                    }
                }
            });
        }

        // Called every frame: refreshes the board and the shuttle kick button from the synced state
        void UpdateActivities()
        {
            var st = _net?.Room?.State;
            if (st == null || _kick == null) return;
            bool myTurn = st.shuttleTurn == _net.Account.id;
            bool playing = st.shuttlePlayers != "";
            if (_kick.gameObject.activeSelf != playing) _kick.gameObject.SetActive(playing);
            if (playing)
            {
                _kick.interactable = myTurn;
                _kickLabel.text = myTurn ? $"ĐÁ! ({st.shuttleScore})" : $"Chờ lượt ({st.shuttleScore})";
            }
            if (_caroShown != "" && _window != null && _caroShown != st.caroBoard + st.caroWinner) _redrawWindow?.Invoke();
        }
    }
}
