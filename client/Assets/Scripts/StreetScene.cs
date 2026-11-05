// Builds the side-view street from the sprite set and syncs it with the room state every frame:
// sky, river and city, rows of homes and shops, power poles, sidewalk, road, bystanders, parked and passing motorbikes, stall slots, stalls, players, customers.
// Tap to walk / invite a customer / open a stall / use a street object.
using System;
using System.Collections.Generic;
using ViaHeOnline.Schema;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Rendering;

namespace ViaHeOnline
{
    public class StreetScene : MonoBehaviour
    {
        public const float WorldScale = 100f;   // 100 server units = 1 Unity unit
        public const float CameraY = 0.3f;      // only the starting height; FitCamera takes over once a street is loaded
        const float ScreenMargin = 0.5f, RoadBottom = -5.3f;
        const float EmptySlotTop = 1.35f, StallY = 0.15f, PlayerY = -0.85f, CustomerY = -1.45f, QueueY = -0.35f, MotorbikeY = -2.95f;
        const float PlayerScale = 0.85f, CustomerScale = 0.8f, SellerScale = 0.82f;
        const float MotorbikeMinSpeed = 2.8f, MotorbikeMaxSpeed = 4.6f;
        const float ShopScale = 0.72f, RiverCityY = 2.1f, BystanderY = 0.2f, ParkedBikeY = -1.85f, DecorScale = 0.9f;

        static readonly string[] Bystanders = { "npc_cap_man", "npc_girl", "npc_firefighter", "npc_worker" };
        static readonly string[] ParkedBikes = { "bike_delivery", "bike_sport", "bike_cub" };
        static readonly string[] Traffic = { "traffic_sport", "traffic_cub", "traffic_scooter" };

        static readonly string[] InviteLines =
        {
            "Bắt mắt đấy, gói cho một phần!",
            "Bán nhanh cho chị kịp giờ nhé!",
            "Nghe mời dẻo miệng ghê, mua liền!",
            "Đang đói bụng thì gặp ngay quán, may quá!",
            "Có tươi nóng không đấy quán ơi?",
            "Thôi vào đây ủng hộ một phần!"
        };

        static readonly string[] SaleLines =
        {
            "Ngon tuyệt cú mèo, mai tôi lại ghé!",
            "Cảm ơn quán nhé, đắt hàng!",
            "Vừa miệng lắm, cho quán 5 sao!",
            "Gói cẩn thận ghê, thơm phức!",
            "Ngon bổ rẻ, lát đồng nghiệp tôi cũng ghé!"
        };

        // Customer groups look different so players learn who buys what
        static readonly Dictionary<string, string[]> GroupLooks = new Dictionary<string, string[]>
        {
            ["homemaker"] = new[] { "npc_girl", "npc_farmer" },
            ["student"] = new[] { "npc_cap_man", "npc_worker" },
        };

        // Must match BALANCE in server/src/data.ts
        const float FirstSlotX = 220f, LastSlotMargin = 220f;
        // Lots are rectangles side by side with no gaps, filling the street between a 1-unit margin at each end.
        // LotWidth * lotsPerDistrict (4, server BALANCE) + 2 margins = street length (20 units); keep lot_soil in sprites.js as wide as LotWidth.
        const float LotWidth = 4.5f, LotSpacing = LotWidth, LotStartX = 1f + LotWidth / 2f, LotHalfWidth = LotWidth / 2f;
        const float LotY = 1.1f, LotSoilY = 1.6f, CropScale = 0.75f, LandY = 0.9f;   // plants stand on LotY + 0.2, in the middle of the soil
        const float LotLabelHeight = 1.35f;   // above the lot, but low enough to clear the HUD at the top of the screen
        const int RainDrops = 70;
        const float LotScale = 0.72f;

        // Umbrella color per product
        static readonly Dictionary<string, string> UmbrellaColor = new Dictionary<string, string>
        {
            ["banana"] = "yellow", ["fried_banana"] = "orange", ["banana_soup"] = "purple", ["fresh_cane"] = "green", ["banana_cake"] = "red", ["grandma_soup"] = "purple", ["banh_chung"] = "green", ["sugarcane_juice"] = "green", ["moon_cake"] = "orange", ["iced_tea"] = "blue", ["banh_mi"] = "red", ["sticky_rice"] = "yellow", ["sweet_soup"] = "purple", ["popsicle"] = "blue",
            ["rambutan"] = "green", ["flowers"] = "orange", ["tofu_noodles"] = "yellow", ["fresh_milk"] = "green",
        };

        Network _net;
        Camera _cam;
        Transform _background, _farCity;
        float _length = 20f;

        readonly Dictionary<string, Character> _players = new Dictionary<string, Character>();
        readonly Dictionary<string, Character> _customers = new Dictionary<string, Character>();
        readonly Dictionary<int, StallView> _stalls = new Dictionary<int, StallView>();
        readonly List<GameObject> _emptySlots = new List<GameObject>();
        readonly List<PassingBike> _motorbikes = new List<PassingBike>();
        readonly List<LotView> _lots = new List<LotView>();
        readonly List<GameObject> _decorations = new List<GameObject>();
        readonly List<Transform> _rain = new List<Transform>();
        string _decorationKey = "";

        public event Action<int> OnEmptySlotTapped;     // tapped a slot nobody is using
        public event Action<Stall> OnOwnStallTapped;
        public event Action<StreetAction> OnObjectAction;   // tapped an object that opens a window
        public event Action<int> OnLotTapped;

        class LotView
        {
            public SpriteRenderer Soil, Thing, LabelBg;
            public TextMesh Label;
            public string Shown;
        }

        class StallView
        {
            public GameObject Root;
            public SpriteRenderer Umbrella, Counter, LabelBg;
            public TextMesh Label;
            public Character Seller;
            public string ProductId;
        }

        public void Bind(Network net)
        {
            _net = net;
            _cam = Camera.main;
            StreetObject.GetActiveEvent = () => _net?.Room?.State?.@event ?? "";
            _net.OnSale += m =>
            {
                if (!_stalls.TryGetValue(m.slot, out var s)) return;
                if (m.ownerId == _net.Account.id) SoundFx.Sale();
                FloatMoney("+" + Network.Money(m.amount), s.Root.transform.position + Vector3.up * 2.1f,
                    m.ownerId == _net.Account.id ? Draw.Hex("#8ce99a") : Draw.Hex("#ffe066"));
                // whoever is selling cheers: the employee at the stall, or the stall owner when selling in person
                if (s.Seller.gameObject.activeSelf) s.Seller.Cheer();
                else foreach (var kv in _net.Room.State.players)
                    if (kv.Value.id == m.ownerId && _players.TryGetValue(kv.Key, out var c)) c.Cheer();

                // buyer at this slot also cheers and thanks
                if (_net.Room?.State?.customers != null)
                {
                    foreach (var kv in _net.Room.State.customers)
                    {
                        if (kv.Value.targetSlot == m.slot && _customers.TryGetValue(kv.Key, out var buyer))
                        {
                            buyer.Cheer();
                            buyer.Say(SaleLines[UnityEngine.Random.Range(0, SaleLines.Length)], 2f);
                            break;
                        }
                    }
                }
            };
            _net.OnInvite += m =>
            {
                if (!_customers.TryGetValue(m.customerId, out var k)) return;
                FloatMoney("!", k.transform.position + Vector3.up * 2f, Color.yellow, false);
                k.Surprise();
                k.Say(InviteLines[UnityEngine.Random.Range(0, InviteLines.Length)], 2.2f);
            };
        }

        // Clear the old scene when switching streets
        public void Clear()
        {
            foreach (Transform c in transform) Destroy(c.gameObject);
            _players.Clear(); _customers.Clear(); _stalls.Clear(); _emptySlots.Clear(); _motorbikes.Clear(); _lots.Clear(); _decorations.Clear(); _rain.Clear(); _decorationKey = "";
            _background = null;
        }

        void BuildBackground(StreetState st)
        {
            _length = (float)st.length / WorldScale;
            _background = new GameObject("Background").transform;
            _background.SetParent(transform, false);
            float mid = _length / 2f, width = _length + 20f;

            var sky = Draw.Put(_background, "bg_sky", new Vector2(mid, 0.5f), 1, -1000);
            sky.transform.localScale = new Vector3(width / 0.32f, 8f / 2.56f, 1);

            // Distant city (the camera is fixed, so it does not need parallax)
            _farCity = new GameObject("FarCity").transform;
            _farCity.SetParent(_background, false);
            float cityWidth = SpriteLibrary.Get("bg_river_city").bounds.size.x * ShopScale;
            for (float x = -12; x < _length + 12; x += cityWidth) Draw.Put(_farCity, "bg_river_city", new Vector2(x, RiverCityY), ShopScale, -990);

            Draw.Sized(_background, "bg_land_" + st.district, new Vector2(-10, LandY), new Vector2(width, 1.5f), -972, SpriteDrawMode.Tiled);
            Draw.Sized(_background, "street_sidewalk", new Vector2(-10, -1.75f), new Vector2(width, 2.65f), -970, SpriteDrawMode.Tiled);
            Draw.Sized(_background, "street_curb", new Vector2(-10, -1.95f), new Vector2(width, 0.3f), -965, SpriteDrawMode.Tiled);
            Draw.Sized(_background, "street_road", new Vector2(-10, -4.2f), new Vector2(width, 2.3f), -960, SpriteDrawMode.Tiled);

            Draw.Put(_background, "bus_stop", new Vector2(-0.45f, -1.6f), 0.85f, -930);

            // Stall slots (the first ones belong to the street owner)
            for (int slot = 0; slot < st.slotCount; slot++)
            {
                var sr = Draw.Put(_background, slot < st.ownerSlots ? "slot_owner" : "slot_empty", new Vector2(SlotX(slot, st), 0.28f), 0.95f, -920);
                sr.color = new Color(1, 1, 1, 0.95f);
                _emptySlots.Add(sr.gameObject);
            }

            // Scenery in the gaps between slots, alternating bystanders by the shops and bikes parked at the curb
            for (int gap = 0; gap < st.slotCount - 1; gap++)
            {
                float x = (SlotX(gap, st) + SlotX(gap + 1, st)) / 2f;
                if (gap % 2 == 0)
                    Draw.Put(_background, Bystanders[gap / 2 % Bystanders.Length], new Vector2(x, BystanderY), DecorScale, DepthOrder(BystanderY));
                else
                    Draw.Put(_background, ParkedBikes[gap / 2 % ParkedBikes.Length], new Vector2(x, ParkedBikeY), DecorScale, DepthOrder(ParkedBikeY));
            }

            // The two ends of the street have room for larger scenery
            float end = SlotX(st.slotCount - 1, st);
            PutDecor("npc_old_man", end + 0.4f, 0.44f);
            PutDecor("prop_boxes", end + 1.2f, 0.05f);
            PutDecor("prop_cafe_sign", end + 1.7f, -0.8f);

            foreach (var sr in _background.GetComponentsInChildren<SpriteRenderer>()) StreetObject.TryAttach(sr);
        }

        public static float LotX(int index) => LotStartX + index * LotSpacing;

        // Soil, then a crop or a building on top; labels show time left and what a tap will do
        void AddMissingLots(StreetState st)
        {
            for (int i = _lots.Count; st.lots.ContainsKey(i.ToString()); i++)
            {
                var position = new Vector2(LotX(i), LotY);
                var soil = Draw.Put(_background, "lot_soil", new Vector2(position.x, LotSoilY), 1f, -947);
                var thing = Draw.Put(_background, "banana_stage_1", position + new Vector2(0, 0.2f), CropScale, -945);
                var bg = Draw.Sized(_background, "ui_tag", position + new Vector2(0, LotLabelHeight), new Vector2(1f, 0.3f), -940, SpriteDrawMode.Sliced);
                var label = Draw.Text(_background, "", position + new Vector2(0, LotLabelHeight), 0.14f, Color.white, -939);
                _lots.Add(new LotView { Soil = soil, Thing = thing, LabelBg = bg, Label = label });
            }
        }

        static string CropSprite(string crop, int stage) => crop == "banana" ? "banana_stage_" + stage : $"crop_{crop}_{stage}";

        void SyncLots(StreetState st)
        {
            AddMissingLots(st);
            bool mine = st.ownerId == _net.Account.id;
            long now = _net.ServerNow;
            for (int i = 0; i < _lots.Count; i++)
            {
                if (!st.lots.TryGetValue(i.ToString(), out var lot)) continue;
                var view = _lots[i];
                long readyAt = (long)lot.readyAt, plantedAt = (long)lot.plantedAt;
                string shown = null, text;
                if (lot.building != "")
                {
                    bool finished = now >= readyAt;
                    shown = finished ? "building_" + lot.building : "building_scaffold";
                    if (!finished) text = TimeLeft(readyAt - now);
                    else if (lot.recipe != "") text = now >= (long)lot.cookReadyAt ? "Món đã chín" : "Nấu " + TimeLeft((long)lot.cookReadyAt - now);
                    else text = "";
                }
                else if (lot.crop != "")
                {
                    if (now >= readyAt) { shown = CropSprite(lot.crop, 3); text = mine ? "Thu hoạch" : "Đã chín"; }
                    else
                    {
                        float grown = (now - plantedAt) / (float)Math.Max(1, readyAt - plantedAt);
                        shown = CropSprite(lot.crop, grown < 0.5f ? 1 : 2);
                        text = TimeLeft(readyAt - now) + (lot.watered ? "" : " Tưới");
                    }
                }
                else text = mine ? "Chạm để dùng đất" : "Đất trống";
                if (view.Shown != shown)
                {
                    view.Shown = shown;
                    view.Thing.gameObject.SetActive(shown != null);
                    if (shown != null)
                    {
                        view.Thing.sprite = SpriteLibrary.Get(shown);
                        float scale = lot.building != "" ? LotScale : CropScale;
                        view.Thing.transform.localScale = new Vector3(scale, scale, 1);
                    }
                }
                view.Label.gameObject.SetActive(text != "");
                view.LabelBg.gameObject.SetActive(text != "");
                if (view.Label.text != text)
                {
                    view.Label.text = text;
                    view.LabelBg.size = new Vector2(text.Length * 0.085f + 0.3f, 0.3f);
                }
            }
        }

        static string TimeLeft(long milliseconds)
        {
            long seconds = (milliseconds + 999) / 1000;
            return $"{seconds / 60:00}:{seconds % 60:00}";
        }

        // Owned decorations stand between the lots; a season reward shows as a trophy
        void SyncDecorations(StreetState st)
        {
            if (st.decorations == _decorationKey) return;
            _decorationKey = st.decorations;
            foreach (var d in _decorations) Destroy(d);
            _decorations.Clear();
            int gap = 0;
            foreach (var id in st.decorations.Split(','))
            {
                if (id == "" || gap >= 3) continue;
                string sprite = SpriteLibrary.Has("deco_" + id) ? "deco_" + id : "deco_trophy";
                _decorations.Add(Draw.Put(_background, sprite, new Vector2(LotX(gap) + LotSpacing / 2f, LotY), 0.7f, -944).gameObject);
                gap++;
            }
        }

        // Falling streaks around the camera while it rains (client-side decoration only)
        void RunRain(StreetState st)
        {
            bool raining = Array.IndexOf(st.@event.Split(','), "rain") >= 0;
            if (!raining)
            {
                foreach (var drop in _rain) Destroy(drop.gameObject);
                _rain.Clear();
                return;
            }
            float half = _cam.orthographicSize * _cam.aspect + 1, top = _cam.transform.position.y + _cam.orthographicSize + 1;
            while (_rain.Count < RainDrops)
            {
                var drop = Draw.Block(transform, "Rain", Draw.Square, new Color(0.8f, 0.9f, 1f, 0.55f), Vector2.zero, new Vector2(0.025f, 0.32f), 3000).transform;
                drop.position = new Vector3(_cam.transform.position.x + UnityEngine.Random.Range(-half, half), UnityEngine.Random.Range(top - 8, top), 0);
                _rain.Add(drop);
            }
            foreach (var drop in _rain)
            {
                drop.position += new Vector3(-1.5f, -11f, 0) * Time.deltaTime;
                if (drop.position.y < top - 9f) drop.position = new Vector3(_cam.transform.position.x + UnityEngine.Random.Range(-half, half), top, 0);
            }
        }

        void PutDecor(string name, float x, float y) => Draw.Put(_background, name, new Vector2(x, y), DecorScale, DepthOrder(y));

        static int DepthOrder(float y) => 1000 - Mathf.RoundToInt(y * 100);

        public static float SlotX(int slot, StreetState st) =>
            (FirstSlotX + slot * ((float)st.length - FirstSlotX - LastSlotMargin) / (st.slotCount - 1)) / WorldScale;

        static int Hash(string s)
        {
            unchecked { int h = 7; foreach (var c in s ?? "") h = h * 31 + c; return h & 0x7fffffff; }
        }

        void Update()
        {
            var room = _net?.Room;
            if (room?.State == null || string.IsNullOrEmpty(room.State.ownerId)) return;
            var st = room.State;
            if (_background == null) BuildBackground(st);

            SyncPlayers(st);
            SyncStalls(st);
            SyncCustomers(st);
            SyncLots(st);
            SyncDecorations(st);
            RunRain(st);
            FitCamera();
            RunMotorbikes();
            HandleTap(st);
        }

        void SyncPlayers(StreetState st)
        {
            var alive = new HashSet<string>();
            foreach (var kv in st.players)
            {
                var p = kv.Value;
                alive.Add(kv.Key);
                bool isMe = p.id == _net.Account.id;
                if (!_players.TryGetValue(kv.Key, out var c))
                {
                    c = Character.Create(transform, p.name, 0, PlayerScale);
                    c.SetLook(Hash(p.id));
                    c.transform.position = c.Target = new Vector3((float)p.x / WorldScale, PlayerY, 0);
                    _players[kv.Key] = c;
                }
                c.SetAppearance(p.look, p.outfit);
                c.SetVehicle(p.vehicle);
                c.SetName($"{p.name} · {p.level}", isMe ? Draw.Hex("#8ce99a") : p.isOwner ? Draw.Hex("#ffd43b") : Color.white);
                c.Say(p.speech);
                c.Target = new Vector3((float)p.x / WorldScale, PlayerY, 0);
            }
            RemoveStale(_players, alive);
        }

        void SyncStalls(StreetState st)
        {
            var present = new HashSet<int>();
            foreach (var kv in st.stalls)
            {
                var s = kv.Value;
                present.Add(s.slot);
                if (!_stalls.TryGetValue(s.slot, out var v) || v.ProductId != s.productId)
                {
                    if (v != null) Destroy(v.Root);
                    v = CreateStall(s);
                    _stalls[s.slot] = v;
                    if (s.slot < _emptySlots.Count) _emptySlots[s.slot].SetActive(false);
                }
                var product = _net.GetProduct(s.productId);
                var label = $"{product?.name ?? s.productId} ×{s.remaining} · {Network.Money(s.price)}";
                v.Seller.SetAppearance(s.sellerLook, s.sellerOutfit);
                if (v.Label.text != label)
                {
                    v.Label.text = label;
                    v.LabelBg.size = new Vector2(label.Length * 0.085f + 0.3f, 0.3f);
                }
                bool mine = s.ownerId == _net.Account.id;
                // When the owner sells in person their own player character stands there, so no extra seller is drawn
                v.Seller.gameObject.SetActive(s.employeeId != "");
                if (s.employeeId != "")
                {
                    v.Seller.SetName($"{s.sellerName} ({s.ownerName})", mine ? Draw.Hex("#8ce99a") : Color.white);
                }
            }
            foreach (var slot in new List<int>(_stalls.Keys))
            {
                if (present.Contains(slot)) continue;
                Destroy(_stalls[slot].Root);
                _stalls.Remove(slot);
                if (slot < _emptySlots.Count) _emptySlots[slot].SetActive(true);
            }
        }

        StallView CreateStall(Stall s)
        {
            var v = new StallView { Root = new GameObject("Stall" + s.slot), ProductId = s.productId };
            var t = v.Root.transform;
            t.SetParent(transform, false);
            t.position = new Vector3((float)s.x / WorldScale, StallY, 0);
            v.Root.AddComponent<SortingGroup>().sortingOrder = 1000 - Mathf.RoundToInt(StallY * 100);
            v.Umbrella = Draw.Put(t, "umbrella_" + (UmbrellaColor.TryGetValue(s.productId, out var color) ? color : "red"), new Vector2(0, 0.05f), 1, 0);
            v.Seller = Character.Create(t, s.sellerName, 1, SellerScale);
            v.Seller.SortByDepth = false;
            v.Seller.SetLook(Hash(s.sellerName));
            v.Seller.transform.localPosition = new Vector3(0, 0.35f, 0);
            v.Seller.Target = v.Seller.transform.position;
            v.Counter = Draw.Put(t, "counter_" + s.productId, Vector2.zero, 1, 10);
            v.LabelBg = Draw.Sized(t, "ui_tag", new Vector2(0, -0.27f), new Vector2(1.6f, 0.3f), 11, SpriteDrawMode.Sliced);
            v.Label = Draw.Text(t, "", new Vector2(0, -0.27f), 0.15f, Color.white, 12);
            return v;
        }

        void SyncCustomers(StreetState st)
        {
            var alive = new HashSet<string>();
            foreach (var kv in st.customers)
            {
                var k = kv.Value;
                alive.Add(kv.Key);
                if (!_customers.TryGetValue(kv.Key, out var c))
                {
                    c = Character.Create(transform, "", 0, CustomerScale);
                    if (k.touristLook != "") c.SetAppearance(k.touristLook, ",floral,,sunglasses");
                    else if (GroupLooks.TryGetValue(k.group, out var looks)) c.SetLookNamed(looks[k.look % looks.Length]);
                    else c.SetLook(k.look);
                    c.transform.position = c.Target = new Vector3((float)k.x / WorldScale, CustomerY, 0);
                    var box = c.gameObject.AddComponent<BoxCollider2D>();
                    box.offset = new Vector2(0, 0.85f);
                    box.size = new Vector2(1f, 1.8f);
                    _customers[kv.Key] = c;
                }
                c.Target = new Vector3((float)k.x / WorldScale, k.targetSlot >= 0 ? QueueY : CustomerY, 0);
                var wants = new List<string>();
                foreach (var id in k.wants.Split(',')) if (id != "") wants.Add(_net.GetProduct(id)?.name ?? id);
                c.SetSubLabel(k.status == "buy" ? "Đang mua..." : k.status == "walk" && wants.Count > 0 ? "Muốn: " + string.Join(", ", wants) : "");
            }
            RemoveStale(_customers, alive);
        }

        void RemoveStale(Dictionary<string, Character> d, HashSet<string> alive)
        {
            foreach (var id in new List<string>(d.Keys))
            {
                if (alive.Contains(id)) continue;
                Destroy(d[id].gameObject);
                d.Remove(id);
            }
        }

        // A street is one fixed screen: the camera never scrolls, it zooms so the whole street fits the width,
        // and sits with the bottom of the road at the bottom of the screen. Runs every frame so a window resize or rotation refits.
        void FitCamera()
        {
            if (!_cam) return;
            float size = (_length + 2 * ScreenMargin) / 2f / _cam.aspect;
            _cam.orthographicSize = size;
            _cam.transform.position = new Vector3(_length / 2f, RoadBottom + size, -10);
        }

        // Motorbikes ride along the road to liven up the street (client-side decoration only)
        void RunMotorbikes()
        {
            if (!_cam) return;
            if (_motorbikes.Count < 2 && UnityEngine.Random.value < Time.deltaTime * 0.4f)
            {
                bool goingRight = UnityEngine.Random.value < 0.5f;
                float half = _cam.orthographicSize * _cam.aspect + 2;
                var sprite = Traffic[UnityEngine.Random.Range(0, Traffic.Length)];
                float speed = UnityEngine.Random.Range(MotorbikeMinSpeed, MotorbikeMaxSpeed) * (goingRight ? 1 : -1);
                _motorbikes.Add(PassingBike.Create(transform, sprite, new Vector2(_cam.transform.position.x + (goingRight ? -half : half), MotorbikeY), 0.9f, 1300, speed));
            }
            for (int i = _motorbikes.Count - 1; i >= 0; i--)
            {
                var bike = _motorbikes[i];
                if (Mathf.Abs(bike.transform.position.x - _cam.transform.position.x) > _cam.orthographicSize * _cam.aspect + 3)
                {
                    Destroy(bike.gameObject);
                    _motorbikes.RemoveAt(i);
                }
            }
        }

        void HandleTap(StreetState st)
        {
            if (!Input.GetMouseButtonDown(0)) return;
            if (EventSystem.current && (EventSystem.current.IsPointerOverGameObject() ||
                (Input.touchCount > 0 && EventSystem.current.IsPointerOverGameObject(Input.GetTouch(0).fingerId)))) return;
            Vector2 w = _cam.ScreenToWorldPoint(Input.mousePosition);

            // Tapped a customer: invite them to your stall. Scenery can overlap a customer, so check every collider here.
            var hits = Physics2D.OverlapPointAll(w);
            foreach (var hit in hits)
                foreach (var kv in _customers)
                    if (kv.Value.gameObject == hit.gameObject)
                    {
                        _net.Send("inviteCustomer", new Dictionary<string, object> { ["customerId"] = kv.Key });
                        return;
                    }

            // Tapped a stall / empty slot on the sidewalk. Above an empty slot the tap belongs to the building behind it.
            if (w.y > StallY - 0.4f && w.y < StallY + 2.6f)
            {
                for (int slot = 0; slot < st.slotCount; slot++)
                {
                    if (Mathf.Abs(w.x - SlotX(slot, st)) > 0.85f) continue;
                    bool taken = st.stalls.TryGetValue(slot.ToString(), out var s);
                    if (!taken && w.y > EmptySlotTop) continue;
                    if (!taken) OnEmptySlotTapped?.Invoke(slot);
                    else if (s.ownerId == _net.Account.id) OnOwnStallTapped?.Invoke(s);
                    return;
                }
            }

            // Tapped a lot behind the sidewalk
            if (w.y > EmptySlotTop)
                for (int i = 0; i < _lots.Count; i++)
                    if (Mathf.Abs(w.x - LotX(i)) < LotHalfWidth)
                    {
                        OnLotTapped?.Invoke(i);
                        return;
                    }

            // Tapped a street object: the frontmost one reacts, and the player still walks there unless a window opens
            StreetObject tapped = null;
            foreach (var hit in hits)
                if (hit.TryGetComponent<StreetObject>(out var o) && (!tapped || o.Order > tapped.Order)) tapped = o;
            if (tapped)
            {
                var action = tapped.Interact(w);
                if (action != StreetAction.None)
                {
                    OnObjectAction?.Invoke(action);
                    return;
                }
            }

            // Otherwise: walk there
            _net.Send("move", new Dictionary<string, object> { ["x"] = Mathf.Clamp(w.x, 0, _length) * WorldScale });
        }

        public void FloatMoney(string text, Vector3 position, Color color, bool withCoin = true)
        {
            var go = new GameObject("FloatMoney");
            go.transform.SetParent(transform, false);
            go.transform.position = position;
            if (withCoin) Draw.Put(go.transform, "coin", new Vector2(-0.12f - text.Length * 0.06f, 0), 0.45f, 2000);
            OutlinedText.Create(go.transform, text, Vector2.zero, 0.24f, color, Draw.Hex("#3b2414"), 2001);
            go.AddComponent<FloatingText>();
        }
    }

    // Money text that floats up and disappears
    public class FloatingText : MonoBehaviour
    {
        float _t;
        void Update()
        {
            _t += Time.deltaTime;
            transform.position += Vector3.up * Time.deltaTime * 0.8f;
            transform.localScale = Vector3.one * Mathf.Clamp01(_t * 6f);
            if (_t > 1.5f) Destroy(gameObject);
        }
    }
}
