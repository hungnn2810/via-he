// Builds the side-view street from the sprite set and syncs it with the room state every frame:
// one painted backdrop (bg_street: city, river, wall, sidewalk, road), hand-cut scenery and bystanders, passing motorbikes,
// lots, stall slots, stalls, players, customers.
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
        const float BgBottom = -5.3f;

        // bg_street (2048x1152 px) spans the camera width with its bottom on BgBottom.
        // For the default 2000-unit street that is 21 units, so 1 px = 21/2048 units; the bands below are its rows in world y.
        const float BgWidthPx = 2048f;
        const float WallBaseY = -0.85f;   // foot of the river wall, row 715
        const float CurbY = -4.05f;       // sidewalk edge, row 1030
        // bg_road (2048x308 px: curb, asphalt, gutter, yellow line) hangs from the curb over the thin road painted in bg_street.
        // The camera's bottom edge is its bottom, so the city loses a strip of sky at the top instead.
        const float RoadHeight = 308f * 21f / BgWidthPx;
        const float ViewBottom = CurbY - RoadHeight;

        const float StallY = -1.85f;
        const float PlayerY = -2.75f;
        const float CustomerY = -3.25f;
        const float QueueY = -2.35f;
        const float MotorbikeY = -5.7f;   // on the asphalt, above the bottom HUD bar
        const float PlayerScale = 0.85f;
        const float CustomerScale = 0.8f;
        const float SellerScale = 0.82f;
        const float MotorbikeMinSpeed = 2.8f;
        const float MotorbikeMaxSpeed = 4.6f;
        const float DecorScale = 0.9f;

        static readonly string[] Traffic = { "traffic_sport", "traffic_cub", "traffic_scooter" };

        // Fixed street scenery: sprite, x, foot y, height in world units. Order is back to front.
        // Measured from the reference shot home.jpg (800x600): x = 6.27 + (px - 215) * 0.0235 puts the fence's right end
        // on the fence in bg_street, sidewalk y runs from the wall foot (row 360) to the curb (row 530), heights are px * 0.0197.
        // Props the reference draws on the road sit on the curb instead, so the bottom HUD bar does not cover them.
        static readonly (string Sprite, float X, float Y, float Height)[] Scenery =
        {
            ("scene_side_house", 0.65f, WallBaseY - 0.05f, 3.7f),
            ("scene_teal_shop", 9.0f, WallBaseY - 0.1f, 4.15f),
            ("scene_barber_shop", 18.15f, WallBaseY - 0.3f, 2.75f),
            ("prop_parked_bikes", 13.6f, WallBaseY - 0.05f, 1.37f),
            ("npc_old_vendor", 2.2f, WallBaseY - 0.55f, 1.58f),
            ("npc_barber", 16.95f, WallBaseY - 0.5f, 1.7f),
            ("prop_clearance_boxes", 10.7f, -2.87f, 1.19f),
            ("npc_green_cap_girl", 16.2f, -2.95f, 1.81f),
            ("npc_black_jacket", 5.65f, -3.33f, 2.2f),
            ("prop_cafe_board", 2.67f, -3.9f, 2.05f),
            ("prop_bus_sign", 18.8f, CurbY + 0.05f, 1.2f),
            ("prop_delivery_bike", 7.7f, CurbY, 1.45f),
        };

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
        const float LotY = WallBaseY - 0.15f, LotSoilY = LotY + 0.3f, CropScale = 0.75f;
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
        Transform _background;
        float _length = 20f;

        readonly Dictionary<string, Character> _players = new Dictionary<string, Character>();
        readonly Dictionary<int, StallView> _stalls = new Dictionary<int, StallView>();
        readonly List<PassingBike> _motorbikes = new List<PassingBike>();
        readonly List<LotView> _lots = new List<LotView>();
        readonly List<GameObject> _decorations = new List<GameObject>();
        readonly List<Transform> _rain = new List<Transform>();
        string _decorationKey = "";

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
            SyncStalls(st);
            SyncDecorations(st);
            SyncPlayers(st);
            SyncRain(st);
            FitCamera();
        }

        void EnsureBackground(StreetState st)
        {
            if (_background) return;
            var go = new GameObject("Background");
            go.transform.SetParent(transform, false);
            _background = go.transform;

            // Sky fills whatever a tall screen shows above the backdrop.
            Draw.Sized(_background, "bg_sky", new Vector2(_length / 2f, 4f), new Vector2(_length + 8f, 20f), Depth.Sky, SpriteDrawMode.Tiled);

            // One painted backdrop: city, river, wall, sidewalk, curb and road.
            var bg = SpriteLibrary.Get("bg_street");
            if (bg)
            {
                float width = _length + 2f * ScreenMargin;
                Draw.Put(_background, "bg_street", new Vector2(_length / 2f, BgBottom), width / bg.bounds.size.x, Depth.RiverCity);
            }
            var road = SpriteLibrary.Get("bg_road");
            if (road)
            {
                float width = _length + 2f * ScreenMargin;
                Draw.Put(_background, "bg_road", new Vector2(_length / 2f, CurbY), width / road.bounds.size.x, Depth.RiverCity + 1);
            }

            foreach (var (sprite, x, y, height) in Scenery) AddScenery(sprite, x, y, height);

            // The pole carries the "KHU PHỐ 1" street sign, so it only stands on the first district.
            if (st.district == 0) AddScenery("scene_district_pole", 16.3f, WallBaseY - 0.3f, 6.5f);
            AddScenery("prop_scissors_sign", 16.85f, 1.0f, 0.6f, Depth.Of(WallBaseY - 0.3f));
            AddScenery("prop_land_sale_sign", 3.9f, -0.1f, 0.75f, Depth.Of(WallBaseY));
        }

        // Places a sprite by world height (pivot from the sprite list) and makes it tappable if StreetObject knows it.
        void AddScenery(string sprite, float x, float y, float height, int? order = null)
        {
            var sp = SpriteLibrary.Get(sprite);
            if (!sp) return;
            var sr = Draw.Put(_background, sprite, new Vector2(x, y), height / sp.bounds.size.y, order ?? Depth.Of(y));
            StreetObject.TryAttach(sr);
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

            // The street art already has its own props, so decorations only appear for a festival.
            string deco = !string.IsNullOrEmpty(st.@event) && st.@event.Contains("tet") ? "deco_peach_tree" : null;
            if (deco == null) return;
            for (int lot = 0; lot < 3; lot++)
            {
                float x = LotX(lot) + LotSpacing / 2f;
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

        void SyncRain(StreetState st)
        {
            bool raining = !string.IsNullOrEmpty(st.@event) && st.@event.Contains("rain");
            if (raining && _rain.Count == 0)
            {
                for (int i = 0; i < RainDrops; i++)
                {
                    var drop = Draw.Block(transform, "Rain", Draw.Square, new Color(0.7f, 0.85f, 1f, 0.5f),
                        new Vector2(UnityEngine.Random.Range(0f, _length), UnityEngine.Random.Range(ViewBottom, 5f)),
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
            _cam.transform.position = new Vector3(_length / 2f, ViewBottom + size, -10f);
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
                if (drop.position.y < ViewBottom)
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

            // 3. Street object tap (before lots: shops stand on the same ground)
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

            // 4. Walk there
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
