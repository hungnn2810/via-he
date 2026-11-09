// Builds the side-view street from the sprite set and syncs it with the room state every frame:
// sky, river and city, rows of homes and shops, sidewalk, road, bystanders, parked and passing motorbikes, stall slots, stalls, players, customers.
// Tap to walk / invite a customer / open a stall / use a street object.
// Conforms strictly to docs/client/world.md.
using System;
using System.Collections.Generic;
using ViaHeOnline.Schema;
using UnityEngine;
using UnityEngine.EventSystems;

namespace ViaHeOnline
{
    public class StreetScene : MonoBehaviour
    {
        // World coordinate contract with server
        public const float WorldScale = 100f;
        public const float CameraY = 0.3f;
        const float ScreenMargin = 0.5f;
        const float RoadBottom = -5.3f;
        const float EmptySlotTop = 1.35f;
        const float StallY = 0.15f;
        const float PlayerY = -0.85f;
        const float CustomerY = -1.45f;
        const float QueueY = -0.35f;
        const float MotorbikeY = -2.95f;
        const float PlayerScale = 0.85f;
        const float CustomerScale = 0.8f;
        const float SellerScale = 0.82f;
        const float MotorbikeMinSpeed = 2.8f;
        const float MotorbikeMaxSpeed = 4.6f;
        const float ShopScale = 0.72f;
        const float RiverCityY = 2.1f;
        const float BystanderY = 0.2f;
        const float ParkedBikeY = -1.85f;
        const float DecorScale = 0.9f;

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

        static readonly Dictionary<string, string[]> GroupLooks = new Dictionary<string, string[]>
        {
            ["homemaker"] = new[] { "npc_girl", "npc_farmer" },
            ["student"] = new[] { "npc_cap_man", "npc_worker" },
        };

        const float FirstSlotX = 220f, LastSlotMargin = 220f;
        const float LotWidth = 4.5f, LotSpacing = LotWidth, LotStartX = 1f + LotWidth / 2f, LotHalfWidth = LotWidth / 2f;
        const float LotY = 1.1f, LotSoilY = 1.6f, CropScale = 0.75f, LandY = 0.9f;
        const float LotLabelHeight = 0.55f;
        const int RainDrops = 70;
        const float LotScale = 0.72f;

        public static readonly Dictionary<string, string> UmbrellaColor = new Dictionary<string, string>
        {
            ["banana"] = "yellow", ["fried_banana"] = "orange", ["banana_soup"] = "purple",
            ["fresh_cane"] = "green", ["banana_cake"] = "red", ["grandma_soup"] = "purple",
            ["banh_chung"] = "green", ["sugarcane_juice"] = "green", ["moon_cake"] = "orange",
            ["iced_tea"] = "blue", ["banh_mi"] = "red", ["sticky_rice"] = "yellow",
            ["sweet_soup"] = "purple", ["popsicle"] = "blue", ["rambutan"] = "green",
            ["flowers"] = "orange", ["tofu_noodles"] = "yellow", ["fresh_milk"] = "green",
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

        public event Action<int> OnEmptySlotTapped;
        public event Action<Stall> OnOwnStallTapped;
        public event Action<int> OnLotTapped;
        public event Action<StreetAction> OnObjectAction;

        class StallView
        {
            public GameObject Root;
            public SpriteRenderer Umbrella;
            public SpriteRenderer Counter;
            public Character Seller;
            public string ProductId;
        }

        class LotView
        {
            public GameObject Root;
            public SpriteRenderer BaseRenderer;
            public SpriteRenderer CropRenderer;
            public TextMesh Label;
        }

        public void Init(Network net, Camera cam)
        {
            _net = net;
            _cam = cam;
            StreetObject.GetActiveEvent = () => net?.Room?.State?.@event ?? "";
        }

        public static float SlotX(int slot, StreetState st) =>
            (float)((FirstSlotX + slot * (st.length - FirstSlotX - LastSlotMargin) / Mathf.Max(1, st.slotCount - 1)) / WorldScale);

        public static float LotX(int index) => LotStartX + index * LotSpacing;

        public void Sync(StreetState st)
        {
            if (st == null) return;
            _length = (float)(st.length / WorldScale);

            EnsureBackground(st);
            SyncLots(st);
            SyncSlots(st);
            SyncStalls(st);
            SyncDecorations(st);
            SyncPlayers(st);
            SyncCustomers(st);
            SyncRain(st);
            FitCamera();
        }

        void EnsureBackground(StreetState st)
        {
            if (_background) return;
            var go = new GameObject("Background");
            go.transform.SetParent(transform, false);
            _background = go.transform;

            // Sky
            var sky = Draw.Sized(_background, "bg_sky", new Vector2(_length / 2f, 2f), new Vector2(_length + 8f, 10f), -1000, SpriteDrawMode.Tiled);

            // River city backdrop
            if (SpriteLibrary.Has("bg_river_city"))
            {
                var city = Draw.Sized(_background, "bg_river_city", new Vector2(_length / 2f, RiverCityY), new Vector2(_length + 8f, 2.7f), Depth.RiverCity, SpriteDrawMode.Tiled);
                _farCity = city.transform;
            }

            // District land strip
            string landSprite = "bg_land_" + st.district;
            if (!SpriteLibrary.Has(landSprite)) landSprite = "bg_land_0";
            Draw.Sized(_background, landSprite, new Vector2(0f, LandY), new Vector2(_length, 1.5f), Depth.Land, SpriteDrawMode.Tiled);

            // Sidewalk, curb, road
            Draw.Sized(_background, "street_sidewalk", new Vector2(0f, -1.2f), new Vector2(_length, 1.5f), Depth.Sidewalk, SpriteDrawMode.Tiled);
            Draw.Sized(_background, "street_curb", new Vector2(0f, -2.4f), new Vector2(_length, 0.4f), Depth.Curb, SpriteDrawMode.Tiled);
            Draw.Sized(_background, "street_road", new Vector2(0f, -4.0f), new Vector2(_length, 2.0f), Depth.Road, SpriteDrawMode.Tiled);

            // Continuous background houses row
            AddBackgroundHouses();

            // Scenery shops & buildings
            AddSceneryBuilding("shop_job_office", 2f, LandY);
            AddSceneryBuilding("shop_market", _length - 3f, LandY);
            AddSceneryBuilding("bus_stop", _length - 1f, StallY);
        }

        void AddBackgroundHouses()
        {
            float houseWidth = 2.25f;
            int index = 0;
            for (float x = 0f; x <= _length + houseWidth; x += houseWidth)
            {
                string houseSprite = $"house_{index % 5}";
                if (SpriteLibrary.Has(houseSprite))
                {
                    Draw.Put(_background, houseSprite, new Vector2(x, 1.05f), ShopScale, Depth.Of(1.05f));
                }
                index++;
            }
        }

        void AddSceneryBuilding(string sprite, float x, float y)
        {
            if (!SpriteLibrary.Has(sprite)) return;
            var sr = Draw.Put(_background, sprite, new Vector2(x, y), ShopScale, Depth.Of(y));
            StreetObject.TryAttach(sr);
        }

        void SyncLots(StreetState st)
        {
            int count = st.lots != null ? st.lots.Count : 0;
            while (_lots.Count < count)
            {
                int index = _lots.Count;
                var root = new GameObject($"Lot_{index}");
                root.transform.SetParent(transform, false);
                float x = LotX(index);
                root.transform.localPosition = new Vector3(x, LotY, 0f);

                var baseSr = Draw.Put(root.transform, "lot_soil", new Vector2(0f, LotSoilY - LotY), LotScale, Depth.Of(LotSoilY) - 5);
                var cropSr = Draw.Put(root.transform, "banana_stage_1", new Vector2(0f, 0.2f), CropScale, Depth.Of(LotY + 0.2f));
                cropSr.gameObject.SetActive(false);

                var label = Draw.Text(root.transform, "", new Vector2(0f, LotLabelHeight), 0.18f, Theme.Gold, Depth.BubbleText);

                _lots.Add(new LotView
                {
                    Root = root,
                    BaseRenderer = baseSr,
                    CropRenderer = cropSr,
                    Label = label
                });
            }

            bool mine = _net?.Account != null && st.ownerId == _net.Account.id;
            long now = _net != null ? _net.ServerNow : 0;

            for (int i = 0; i < _lots.Count; i++)
            {
                var view = _lots[i];
                if (!st.lots.TryGetValue(i.ToString(), out var lot))
                {
                    view.Root.SetActive(false);
                    continue;
                }
                view.Root.SetActive(true);

                long readyAt = (long)lot.readyAt;
                long plantedAt = (long)lot.plantedAt;

                if (!string.IsNullOrEmpty(lot.building))
                {
                    view.CropRenderer.gameObject.SetActive(false);
                    bool finished = readyAt == 0 || now >= readyAt;
                    string bSprite = finished ? "building_" + lot.building : "building_scaffold";
                    if (!SpriteLibrary.Has(bSprite)) bSprite = "building_scaffold";
                    view.BaseRenderer.sprite = SpriteLibrary.Get(bSprite);
                    view.BaseRenderer.sortingOrder = Depth.Of(LotY);
                    view.Label.text = finished
                        ? (!string.IsNullOrEmpty(lot.recipe) && now >= (long)lot.cookReadyAt ? "Món đã chín" : "")
                        : "Đang xây...";
                }
                else if (!string.IsNullOrEmpty(lot.crop))
                {
                    view.BaseRenderer.sprite = SpriteLibrary.Get("lot_soil");
                    view.BaseRenderer.sortingOrder = Depth.Of(LotSoilY) - 5;
                    view.CropRenderer.gameObject.SetActive(true);

                    bool ripe = readyAt > 0 && now >= readyAt;
                    int stage = 1;
                    if (ripe) stage = 3;
                    else if (readyAt > plantedAt)
                    {
                        float grown = (now - plantedAt) / (float)Math.Max(1, readyAt - plantedAt);
                        stage = grown < 0.5f ? 1 : 2;
                    }

                    string cropName = lot.crop == "banana" ? $"banana_stage_{stage}" : $"crop_{lot.crop}_{stage}";
                    if (!SpriteLibrary.Has(cropName)) cropName = "banana_stage_1";
                    view.CropRenderer.sprite = SpriteLibrary.Get(cropName);
                    view.CropRenderer.sortingOrder = Depth.Of(LotY + 0.2f);
                    view.Label.text = ripe ? (mine ? "Thu hoạch" : "Đã chín") : (lot.watered ? "Đã tưới" : "Tưới");
                }
                else
                {
                    view.CropRenderer.gameObject.SetActive(false);
                    view.BaseRenderer.sprite = SpriteLibrary.Get("lot_soil");
                    view.BaseRenderer.sortingOrder = Depth.Of(LotSoilY) - 5;
                    view.Label.text = "";
                }
            }
        }

        void SyncSlots(StreetState st)
        {
            float slotDist = st.slotCount > 1
                ? (float)((st.length - FirstSlotX - LastSlotMargin) / (st.slotCount - 1) / WorldScale)
                : 2.5f;

            // slot_empty is 260px wide = 1.3 Unity units at scale 1.0
            float baseScale = 0.8f;
            float maxAllowedWidth = slotDist * 0.9f;
            float targetScale = Mathf.Min(baseScale, maxAllowedWidth / 1.3f);

            while (_emptySlots.Count < st.slotCount)
            {
                int slot = _emptySlots.Count;
                string sp = slot < st.ownerSlots ? "slot_owner" : "slot_empty";
                if (!SpriteLibrary.Has(sp)) sp = "slot_item";
                var go = Draw.Put(transform, sp, new Vector2(SlotX(slot, st), StallY), targetScale, Depth.Of(StallY) - 5).gameObject;
                _emptySlots.Add(go);
            }
            for (int i = 0; i < _emptySlots.Count; i++)
            {
                bool taken = st.stalls != null && st.stalls.ContainsKey(i.ToString());
                _emptySlots[i].SetActive(!taken && i < st.slotCount);
                if (i < st.slotCount)
                {
                    _emptySlots[i].transform.localPosition = new Vector3(SlotX(i, st), StallY, 0f);
                    _emptySlots[i].transform.localScale = new Vector3(targetScale, targetScale, 1f);
                }
            }
        }

        void SyncStalls(StreetState st)
        {
            if (st.stalls == null) return;
            var activeSlots = new HashSet<int>();

            foreach (var kv in st.stalls)
            {
                if (!int.TryParse(kv.Key, out int slot)) continue;
                activeSlots.Add(slot);
                var s = kv.Value;

                if (!_stalls.TryGetValue(slot, out var view))
                {
                    var root = new GameObject($"Stall_{slot}");
                    root.transform.SetParent(transform, false);

                    int stallDepth = Depth.Of(StallY);
                    string color = UmbrellaColor.TryGetValue(s.productId, out var c) ? c : "red";
                    var umb = Draw.Put(root.transform, $"umbrella_{color}", new Vector2(0f, 1.4f), 0.9f, stallDepth - 2);
                    var cnt = Draw.Put(root.transform, $"counter_{s.productId}", Vector2.zero, SellerScale, stallDepth + 1);
                    var seller = Character.Create(root.transform, "Người bán", stallDepth, SellerScale);
                    seller.transform.localPosition = new Vector3(0f, 0.45f, 0f);
                    seller.SortByDepth = false;

                    view = new StallView
                    {
                        Root = root,
                        Umbrella = umb,
                        Counter = cnt,
                        Seller = seller,
                        ProductId = s.productId
                    };
                    _stalls[slot] = view;
                }

                view.Root.SetActive(true);
                float x = SlotX(slot, st);
                view.Root.transform.localPosition = new Vector3(x, StallY, 0f);

                if (view.ProductId != s.productId)
                {
                    view.ProductId = s.productId;
                    string color = UmbrellaColor.TryGetValue(s.productId, out var c) ? c : "red";
                    view.Umbrella.sprite = SpriteLibrary.Get($"umbrella_{color}");
                    view.Counter.sprite = SpriteLibrary.Get($"counter_{s.productId}");
                }
            }

            foreach (var kv in _stalls)
            {
                if (!activeSlots.Contains(kv.Key)) kv.Value.Root.SetActive(false);
            }
        }

        void SyncDecorations(StreetState st)
        {
            string key = $"{st.district}_{st.@event}";
            if (_decorationKey == key) return;
            _decorationKey = key;

            foreach (var d in _decorations) if (d) Destroy(d);
            _decorations.Clear();

            // Bystanders and parked bikes between sidewalk slots
            for (int slot = 0; slot < st.slotCount - 1; slot++)
            {
                float x = (SlotX(slot, st) + SlotX(slot + 1, st)) / 2f;
                int bIndex = (slot / 2) % Bystanders.Length;
                var bSprite = Bystanders[bIndex];
                if (SpriteLibrary.Has(bSprite))
                {
                    var bSr = Draw.Put(transform, bSprite, new Vector2(x, BystanderY), 0.8f, Depth.Of(BystanderY));
                    StreetObject.TryAttach(bSr);
                    _decorations.Add(bSr.gameObject);
                }

                int pIndex = (slot / 2) % ParkedBikes.Length;
                var pSprite = ParkedBikes[pIndex];
                if (SpriteLibrary.Has(pSprite))
                {
                    var pSr = Draw.Put(transform, pSprite, new Vector2(x + 0.35f, ParkedBikeY), 0.8f, Depth.Of(ParkedBikeY));
                    StreetObject.TryAttach(pSr);
                    _decorations.Add(pSr.gameObject);
                }
            }

            // Seasonal decorations between lots
            for (int lot = 0; lot < 4; lot++)
            {
                float x = LotX(lot) + LotSpacing / 2f;
                string deco = "deco_trophy";
                if (!string.IsNullOrEmpty(st.@event) && st.@event.Contains("tet")) deco = "deco_peach_tree";
                if (SpriteLibrary.Has(deco))
                {
                    var dSr = Draw.Put(transform, deco, new Vector2(x, LotY), DecorScale, Depth.Of(LotY));
                    _decorations.Add(dSr.gameObject);
                }
            }
        }

        void SyncPlayers(StreetState st)
        {
            if (st.players == null) return;
            var active = new HashSet<string>();

            foreach (var kv in st.players)
            {
                active.Add(kv.Key);
                var p = kv.Value;

                if (!_players.TryGetValue(kv.Key, out var c))
                {
                    c = Character.Create(transform, p.name, Depth.Of(PlayerY), PlayerScale);
                    c.transform.position = new Vector3((float)p.x / WorldScale, PlayerY, 0f);
                    c.Target = c.transform.position;
                    _players[kv.Key] = c;
                }

                c.SetName(p.name, Color.white);
                c.Target = new Vector3((float)p.targetX / WorldScale, PlayerY, 0f);
                if (!string.IsNullOrEmpty(p.look)) c.SetAppearance(p.look, p.outfit);
                else c.SetLook(p.name.GetHashCode());
                c.SetVehicle(p.vehicle);
            }

            var removed = new List<string>();
            foreach (var kv in _players)
            {
                if (!active.Contains(kv.Key))
                {
                    Destroy(kv.Value.gameObject);
                    removed.Add(kv.Key);
                }
            }
            foreach (var k in removed) _players.Remove(k);
        }

        void SyncCustomers(StreetState st)
        {
            if (st.customers == null) return;
            var active = new HashSet<string>();

            foreach (var kv in st.customers)
            {
                active.Add(kv.Key);
                var cust = kv.Value;

                if (!_customers.TryGetValue(kv.Key, out var c))
                {
                    c = Character.Create(transform, "", Depth.Of(CustomerY), CustomerScale);
                    c.transform.position = new Vector3((float)cust.x / WorldScale, CustomerY, 0f);
                    c.Target = c.transform.position;
                    c.SetLook(cust.look);
                    var col = c.gameObject.AddComponent<BoxCollider2D>();
                    col.size = new Vector2(0.8f, 1.8f);
                    col.offset = new Vector2(0f, 0.9f);
                    _customers[kv.Key] = c;
                }

                c.SetName("", Theme.Gold);
                c.Target = new Vector3((float)cust.x / WorldScale, cust.targetSlot >= 0 ? QueueY : CustomerY, 0f);
                if (!string.IsNullOrEmpty(cust.wants)) c.SetSubLabel($"Muốn: {cust.wants}");
                else c.SetSubLabel("");
            }

            var removed = new List<string>();
            foreach (var kv in _customers)
            {
                if (!active.Contains(kv.Key))
                {
                    Destroy(kv.Value.gameObject);
                    removed.Add(kv.Key);
                }
            }
            foreach (var k in removed) _customers.Remove(k);
        }

        void SyncRain(StreetState st)
        {
            bool raining = !string.IsNullOrEmpty(st.@event) && st.@event.Contains("rain");
            if (raining && _rain.Count == 0)
            {
                for (int i = 0; i < RainDrops; i++)
                {
                    var drop = Draw.Block(transform, "Rain", Draw.Square, new Color(0.7f, 0.85f, 1f, 0.5f),
                        new Vector2(UnityEngine.Random.Range(0f, _length), UnityEngine.Random.Range(-5f, 5f)),
                        new Vector2(0.02f, 0.35f), Depth.Rain).transform;
                    _rain.Add(drop);
                }
            }
            else if (!raining && _rain.Count > 0)
            {
                foreach (var r in _rain) if (r) Destroy(r.gameObject);
                _rain.Clear();
            }
        }

        public void FitCamera()
        {
            if (!_cam) return;
            float size = (_length + 2f * ScreenMargin) / 2f / Mathf.Max(0.1f, _cam.aspect);
            _cam.orthographicSize = size;
            _cam.transform.position = new Vector3(_length / 2f, RoadBottom + size, -10f);
        }

        void Update()
        {
            RunMotorbikes();
            UpdateRain();
            if (_net?.Room?.State != null) HandleTap(_net.Room.State);
        }

        void RunMotorbikes()
        {
            if (!_cam) return;
            if (_motorbikes.Count < 2 && UnityEngine.Random.value < Time.deltaTime * 0.4f)
            {
                bool goingRight = UnityEngine.Random.value < 0.5f;
                float half = _cam.orthographicSize * _cam.aspect + 2f;
                var sprite = Traffic[UnityEngine.Random.Range(0, Traffic.Length)];
                float speed = UnityEngine.Random.Range(MotorbikeMinSpeed, MotorbikeMaxSpeed) * (goingRight ? 1f : -1f);
                _motorbikes.Add(PassingBike.Create(transform, sprite,
                    new Vector2(_cam.transform.position.x + (goingRight ? -half : half), MotorbikeY), 0.9f, Depth.Traffic, speed));
            }
            for (int i = _motorbikes.Count - 1; i >= 0; i--)
            {
                var bike = _motorbikes[i];
                if (!bike || Mathf.Abs(bike.transform.position.x - _cam.transform.position.x) > _cam.orthographicSize * _cam.aspect + 3f)
                {
                    if (bike) Destroy(bike.gameObject);
                    _motorbikes.RemoveAt(i);
                }
            }
        }

        void UpdateRain()
        {
            if (_rain.Count == 0) return;
            for (int i = 0; i < _rain.Count; i++)
            {
                var drop = _rain[i];
                if (!drop) continue;
                drop.position += new Vector3(-0.06f, -0.25f, 0f);
                if (drop.position.y < -5f)
                {
                    drop.position = new Vector3(UnityEngine.Random.Range(0f, _length), 5f, 0f);
                }
            }
        }

        void HandleTap(StreetState st)
        {
            if (!Input.GetMouseButtonDown(0)) return;
            if (EventSystem.current && (EventSystem.current.IsPointerOverGameObject() ||
                (Input.touchCount > 0 && EventSystem.current.IsPointerOverGameObject(Input.GetTouch(0).fingerId)))) return;
            if (UiRoot.Instance != null && UiRoot.Instance.HasOpenPanel) return;

            Vector2 w = _cam.ScreenToWorldPoint(Input.mousePosition);

            // 1. Customer tap
            var hits = Physics2D.OverlapPointAll(w);
            foreach (var hit in hits)
            {
                foreach (var kv in _customers)
                {
                    if (kv.Value && kv.Value.gameObject == hit.gameObject)
                    {
                        if (_net != null) _net.Send("inviteCustomer", new Dictionary<string, object> { ["customerId"] = kv.Key });
                        kv.Value.Surprise();
                        return;
                    }
                }
            }

            // 2. Sidewalk slot tap
            if (w.y > StallY - 0.4f && w.y < StallY + 2.6f)
            {
                for (int slot = 0; slot < st.slotCount; slot++)
                {
                    if (Mathf.Abs(w.x - SlotX(slot, st)) > 0.85f) continue;
                    Stall s = null;
                    bool taken = st.stalls != null && st.stalls.TryGetValue(slot.ToString(), out s);
                    if (!taken && w.y > EmptySlotTop) continue;
                    if (!taken) OnEmptySlotTapped?.Invoke(slot);
                    else if (s != null && s.ownerId == _net?.Account?.id) OnOwnStallTapped?.Invoke(s);
                    return;
                }
            }

            // 3. Lot tap behind sidewalk
            if (w.y > EmptySlotTop)
            {
                for (int i = 0; i < _lots.Count; i++)
                {
                    if (Mathf.Abs(w.x - LotX(i)) < LotHalfWidth)
                    {
                        OnLotTapped?.Invoke(i);
                        return;
                    }
                }
            }

            // 4. Street object tap
            StreetObject tapped = null;
            foreach (var hit in hits)
            {
                if (hit.TryGetComponent<StreetObject>(out var o) && (!tapped || o.Order > tapped.Order)) tapped = o;
            }
            if (tapped)
            {
                var action = tapped.Interact(w);
                if (action != StreetAction.None)
                {
                    OnObjectAction?.Invoke(action);
                    return;
                }
            }

            // 5. Walk there
            if (_net != null) _net.Send("move", new Dictionary<string, object> { ["x"] = Mathf.Clamp(w.x, 0f, _length) * WorldScale });
        }

        public void FloatMoney(string text, Vector3 position, Color color, bool withCoin = true)
        {
            var go = new GameObject("FloatMoney");
            go.transform.SetParent(transform, false);
            go.transform.position = position;
            if (withCoin) Draw.Put(go.transform, "icon_coin", new Vector2(-0.12f - text.Length * 0.06f, 0f), 0.45f, Depth.FloatMoney);
            Draw.Outlined(go.transform, text, Vector2.zero, 0.24f, color, Depth.FloatMoneyText);
            go.AddComponent<FloatingText>();
        }
    }

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
