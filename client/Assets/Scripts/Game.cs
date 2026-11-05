// Main controller: boots itself when Play is pressed (no scene setup needed), login screen,
// HUD (avatar, level, XP, money, stamina), bottom icon bar,
// the Stall / Staff / Wardrobe / Shop / Log / Bus windows, and chat.
// All player-facing text stays Vietnamese (see CLAUDE.md).
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ViaHeOnline.Schema;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public partial class Game : MonoBehaviour
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (FindAnyObjectByType<Game>()) return;
            new GameObject("Game").AddComponent<Game>();
        }

        Network _net;
        StreetScene _scene;
        Canvas _canvas;
        Text _name, _xp, _money, _stamina, _bananas, _fame, _event, _level, _streetName, _toast, _tutorialText;
        Image _xpBar, _avatar, _rainTint;
        Button _kick;
        Text _kickLabel;
        RectTransform _hud, _window, _avatarLook, _tutorial;
        int _lastTutorial = -1, _lastMenuLevel = -1;
        bool _barReady;
        readonly Dictionary<string, GameObject> _barButtons = new Dictionary<string, GameObject>();
        readonly HashSet<GameObject> _pulsing = new HashSet<GameObject>();
        string _avatarAppearance = "";
        Action _redrawWindow;        // redraws the open window when the profile changes
        float _toastUntil;
        string _dressTarget = "";    // wardrobe: who to dress (empty = yourself)

        void Start()
        {
            Screen.orientation = ScreenOrientation.LandscapeLeft;
            Application.targetFrameRate = 60;
            var cam = Camera.main;
            if (!cam)
            {
                cam = new GameObject("Main Camera").AddComponent<Camera>();
                cam.tag = "MainCamera";
            }
            if (!cam.GetComponent<AudioListener>()) cam.gameObject.AddComponent<AudioListener>();
            cam.orthographic = true;
            cam.orthographicSize = 3.6f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Draw.Hex("#5ec2f2");
            cam.transform.position = new Vector3(6, StreetScene.CameraY, -10);

            _canvas = UIBuilder.CreateCanvas();
            ShowLogin();
        }

        // ---------- Login ----------

        void ShowLogin()
        {
            var root = UIBuilder.Box(_canvas.transform, "Login");
            UIBuilder.Fill(root);
            root.gameObject.AddComponent<Image>().color = Draw.Hex("#5ec2f2");
            var bg = UIBuilder.Image(root, "bg_city");
            bg.preserveAspect = false;
            bg.rectTransform.anchorMin = new Vector2(0, 0); bg.rectTransform.anchorMax = new Vector2(1, 0.45f);
            bg.rectTransform.offsetMin = bg.rectTransform.offsetMax = Vector2.zero;

            var panel = UIBuilder.Image(root, "ui_panel").rectTransform;
            UIBuilder.Place(panel, new Vector2(0.5f, 0.5f), new Vector2(0, -30), new Vector2(520, 560), new Vector2(0.5f, 0.5f));
            var v = panel.gameObject.AddComponent<VerticalLayoutGroup>();
            v.padding = new RectOffset(40, 40, 70, 34); v.spacing = 10;
            v.childControlWidth = true; v.childControlHeight = true; v.childForceExpandHeight = false;

            var ribbon = UIBuilder.Place(UIBuilder.Image(root, "ui_ribbon").rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0, 256), new Vector2(560, 104), new Vector2(0.5f, 0.5f));
            var title = UIBuilder.Text(ribbon, "VỈA HÈ ONLINE", 40, Color.white, TextAnchor.MiddleCenter, true);
            UIBuilder.Fill(title.rectTransform); title.rectTransform.offsetMin = new Vector2(0, 18);

            UIBuilder.Label(panel, "Tên của bạn", 20);
            var nameInput = UIBuilder.Input(panel, "Nhập tên...", PlayerPrefs.GetString("name", ""));
            UIBuilder.Label(panel, "Máy chủ", 20);
            var serverInput = UIBuilder.Input(panel, "ws://...", Network.ServerAddress);
            if (PlayerPrefs.HasKey("serverAddress")) serverInput.text = PlayerPrefs.GetString("serverAddress");
            UIBuilder.Label(panel, "Mã khôi phục (khi đổi máy)", 20);
            var codeInput = UIBuilder.Input(panel, "Bỏ trống nếu chơi mới", "");
            var status = UIBuilder.Label(panel, "", 18, Draw.Hex("#e03131"));
            Button button = null;
            button = UIBuilder.Button(panel, "VÀO PHỐ", async () =>
            {
                button.interactable = false;
                status.text = "Đang kết nối...";
                try
                {
                    PlayerPrefs.SetString("serverAddress", serverInput.text.Trim());
                    Network.ServerAddress = serverInput.text.Trim();
                    _net = new Network();
                    if (codeInput.text.Trim() != "") await _net.Recover(codeInput.text.Trim());
                    else await _net.Login(nameInput.text.Trim());
                    StartPlaying();
                    await JoinStreet(null);
                    Destroy(root.gameObject);
                    await AskForCharacter();
                }
                catch (Exception e)
                {
                    Debug.LogException(e);
                    status.text = "Không vào được: " + e.Message;
                    button.interactable = true;
                }
            }, "green", 26);
            button.GetComponent<LayoutElement>().minHeight = 64;
        }

        void StartPlaying()
        {
            _scene = new GameObject("StreetScene").AddComponent<StreetScene>();
            _scene.Bind(_net);
            _scene.OnEmptySlotTapped += OpenStallWindow;
            _scene.OnOwnStallTapped += s => AskCloseStall(s);
            _scene.OnObjectAction += RunStreetAction;
            _scene.OnLotTapped += OpenLot;
            _net.OnIncome += amount => Toast(amount > 0 ? $"Thu được {Network.Money(amount)} từ cửa hàng" : "Cửa hàng chưa có tiền để thu");
            _net.OnOrderDone += reward => { SoundFx.LevelUp(); Toast($"Giao đủ đơn hàng! Thưởng {Network.Money(reward)}"); };
            _net.OnProfileChanged += _ => RefreshHud();
            _net.OnProfileChanged += _ => _redrawWindow?.Invoke();
            _net.OnError += text => { SoundFx.Error(); Toast(text); };
            _net.OnLevelUp += m =>
            {
                if (m.id == _net.Account.id) SoundFx.LevelUp();
                Toast(m.id == _net.Account.id ? $"Chúc mừng! Bạn lên cấp {m.level}" : $"{m.name} lên cấp {m.level}");
            };
            _net.OnRoomLeft += () => Toast("Mất kết nối với phố. Bấm Về nhà để vào lại.");
            BuildHud();
        }

        // New players create their character before anything else
        async Task AskForCharacter()
        {
            for (int i = 0; i < 40 && _net.Profile == null; i++) await Task.Delay(50);
            if (_net.Profile == null || _net.Profile.appearance != null) return;
            CharacterCreator.Show(_canvas.transform, _net.Catalog.lookOptions, message => _net.Send("createCharacter", message));
        }

        async Task JoinStreet(string ownerId, int district = 0)
        {
            CloseWindow();
            _scene.Clear();
            await _net.JoinStreet(ownerId, district);
            var st = _net.Room.State;
            // the street name arrives with the first state patch
            for (int i = 0; i < 50 && string.IsNullOrEmpty(st.ownerName); i++) await Task.Delay(50);
            _streetName.text = st.ownerId == _net.Account.id ? st.districtName : $"{st.ownerName} · {st.districtName}";
            RefreshHud();
        }

        // ---------- HUD + buttons ----------

        Text Tag(string icon, Vector2 position, float width, Color textColor)
        {
            var tag = UIBuilder.Place(UIBuilder.Image(_hud, "ui_tag").rectTransform, new Vector2(0, 1), position, new Vector2(width, 42), new Vector2(0, 1));
            float left = 18;
            if (icon != null)
            {
                UIBuilder.Place(UIBuilder.Image(tag, icon).rectTransform, new Vector2(0, 0.5f), new Vector2(2, 0), new Vector2(40, 40), new Vector2(0, 0.5f));
                left = 46;
            }
            var t = UIBuilder.Text(tag, "", 21, textColor, TextAnchor.MiddleLeft, true);
            UIBuilder.Fill(t.rectTransform); t.rectTransform.offsetMin = new Vector2(left, 0);
            return t;
        }

        void BuildHud()
        {
            _hud = UIBuilder.Box(_canvas.transform, "Hud");
            UIBuilder.Fill(_hud);

            // Round avatar: gold frame with your own character's face inside
            var frame = UIBuilder.Place(UIBuilder.Image(_hud, "ui_avatar_frame").rectTransform, new Vector2(0, 1), new Vector2(12, -8), new Vector2(108, 108), new Vector2(0, 1));
            var face = UIBuilder.Box(frame, "Face");
            UIBuilder.Fill(face, 14);
            var mask = face.gameObject.AddComponent<Image>(); mask.sprite = Draw.Circle;
            face.gameObject.AddComponent<Mask>().showMaskGraphic = false;
            _avatar = UIBuilder.Image(face, "npc_worker");
            // zoom in on the head (upper part of the character)
            _avatar.preserveAspect = true;
            _avatar.rectTransform.anchorMin = new Vector2(-0.15f, -0.75f); _avatar.rectTransform.anchorMax = new Vector2(1.15f, 1.1f);
            _avatar.rectTransform.offsetMin = _avatar.rectTransform.offsetMax = Vector2.zero;
            _avatarLook = UIBuilder.Box(face, "AvatarLook");
            _avatarLook.anchorMin = new Vector2(-0.3f, -1.1f); _avatarLook.anchorMax = new Vector2(1.3f, 1.15f);
            _avatarLook.offsetMin = _avatarLook.offsetMax = Vector2.zero;
            var star = UIBuilder.Place(UIBuilder.Image(_hud, "ui_level_star").rectTransform, new Vector2(0, 1), new Vector2(80, -70), new Vector2(54, 54), new Vector2(0, 1));
            _level = UIBuilder.Text(star, "1", 20, Color.white, TextAnchor.MiddleCenter, true);
            UIBuilder.Fill(_level.rectTransform); _level.rectTransform.offsetMax = new Vector2(0, -4);

            _name = Tag(null, new Vector2(126, -14), 250, Color.white);
            var bar = UIBuilder.Place(UIBuilder.Image(_hud, "ui_bar").rectTransform, new Vector2(0, 1), new Vector2(130, -62), new Vector2(240, 18), new Vector2(0, 1));
            _xpBar = UIBuilder.Image(bar, "ui_bar_fill", Draw.Hex("#74c0fc"));
            _xpBar.rectTransform.anchorMin = Vector2.zero; _xpBar.rectTransform.anchorMax = new Vector2(0.1f, 1);
            _xpBar.rectTransform.offsetMin = _xpBar.rectTransform.offsetMax = Vector2.zero;
            _xp = UIBuilder.Text(bar, "", 12, Color.white, TextAnchor.MiddleCenter, true);
            UIBuilder.Fill(_xp.rectTransform);

            _money = Tag("coin", new Vector2(386, -14), 210, Draw.Hex("#ffe066"));
            _stamina = Tag("ui_bolt", new Vector2(604, -14), 150, Color.white);
            _bananas = Tag("icon_banana", new Vector2(386, -62), 210, Draw.Hex("#ffe066"));
            _fame = Tag("icon_fame", new Vector2(604, -62), 150, Draw.Hex("#ffe066"));

            var ribbon = UIBuilder.Place(UIBuilder.Image(_hud, "ui_ribbon").rectTransform, new Vector2(1, 1), new Vector2(-12, -6), new Vector2(330, 74), new Vector2(1, 1));
            _streetName = UIBuilder.Text(ribbon, "", 23, Color.white, TextAnchor.MiddleCenter, true);
            UIBuilder.Fill(_streetName.rectTransform); _streetName.rectTransform.offsetMin = new Vector2(0, 14);

            _rainTint = UIBuilder.Box(_hud, "RainTint").gameObject.AddComponent<Image>();
            UIBuilder.Fill(_rainTint.rectTransform);
            _rainTint.color = new Color(0.25f, 0.35f, 0.55f, 0.25f);
            _rainTint.raycastTarget = false;
            _rainTint.gameObject.SetActive(false);
            _rainTint.transform.SetAsFirstSibling();
            _event = UIBuilder.Text(_hud, "", 24, Draw.Hex("#ffe066"), TextAnchor.MiddleCenter, true);
            UIBuilder.Place(_event.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -116), new Vector2(800, 40), new Vector2(0.5f, 0.5f));

            _toast = UIBuilder.Text(_hud, "", 26, Color.white, TextAnchor.MiddleCenter, true);
            UIBuilder.Place(_toast.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -150), new Vector2(900, 50), new Vector2(0.5f, 0.5f));

            // Tutorial: the neighbourhood leader's advice sits above the bottom bar through the first session
            _tutorial = UIBuilder.Place(UIBuilder.Image(_hud, "ui_panel").rectTransform, new Vector2(0, 0), new Vector2(14, 112), new Vector2(620, 104), new Vector2(0, 0));
            UIBuilder.Place(UIBuilder.Image(_tutorial, "npc_leader").rectTransform, new Vector2(0, 0.5f), new Vector2(10, 0), new Vector2(86, 86), new Vector2(0, 0.5f));
            _tutorialText = UIBuilder.Text(_tutorial, "", 19, UIBuilder.TextDark);
            UIBuilder.Fill(_tutorialText.rectTransform, 12); _tutorialText.rectTransform.offsetMin = new Vector2(106, 12);

            _kick = UIBuilder.Button(_hud, "ĐÁ!", () => { SoundFx.Tap(); _net.Send("shuttleKick"); }, "green", 26);
            UIBuilder.Place((RectTransform)_kick.transform, new Vector2(0.5f, 0.5f), new Vector2(0, 40), new Vector2(240, 90), new Vector2(0.5f, 0.5f));
            _kickLabel = _kick.GetComponentInChildren<Text>();
            _kick.gameObject.SetActive(false);

            // Bottom bar: square icon buttons
            var buttonBar = UIBuilder.Place(UIBuilder.Box(_hud, "ButtonBar"), new Vector2(0, 0), new Vector2(14, 14), new Vector2(824, 88), new Vector2(0, 0));
            var h = buttonBar.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.spacing = 10; h.childControlWidth = true; h.childControlHeight = true; h.childForceExpandWidth = false;
            void BarButton(string label, string icon, UnityEngine.Events.UnityAction onClick, string color = "orange")
            {
                var button = UIBuilder.Button(buttonBar, label, onClick, color, 15, icon);
                var layout = button.GetComponent<LayoutElement>();
                layout.minWidth = layout.preferredWidth = 92;
                var go = button.gameObject;
                button.onClick.AddListener(() => { _pulsing.Remove(go); go.transform.localScale = Vector3.one; });
                _barButtons[label] = go;
            }
            BarButton("Dọn hàng", "icon_stall", () => OpenStallWindow(-1));
            BarButton("Nhân viên", "icon_staff", OpenStaff);
            BarButton("Tủ đồ", "icon_wardrobe", OpenWardrobe);
            BarButton("Cửa hàng", "icon_shop", OpenShop);
            BarButton("Nhật ký", "icon_log", OpenLog);
            BarButton("Xe buýt", "icon_bus", OpenBus, "green");
            BarButton("Về nhà", "icon_home", () => _ = JoinStreet(null), "blue");
            BarButton("Thêm", "icon_more", OpenMenu, "blue");

            var chat = UIBuilder.Place(UIBuilder.Box(_hud, "Chat"), new Vector2(1, 0), new Vector2(-14, 22), new Vector2(410, 60), new Vector2(1, 0));
            var hc = chat.gameObject.AddComponent<HorizontalLayoutGroup>();
            hc.spacing = 10; hc.childControlWidth = true; hc.childControlHeight = true; hc.childForceExpandWidth = false;
            var input = UIBuilder.Input(chat, "Nói gì đó...", "", true);
            void Say()
            {
                if (input.text.Trim() == "") return;
                _net.Send("say", new Dictionary<string, object> { ["text"] = input.text });
                input.text = "";
            }
            input.onEndEdit.AddListener(_ => { if (Input.GetKeyDown(KeyCode.Return)) Say(); });
            UIBuilder.Button(chat, "Nói", Say, "blue", 22);
        }

        static int Hash(string s)
        {
            unchecked { int h = 7; foreach (var c in s ?? "") h = h * 31 + c; return h & 0x7fffffff; }
        }

        void RefreshHud()
        {
            var p = _net?.Profile;
            if (p == null || _name == null) return;
            _name.text = p.name;
            _level.text = p.level.ToString();
            _xp.text = $"{p.xp}/{p.xpToLevelUp} KN";
            _xpBar.rectTransform.anchorMax = new Vector2(Mathf.Clamp(p.xp / (float)Math.Max(1, p.xpToLevelUp), 0.08f, 1), 1);
            _money.text = Network.Money(p.money);
            _stamina.text = $"{p.stamina}/20";
            _bananas.text = $"Kho {StoreUsed()}/{p.storeCapacity}";
            _fame.text = p.fame.ToString();
            _avatar.sprite = SpriteLibrary.Get(Character.LookFor(Hash(p.id)));
            var look = p.appearance == null ? "" : $"{p.appearance.gender},{p.appearance.hair},{p.appearance.brows},{p.appearance.lips},{p.appearance.cheeks},{p.appearance.earrings}";
            if (look != _avatarAppearance)
            {
                _avatarAppearance = look;
                _avatar.gameObject.SetActive(look == "");
                if (look != "") Character.FillPortrait(_avatarLook, look);
            }
            RefreshBar(p);
            RefreshTutorial(p);
        }

        static readonly string[] TutorialLines =
        {
            "Chào cháu! Bãi đất này giờ là của cháu. Chạm vào ô đất, chọn Chuối để trồng nhé.",
            "Tốt lắm! Chạm vào cây chuối để tưới, cây sẽ chín nhanh hơn.",
            "Giờ chờ chuối chín, rồi chạm vào cây để thu hoạch.",
            "Có chuối rồi! Chạm vào ô trống trên vỉa hè, chọn Chuối để dọn hàng.",
            "Chạm vào khách muốn mua chuối để mời họ tới sạp của cháu.",
            "Bán giỏi lắm! Giờ chạm ô đất trống trồng thêm vụ chuối nữa, vụ này chín sau 10 phút.",
            "Xây quán cho phố đông vui nào. Chạm ô đất trống, chọn Quán trà đá. Thiếu tiền thì bán thêm nhé.",
            "Hàng xóm đang cần giúp đấy. Bấm Xe buýt để sang một phố khác nhé.",
            "Về phố mình thôi. Chuối chín thì chạm vào cây để thu hoạch.",
            "Trồng một vụ mới trước khi nghỉ nhé. Vụ này lâu hơn, cháu quay lại là vừa chín.",
        };
        const int TutorialDone = 10;

        // Lines for the steps that change when the player is on someone else's street
        static string TutorialLine(int step, bool home)
        {
            if (!home && step == 7) return "Chạm vào cây chuối trên phố này để tưới giúp, cả hai cùng có thưởng.";
            if (!home && step == 8) return "Cảm ơn cháu! Bấm Về nhà để quay lại phố mình.";
            return TutorialLines[step];
        }

        // Entries under Thêm that open by level; entries not listed open when the tutorial ends
        static readonly (string label, int level)[] MenuUnlocks =
        {
            ("Bảng phố nổi tiếng", 3), ("Hoạt động xóm phố", 4), ("Xe cộ", 4), ("Đơn giao", 4), ("Bản đồ khu phố", 5), ("Nghề", 5),
        };

        static bool MenuOpen(Profile p, string label)
        {
            foreach (var unlock in MenuUnlocks)
                if (unlock.label == label) return p.level >= unlock.level;
            return true;
        }

        bool OnHomeStreet
        {
            get
            {
                var ownerId = _net.Room?.State?.ownerId;
                return string.IsNullOrEmpty(ownerId) || ownerId == _net.Account.id;
            }
        }

        // Buttons appear as the player reaches them. This only hides UI; the server rules do not change.
        void RefreshBar(Profile p)
        {
            bool done = p.tutorial >= TutorialDone;
            var opened = new List<string>();
            void Show(string label, bool visible, bool announce = true)
            {
                var button = _barButtons[label];
                if (visible && !button.activeSelf && announce && _barReady)
                {
                    opened.Add(label);
                    _pulsing.Add(button);
                }
                button.SetActive(visible);
            }
            Show("Dọn hàng", true);
            Show("Xe buýt", p.tutorial >= 7);
            Show("Về nhà", !OnHomeStreet, false);
            Show("Nhật ký", done);
            Show("Thêm", done);
            Show("Tủ đồ", p.level >= 2);
            Show("Cửa hàng", p.level >= 2);
            Show("Nhân viên", p.level >= 3);
            if (_barReady && done)
                foreach (var unlock in MenuUnlocks)
                    if (unlock.level > _lastMenuLevel && unlock.level <= p.level)
                    {
                        opened.Add(unlock.label);
                        _pulsing.Add(_barButtons["Thêm"]);
                    }
            _lastMenuLevel = p.level;
            _barReady = true;
            if (opened.Count > 0) Toast("Trưởng xóm: mở thêm " + string.Join(", ", opened) + " cho cháu rồi đấy!");
        }

        void RefreshTutorial(Profile p)
        {
            bool home = OnHomeStreet;
            int key = p.tutorial * 2 + (home ? 1 : 0);
            if (key == _lastTutorial) return;
            int previous = _lastTutorial < 0 ? -1 : _lastTutorial / 2;
            if (previous >= 0 && previous < 5 && p.tutorial >= 5) Toast("Bán được nải đầu tiên rồi, giỏi lắm cháu!");
            if (previous >= 0 && previous < TutorialDone && p.tutorial >= TutorialDone)
                Toast("Xong rồi! Nhật ký và Thêm đã mở. Chuối và quán trà sẽ chờ cháu quay lại.");
            _lastTutorial = key;
            bool show = p.tutorial < TutorialDone;
            _tutorial.gameObject.SetActive(show);
            if (show) _tutorialText.text = TutorialLine(p.tutorial, home);
        }

        void Toast(string text)
        {
            if (_toast == null) return;
            _toast.text = text;
            _toastUntil = Time.time + 3f;
        }

        void Update()
        {
            if (_toast && _toast.text != "" && Time.time > _toastUntil) _toast.text = "";
            float pulse = 1f + 0.08f * Mathf.Abs(Mathf.Sin(Time.time * 4f));
            foreach (var button in _pulsing) button.transform.localScale = new Vector3(pulse, pulse, 1);
            UpdateActivities();
            var state = _net?.Room?.State;
            if (_event && state != null)
            {
                var label = state.eventName == "" ? "" : "Sự kiện: " + state.eventName;
                if (_event.text != label) _event.text = label;
                bool raining = Array.IndexOf(state.@event.Split(','), "rain") >= 0;
                if (_rainTint.gameObject.activeSelf != raining) _rainTint.gameObject.SetActive(raining);
            }
        }

        // ---------- Windows ----------

        void CloseWindow()
        {
            if (_window) Destroy(_window.gameObject);
            _window = null;
            _redrawWindow = null;
        }

        // Open a window; the draw callback runs again whenever the profile changes so numbers stay current
        void OpenWindow(string title, Action<Transform> draw)
        {
            CloseWindow();
            var content = UIBuilder.Window(_canvas.transform, title, CloseWindow, out _window);
            _redrawWindow = () =>
            {
                foreach (Transform c in content) Destroy(c.gameObject);
                draw(content);
            };
            _redrawWindow();
        }

        int NearestEmptySlot()
        {
            var st = _net.Room.State;
            float myX = 0;
            foreach (var kv in st.players) if (kv.Value.id == _net.Account.id) myX = (float)kv.Value.x;
            bool isOwner = st.ownerId == _net.Account.id;
            int best = -1; float bestDist = float.MaxValue;
            for (int slot = isOwner ? 0 : st.ownerSlots; slot < st.slotCount; slot++)
            {
                if (st.stalls.ContainsKey(slot.ToString())) continue;
                float x = StreetScene.SlotX(slot, st) * StreetScene.WorldScale;
                if (Mathf.Abs(x - myX) < bestDist) { bestDist = Mathf.Abs(x - myX); best = slot; }
            }
            return best;
        }

        HashSet<string> EmployeesWorkingHere()
        {
            var s = new HashSet<string>();
            foreach (var kv in _net.Room.State.stalls) if (kv.Value.employeeId != "") s.Add(kv.Value.employeeId);
            return s;
        }

        // Vietnamese full names put the given name last
        static string GivenName(string fullName) => fullName.Split(' ')[^1];

        void RunStreetAction(StreetAction action)
        {
            switch (action)
            {
                case StreetAction.Staff: OpenStaff(); break;
                case StreetAction.Shop: OpenShop(); break;
                case StreetAction.Wardrobe: OpenWardrobe(); break;
                case StreetAction.Bus: OpenBus(); break;
            }
        }

        void OpenStallWindow(int slot)
        {
            if (_net.Profile == null || _net.Catalog == null) return;
            if (slot < 0) slot = NearestEmptySlot();
            if (slot < 0) { Toast("Phố hết chỗ dọn hàng rồi, đi xe buýt sang phố khác nhé"); return; }
            int chosenSlot = slot;
            OpenWindow($"Dọn hàng ô {slot + 1}", content =>
            {
                var p = _net.Profile;
                var working = EmployeesWorkingHere();
                UIBuilder.Label(content, "Chọn món và người đứng bán. Hàng thừa được hoàn tiền hoặc trả về kho khi dọn sạp.", 18, UIBuilder.TextMuted);
                var seasonal = _net.Room.State.eventProducts.Split(',');
                foreach (var product in _net.Catalog.products)
                {
                    if (product.seasonal && Array.IndexOf(seasonal, product.id) < 0) continue;
                    if (product.homegrown && product.id != "banana" && Stock(product.id) == 0) continue;
                    var row = UIBuilder.Row(content).transform;
                    bool unlocked = p.level >= product.unlockLevel;
                    var details = product.homegrown ? $"trong kho {Stock(product.id)} → bán {Network.Money(product.price)}" : $"nhập {Network.Money(product.cost)} → bán {Network.Money(product.price)}";
                    UIBuilder.Label(row, unlocked ? $"{product.name}   {details}" : $"{product.name}   (mở ở cấp {product.unlockLevel})",
                        19, unlocked ? UIBuilder.TextDark : UIBuilder.TextMuted);
                    if (!unlocked) continue;
                    var pr = product;
                    UIBuilder.Button(row, "Tự bán", () => OpenStall(chosenSlot, pr, null, p.level * 2), "orange", 17);
                    foreach (var employee in p.employees)
                    {
                        if (working.Contains(employee.id)) continue;
                        var e = employee;
                        UIBuilder.Button(row, GivenName(e.name), () => OpenStall(chosenSlot, pr, e.id, e.strength), "blue", 17);
                    }
                }
            });
        }

        void OpenStall(int slot, Product product, string employeeId, int strength)
        {
            int capacity = 20 + strength / 2;
            long available = product.homegrown ? Stock(product.id) : _net.Profile.money / Math.Max(1, product.cost);
            int quantity = (int)Math.Min(capacity, available);
            if (quantity < 1) { Toast(product.homegrown ? "Kho hết hàng này rồi" : "Không đủ tiền nhập hàng"); return; }
            var msg = new Dictionary<string, object> { ["slot"] = slot, ["productId"] = product.id, ["quantity"] = quantity };
            if (employeeId != null) msg["employeeId"] = employeeId;
            _net.Send("openStall", msg);
            CloseWindow();
            Toast($"Dọn {quantity} phần {product.name}. Chạm vào khách đi ngang để mời!");
        }

        void AskCloseStall(Stall s)
        {
            OpenWindow("Sạp của bạn", content =>
            {
                var product = _net.GetProduct(s.productId);
                UIBuilder.Label(content, $"{product?.name} còn {s.remaining} phần. Người bán: {s.sellerName}", 22);
                UIBuilder.Label(content, product != null && product.homegrown ? $"Dọn sạp sẽ trả {s.remaining} nải chuối về kho." : $"Dọn sạp sẽ hoàn {Network.Money(s.remaining * (product?.cost ?? 0))} tiền hàng còn lại.", 18, UIBuilder.TextMuted);
                var row = UIBuilder.Row(content, 64, false).transform;
                UIBuilder.Button(row, "Dọn sạp", () => { _net.Send("closeStall", new Dictionary<string, object> { ["slot"] = (int)s.slot }); CloseWindow(); }, "red");
                UIBuilder.Button(row, "Bán tiếp", CloseWindow, "green");
            });
        }

        void OpenStaff()
        {
            OpenWindow("Nhân viên", content =>
            {
                var p = _net.Profile;
                UIBuilder.Label(content, $"Đã thuê {p.employees.Count}/{p.maxEmployees}. Đẹp: hút khách · Khéo: bán nhanh · Khỏe: chở nhiều hàng. Nhân viên đứng sạp vẫn bán khi bạn rời phố. Lương trả mỗi ngày.", 17, UIBuilder.TextMuted);
                foreach (var employee in p.employees)
                {
                    var row = UIBuilder.Row(content).transform;
                    UIBuilder.Icon(row, "icon_staff");
                    UIBuilder.Label(row, $"{employee.name} ({TraitName(employee.trait)})   Đẹp {employee.charm} · Khéo {employee.skill} · Khỏe {employee.strength} · Lương {Network.Money(Wage(employee))}", 18);
                    var e = employee;
                    bool gardening = p.gardenerId == e.id;
                    UIBuilder.Button(row, gardening ? "Thôi trông vườn" : "Trông vườn", () => _net.Send("setGardener", new Dictionary<string, object> { ["employeeId"] = gardening ? "" : e.id }), gardening ? "gray" : "green", 15)
                        .GetComponent<LayoutElement>().minWidth = 130;
                    UIBuilder.Button(row, "Cho nghỉ", () => _net.Send("fire", new Dictionary<string, object> { ["employeeId"] = e.id }), "red", 17);
                }
                UIBuilder.Label(content, "Người xin việc", 22, Draw.Hex("#c92a2a"));
                foreach (var candidate in p.candidates)
                {
                    var row = UIBuilder.Row(content).transform;
                    UIBuilder.Icon(row, "icon_staff");
                    UIBuilder.Label(row, $"{candidate.name} ({TraitName(candidate.trait)})   Đẹp {candidate.charm} · Khéo {candidate.skill} · Khỏe {candidate.strength}", 18);
                    var c = candidate;
                    UIBuilder.Button(row, $"Thuê {Network.Money(candidate.hireCost)}", () => _net.Send("hire", new Dictionary<string, object> { ["candidateId"] = c.id }), "green", 17)
                        .GetComponent<LayoutElement>().minWidth = 180;
                }
            });
        }

        static string TraitName(string trait) => trait switch
        {
            "quick" => "Nhanh nhảu",
            "smooth" => "Dẻo miệng",
            "gardener" => "Chăm vườn",
            "gossip" => "Hay buôn chuyện",
            _ => "Bình thường",
        };

        // Must match wageOf in server/src/world.ts
        static long Wage(Employee e) => 5000 + (e.charm + e.skill + e.strength) * 100;

        void OpenBarber()
        {
            CloseWindow();
            CharacterCreator.Show(_canvas.transform, _net.Catalog.lookOptions, message => _net.Send("changeLook", message));
        }

        // ---------- More menu ----------

        void OpenMenu()
        {
            OpenWindow("Thêm", content =>
            {
                var p = _net.Profile;
                var st = _net.Room.State;
                bool mine = st.ownerId == _net.Account.id;
                void Entry(string label, string color, Action action)
                {
                    if (MenuOpen(p, label)) this.Entry(content, label, color, action);
                }
                Entry("Bản đồ khu phố", "blue", OpenMap);
                Entry("Kho hàng", "blue", OpenStore);
                Entry("Hàng xóm", "orange", OpenNeighbours);
                Entry("Hoạt động xóm phố", "orange", OpenActivities);
                Entry("Đơn giao", "orange", OpenOrders);
                Entry("Xe cộ", "orange", OpenVehicles);
                Entry("Nghề", "orange", OpenProfession);
                if (!mine && p.profession != null) Entry("Giúp phố này bằng nghề của bạn", "green", () => _net.Send("professionHelp"));
                Entry("Việc hằng ngày", "orange", OpenDaily);
                Entry("Bảng phố nổi tiếng", "orange", OpenLeaderboard);
                if (mine)
                {
                    Entry("Thu tiền các cửa hàng", "green", () => _net.Send("collectIncome"));
                }
                else
                {
                    if (!p.friends.Contains(st.ownerId)) Entry($"Kết bạn với {st.ownerName}", "green", () => _net.Send("addFriend"));
                    Entry("Báo cáo phố này", "red", () => { _net.Send("report", new Dictionary<string, object> { ["targetId"] = st.ownerId, ["reason"] = "street" }); Toast("Đã gửi báo cáo"); });
                }
                if (Array.IndexOf(st.@event.Split(','), "green_sunday") >= 0) Entry("Dọn phố cùng cả xóm", "green", () => _net.Send("tidyStreet"));
                if (st.eventGift != "" && !mine) Entry(st.eventGift, "green", () => _net.Send("giveGift"));
                if (mine && st.eventDecorations != "") Entry("Đồ trang trí dịp lễ", "orange", OpenDecorations);
                if (st.communityTarget > 0)
                {
                    UIBuilder.Label(content, $"{st.eventName}: cả game đã góp {st.communityProgress:#,0}/{st.communityTarget:#,0} nải", 18);
                    Entry($"Góp {Math.Min(20, Stock("banana"))} nải chuối", "orange", () => _net.Send("donateBananas", new Dictionary<string, object> { ["quantity"] = Math.Min(20, Stock("banana")) }));
                    Entry("Nhận thưởng lễ hội", "green", () => _net.Send("claimCommunity"));
                }
                UIBuilder.Label(content, $"Mã khôi phục: {p.recoveryCode}. Giữ mã này để lấy lại tài khoản khi đổi máy.", 18, UIBuilder.TextMuted);
                foreach (var title in p.titles) UIBuilder.Label(content, "Danh hiệu: " + title, 18);
            });
        }

        void OpenDecorations()
        {
            OpenWindow("Đồ trang trí", content =>
            {
                var onSale = _net.Room.State.eventDecorations.Split(',');
                UIBuilder.Label(content, "Mua trong dịp lễ, giữ mãi trên phố của bạn.", 18, UIBuilder.TextMuted);
                foreach (var decoration in _net.Catalog.decorations)
                {
                    if (Array.IndexOf(onSale, decoration.id) < 0) continue;
                    var d = decoration;
                    var row = UIBuilder.Row(content).transform;
                    UIBuilder.Label(row, d.name, 20);
                    if (_net.Profile.decorations.Contains(d.id)) { UIBuilder.Label(row, "Đã có", 18, UIBuilder.TextMuted); continue; }
                    UIBuilder.Button(row, Network.Money(d.price), () => _net.Send("buyDecoration", new Dictionary<string, object> { ["id"] = d.id }), "orange", 17)
                        .GetComponent<LayoutElement>().minWidth = 150;
                }
            });
        }

        void OpenDaily()
        {
            OpenWindow("Việc hằng ngày", content =>
            {
                UIBuilder.Label(content, "Bác tổ trưởng giao việc mỗi ngày. Xong mỗi việc nhận 20.000đ và 15 kinh nghiệm.", 18, UIBuilder.TextMuted);
                foreach (var task in _net.Profile.daily.tasks)
                {
                    var info = _net.Catalog.dailyTasks.Find(t => t.id == task.id);
                    var row = UIBuilder.Row(content).transform;
                    UIBuilder.Label(row, $"{info?.name ?? task.id}   {task.progress}/{task.target}" + (task.done ? "   Xong" : ""), 20, task.done ? Draw.Hex("#2f9e44") : UIBuilder.TextDark);
                }
            });
        }

        async void OpenLeaderboard()
        {
            Leaderboard board;
            try { board = await _net.GetLeaderboard(); }
            catch (Exception e) { Toast("Không tải được bảng xếp hạng: " + e.Message); return; }
            OpenWindow($"Phố nổi tiếng mùa {board.season}", content =>
            {
                int rank = 0;
                foreach (var street in board.top)
                {
                    rank++;
                    var row = UIBuilder.Row(content).transform;
                    UIBuilder.Icon(row, "icon_fame", 40);
                    UIBuilder.Label(row, $"{rank}. Phố {street.name} (cấp {street.level})   {street.fame} điểm", 19, street.ownerId == _net.Account.id ? Draw.Hex("#2f9e44") : UIBuilder.TextDark);
                }
            });
        }

        // Wear slots with their Vietnamese labels
        static readonly (string slot, string label)[] WearSlots = { ("hat", "Mũ"), ("shirt", "Áo"), ("pants", "Quần"), ("acc", "Phụ kiện") };

        void OpenWardrobe()
        {
            OpenWindow("Tủ đồ", content =>
            {
                var p = _net.Profile;
                var employee = p.employees.Find(e => e.id == _dressTarget);
                if (employee == null) _dressTarget = "";
                var outfit = employee?.outfit ?? p.outfit;

                var picker = UIBuilder.Row(content, 60, false).transform;
                UIBuilder.Label(picker, "Mặc cho:", 20).GetComponent<LayoutElement>().flexibleWidth = 0;
                UIBuilder.Button(picker, "Tôi", () => { _dressTarget = ""; _redrawWindow(); }, _dressTarget == "" ? "orange" : "gray", 17);
                foreach (var e in p.employees)
                {
                    var id = e.id;
                    UIBuilder.Button(picker, GivenName(e.name), () => { _dressTarget = id; _redrawWindow(); }, _dressTarget == id ? "orange" : "gray", 17);
                }

                foreach (var (slot, label) in WearSlots)
                {
                    var row = UIBuilder.Row(content).transform;
                    UIBuilder.Icon(row, "icon_wardrobe");
                    outfit.TryGetValue(slot, out var wornId);
                    var worn = wornId != null ? _net.GetWearable(wornId) : null;
                    UIBuilder.Label(row, $"{label}: {worn?.name ?? "(trống)"}" + (worn != null ? $"   +{worn.moneyPct}% tiền · +{worn.charm} đẹp" : ""), 19);
                    if (worn == null) continue;
                    var s = slot;
                    UIBuilder.Button(row, "Cởi", () => _net.Send("takeOff", WithDressTarget(new Dictionary<string, object> { ["slot"] = s })), "gray", 17);
                }

                UIBuilder.Label(content, p.wardrobe.Count == 0 ? "Tủ trống. Mua đồ ở Cửa hàng." : "Trong tủ", 22, Draw.Hex("#c92a2a"));
                foreach (var id in p.wardrobe)
                {
                    var w = _net.GetWearable(id);
                    if (w == null) continue;
                    var row = UIBuilder.Row(content).transform;
                    UIBuilder.Icon(row, "icon_wardrobe");
                    UIBuilder.Label(row, $"{w.name}   +{w.moneyPct}% tiền · +{w.xpPct}% KN · +{w.charm} đẹp", 19);
                    var wid = id;
                    UIBuilder.Button(row, "Mặc", () => _net.Send("wear", WithDressTarget(new Dictionary<string, object> { ["wearableId"] = wid })), "green", 17);
                }
            });
        }

        Dictionary<string, object> WithDressTarget(Dictionary<string, object> d)
        {
            if (_dressTarget != "") d["employeeId"] = _dressTarget;
            return d;
        }

        void OpenShop()
        {
            OpenWindow("Cửa hàng quần áo", content =>
            {
                var p = _net.Profile;
                foreach (var w in _net.Catalog.wearables)
                {
                    var row = UIBuilder.Row(content).transform;
                    bool unlocked = p.level >= w.unlockLevel;
                    UIBuilder.Icon(row, "icon_shop");
                    UIBuilder.Label(row, $"{w.name}   +{w.moneyPct}% tiền · +{w.xpPct}% KN · +{w.charm} đẹp" + (unlocked ? "" : $"   (cấp {w.unlockLevel})"),
                        19, unlocked ? UIBuilder.TextDark : UIBuilder.TextMuted);
                    if (!unlocked) continue;
                    var id = w.id;
                    UIBuilder.Button(row, Network.Money(w.price), () => _net.Send("buyWearable", new Dictionary<string, object> { ["wearableId"] = id }), "orange", 17)
                        .GetComponent<LayoutElement>().minWidth = 150;
                }
            });
        }

        void OpenLog()
        {
            OpenWindow("Nhật ký", content =>
            {
                var p = _net.Profile;
                if (p.log.Count == 0) UIBuilder.Label(content, "Chưa có gì. Ai ghé phố bạn, bày hàng ké hay tưới giúp sẽ hiện ở đây.", 20);
                foreach (var entry in p.log)
                {
                    var time = DateTimeOffset.FromUnixTimeMilliseconds(entry.at).ToLocalTime().ToString("HH:mm dd/MM");
                    var line = entry.type switch
                    {
                        "co_selling" or "poached" => $"Cảm ơn {entry.who} đã bày hàng ké, bán được {Network.Money(entry.amount)}",
                        "help" => $"{entry.who} đã tưới giúp vườn của bạn",
                        "sidewalk_fee" => $"Nộp {Network.Money(entry.amount)} phí vỉa hè cho phố {entry.who}",
                        _ => $"{entry.who} ghé thăm phố bạn",
                    };
                    var row = UIBuilder.Row(content).transform;
                    UIBuilder.Icon(row, entry.type == "visit" ? "icon_bus" : "coin", 40);
                    UIBuilder.Label(row, $"<color=#8aa1b8>{time}</color>   {line}", 19);
                }
            });
        }

        async void OpenBus()
        {
            List<StreetSummary> streets;
            try { streets = await _net.ListStreets(); }
            catch (Exception e) { Toast("Không tải được danh sách phố: " + e.Message); return; }
            OpenWindow("Xe buýt", content =>
            {
                UIBuilder.Label(content, "Sang phố bạn để bày hàng ké, tưới giúp và trò chuyện. Chủ phố nhận 10% phí vỉa hè.", 17, UIBuilder.TextMuted);
                if (streets.Count == 0) UIBuilder.Label(content, "Chưa có phố nào khác.", 20);
                foreach (var s in streets)
                {
                    var row = UIBuilder.Row(content).transform;
                    UIBuilder.Icon(row, "icon_home");
                    UIBuilder.Label(row, (s.isFriend ? "Bạn · " : "") + $"Phố {s.ownerName} (cấp {s.ownerLevel})   " +
                        (s.isOpen ? $"<color=#2f9e44>{s.playerCount} người · {s.stallCount} sạp</color>" : "<color=#8aa1b8>vắng</color>"), 19);
                    var id = s.ownerId;
                    var street = s;
                    UIBuilder.Button(row, "Đi", async () =>
                    {
                        try { await JoinStreet(id, street.district); }
                        catch (Exception e) { Toast("Không vào được phố: " + e.Message); _ = JoinStreet(null); }
                    }, "green", 18);
                }
            });
        }
    }
}
