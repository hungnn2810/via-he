// Heads-Up Display: player stats, currencies, street info, tutorial strip,
// bottom navigation bar with unlock logic, chat bar, and minigame button.
// All player-facing copy is in Vietnamese.
using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ViaHeOnline.Schema;

namespace ViaHeOnline
{
    public class Hud : MonoBehaviour
    {
        const int TutorialDone = 10;

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

        static readonly (string label, int level)[] MenuUnlocks =
        {
            ("Bảng phố nổi tiếng", 3),
            ("Hoạt động xóm phố", 4),
            ("Xe cộ", 4),
            ("Đơn giao", 4),
            ("Bản đồ khu phố", 5),
            ("Nghề", 5),
        };

        Network _net;
        Profile _profile;
        StreetState _state;

        // Top HUD elements
        RectTransform _avatarPortrait;
        TextMeshProUGUI _levelLabel, _nameLabel, _xpLabel;
        Image _xpFill;
        UiStatChip _moneyChip, _staminaChip, _storeChip, _fameChip;
        TextMeshProUGUI _streetNameLabel, _eventLabel;

        // Minigame
        UiTextButton _kickButton;

        // Tutorial strip
        RectTransform _tutorialStrip;
        TextMeshProUGUI _tutorialText;
        int _lastTutorial = -1;

        // Bottom bar
        readonly Dictionary<string, GameObject> _barButtons = new Dictionary<string, GameObject>();
        readonly HashSet<GameObject> _pulsing = new HashSet<GameObject>();
        bool _barReady;
        int _lastMenuLevel = -1;
        TMP_InputField _chatInput;

        // Public button callbacks
        public event Action OnStallClicked;
        public event Action OnStaffClicked;
        public event Action OnWardrobeClicked;
        public event Action OnShopClicked;
        public event Action OnLogClicked;
        public event Action OnBusClicked;
        public event Action OnHomeClicked;
        public event Action OnMenuClicked;

        public static Hud Create(Transform parent, Network net)
        {
            var go = Ui.Rect("Hud", parent);
            Ui.Stretch(go);
            var hud = go.gameObject.AddComponent<Hud>();
            hud._net = net;
            hud.Build();
            return hud;
        }

        void Build()
        {
            BuildTopBar();
            BuildMinigameButton();
            BuildTutorialStrip();
            BuildBottomBar();
            BuildChatBar();
        }

        // ---------- Top Bar ----------

        void BuildTopBar()
        {
            var top = Ui.Rect("TopBar", transform);
            Ui.Place(top, Ui.TopCenter, new Vector2(1280f, 100f), Vector2.zero, Ui.TopCenter);

            // Left: Avatar & Profile stats
            var leftGroup = Ui.Rect("ProfileGroup", top);
            Ui.Place(leftGroup, Ui.TopLeft, new Vector2(380f, 96f), new Vector2(Theme.Space3, -Theme.Space2), Ui.TopLeft);

            // Round Avatar Frame
            var avatarFrame = Ui.Img(leftGroup, "AvatarFrame", Theme.AvatarFrameSprite());
            Ui.Place(avatarFrame.rectTransform, Ui.MiddleLeft, new Vector2(88f, 88f), Vector2.zero, Ui.MiddleLeft);

            // Circular masked face inside avatar frame
            var faceMaskGo = Ui.Rect("FaceMask", avatarFrame.transform);
            Ui.Stretch(faceMaskGo, 10f, 10f, 10f, 10f);
            var maskImg = faceMaskGo.gameObject.AddComponent<Image>();
            maskImg.sprite = Draw.Circle;
            var mask = faceMaskGo.gameObject.AddComponent<Mask>();
            mask.showMaskGraphic = false;

            _avatarPortrait = Ui.Rect("Portrait", faceMaskGo.transform);
            _avatarPortrait.anchorMin = new Vector2(-0.25f, -1.05f);
            _avatarPortrait.anchorMax = new Vector2(1.25f, 1.15f);
            _avatarPortrait.offsetMin = _avatarPortrait.offsetMax = Vector2.zero;

            // Level star badge overlapping bottom right of avatar frame
            var levelStar = Ui.Img(avatarFrame.transform, "LevelStar", Theme.IconSprite(Theme.Icon.LevelStar));
            Ui.Place(levelStar.rectTransform, Ui.BottomRight, new Vector2(38f, 38f), new Vector2(4f, -4f), Ui.Center);
            _levelLabel = Ui.Label(levelStar.transform, "1", Theme.TextSm, Color.white,
                TextAlignmentOptions.Midline, Ui.Edge.Thick, name: "LevelNum");
            Ui.Stretch(_levelLabel.rectTransform);

            // Player Name & XP track
            var infoBox = Ui.Rect("InfoBox", leftGroup);
            Ui.Place(infoBox, Ui.MiddleLeft, new Vector2(270f, 74f), new Vector2(96f, 0f), Ui.MiddleLeft);

            var vInfo = infoBox.gameObject.AddComponent<VerticalLayoutGroup>();
            vInfo.spacing = 4f;
            vInfo.childControlWidth = true;
            vInfo.childControlHeight = false;

            _nameLabel = Ui.Label(infoBox, "Người chơi", Theme.TextMd, Color.white,
                TextAlignmentOptions.MidlineLeft, Ui.Edge.Thick, name: "PlayerName");
            _nameLabel.rectTransform.sizeDelta = new Vector2(0f, 32f);

            // XP bar
            var xpTrack = Ui.Rect("XpTrack", infoBox);
            xpTrack.sizeDelta = new Vector2(0f, 22f);
            var xpBg = xpTrack.gameObject.AddComponent<Image>();
            Ui.SetSprite(xpBg, Theme.BarSprite());

            var xpFillRt = Ui.Rect("Fill", xpTrack);
            xpFillRt.anchorMin = Vector2.zero;
            xpFillRt.anchorMax = new Vector2(0.3f, 1f);
            xpFillRt.offsetMin = xpFillRt.offsetMax = Vector2.zero;
            _xpFill = xpFillRt.gameObject.AddComponent<Image>();
            Ui.SetSprite(_xpFill, Theme.ProgressFillSprite(Theme.ProgressTone.Blue));

            _xpLabel = Ui.Label(xpTrack, "0/100 KN", Theme.TextXs, Color.white,
                TextAlignmentOptions.Midline, Ui.Edge.Thin, name: "XpText");
            Ui.Stretch(_xpLabel.rectTransform);

            // Center: Currencies & Stats
            var chipsBox = Ui.Rect("ChipsGroup", top);
            Ui.Place(chipsBox, Ui.TopCenter, new Vector2(480f, 88f), new Vector2(0f, -Theme.Space2), Ui.TopCenter);
            var grid = chipsBox.gameObject.AddComponent<GridLayoutGroup>();
            grid.cellSize = new Vector2(230f, Theme.ChipHeight);
            grid.spacing = new Vector2(Theme.Space2, Theme.Space2);
            grid.childAlignment = TextAnchor.MiddleCenter;

            _moneyChip = UiStatChip.Create(chipsBox, Theme.Icon.Coin, "0đ", width: 230f);
            _staminaChip = UiStatChip.Create(chipsBox, Theme.Icon.Energy, "20/20", width: 230f);
            _storeChip = UiStatChip.Create(chipsBox, Theme.Icon.Banana, "Kho 0/50", width: 230f);
            _fameChip = UiStatChip.Create(chipsBox, Theme.Icon.Fame, "0", width: 230f);

            // Right: Street / District banner & Event
            var rightBox = Ui.Rect("RightBannerGroup", top);
            Ui.Place(rightBox, Ui.TopRight, new Vector2(340f, 96f), new Vector2(-Theme.Space3, -Theme.Space2), Ui.TopRight);

            var ribbon = Ui.Img(rightBox, "StreetRibbon", Theme.RibbonSprite());
            Ui.Place(ribbon.rectTransform, Ui.TopRight, new Vector2(330f, 54f), Vector2.zero, Ui.TopRight);

            _streetNameLabel = Ui.Label(ribbon.transform, "Phố vỉa hè", Theme.TextMd, Color.white,
                TextAlignmentOptions.Midline, Ui.Edge.Thick, name: "StreetName");
            Ui.Stretch(_streetNameLabel.rectTransform, Theme.Space4, 0f, Theme.Space4, Theme.Space1);

            _eventLabel = Ui.Label(rightBox, "", Theme.TextSm, Theme.Gold,
                TextAlignmentOptions.TopRight, Ui.Edge.Thick, name: "EventLabel");
            Ui.Place(_eventLabel.rectTransform, Ui.TopRight, new Vector2(330f, 32f), new Vector2(0f, -56f), Ui.TopRight);
        }

        // ---------- Minigame Button ----------

        void BuildMinigameButton()
        {
            var holder = Ui.Rect("KickButtonHolder", transform);
            Ui.Place(holder, Ui.Center, new Vector2(200f, 72f), new Vector2(0f, 40f), Ui.Center);
            _kickButton = UiTextButton.Create(holder, "ĐÁ!", Theme.Btn.Green);
            Ui.Stretch(_kickButton.Rect);
            _kickButton.Clicked += () =>
            {
                SoundFx.Tap();
                if (_net != null) _net.Send("shuttleKick", new Dictionary<string, object>());
            };
            holder.gameObject.SetActive(false);
        }

        public void SetKickVisible(bool visible)
        {
            if (_kickButton != null && _kickButton.transform.parent != null)
            {
                _kickButton.transform.parent.gameObject.SetActive(visible);
            }
        }

        // ---------- Tutorial Strip ----------

        void BuildTutorialStrip()
        {
            var stripRt = Ui.Rect("TutorialStrip", transform);
            Ui.Place(stripRt, Ui.BottomLeft, new Vector2(620f, 104f), new Vector2(Theme.Space3, 108f), Ui.BottomLeft);
            _tutorialStrip = stripRt;

            var bg = Ui.Img(stripRt, "Bg", Theme.PanelSprite(Theme.Skin.Amber));
            Ui.Stretch(bg.rectTransform);

            // Neighbourhood leader portrait (Bác tổ trưởng)
            var leaderRt = Ui.Img(stripRt, "LeaderPortrait", "npc_leader");
            if (leaderRt)
            {
                Ui.Place(leaderRt.rectTransform, Ui.MiddleLeft, new Vector2(80f, 80f), new Vector2(Theme.Space3, 0f), Ui.MiddleLeft);
            }

            _tutorialText = Ui.Label(stripRt, "", Theme.TextMd, Theme.TextDark,
                TextAlignmentOptions.MidlineLeft, Ui.Edge.None, wrap: true, name: "TutorialText");
            Ui.Stretch(_tutorialText.rectTransform, 100f, Theme.Space2, Theme.Space4, Theme.Space2);

            _tutorialStrip.gameObject.SetActive(false);
        }

        // ---------- Bottom Navigation Bar ----------

        void BuildBottomBar()
        {
            var barRt = Ui.Rect("ButtonBar", transform);
            Ui.Place(barRt, Ui.BottomLeft, new Vector2(824f, 88f), new Vector2(Theme.Space3, Theme.Space3), Ui.BottomLeft);

            var h = barRt.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.spacing = Theme.Space2;
            h.childControlWidth = true;
            h.childControlHeight = true;
            h.childForceExpandWidth = false;

            AddBarButton(barRt, "Dọn hàng", Theme.Icon.Stall, Theme.Btn.Gold, () => OnStallClicked?.Invoke());
            AddBarButton(barRt, "Nhân viên", Theme.Icon.Staff, Theme.Btn.Gold, () => OnStaffClicked?.Invoke());
            AddBarButton(barRt, "Tủ đồ", Theme.Icon.Wardrobe, Theme.Btn.Gold, () => OnWardrobeClicked?.Invoke());
            AddBarButton(barRt, "Cửa hàng", Theme.Icon.Shop, Theme.Btn.Gold, () => OnShopClicked?.Invoke());
            AddBarButton(barRt, "Nhật ký", Theme.Icon.Log, Theme.Btn.Gold, () => OnLogClicked?.Invoke());
            AddBarButton(barRt, "Xe buýt", Theme.Icon.Bus, Theme.Btn.Green, () => OnBusClicked?.Invoke());
            AddBarButton(barRt, "Về nhà", Theme.Icon.Home, Theme.Btn.Blue, () => OnHomeClicked?.Invoke());
            AddBarButton(barRt, "Thêm", Theme.Icon.More, Theme.Btn.Blue, () => OnMenuClicked?.Invoke());
        }

        void AddBarButton(Transform parent, string label, Theme.Icon icon, Theme.Btn role, Action onClick)
        {
            var btnHolder = Ui.Rect("Btn_" + label, parent);
            var le = btnHolder.gameObject.AddComponent<LayoutElement>();
            le.minWidth = le.preferredWidth = 96f;

            var button = UiTextButton.Create(btnHolder, label, role);
            Ui.Stretch(button.Rect);

            // Add icon above text
            var iconImg = Ui.Img(button.Rect, "Icon", Theme.IconSprite(icon));
            Ui.Place(iconImg.rectTransform, Ui.TopCenter, new Vector2(36f, 36f), new Vector2(0f, -6f), Ui.TopCenter);

            // Move label down
            if (button.Label != null)
            {
                button.Label.fontSize = Theme.TextXs;
                Ui.Stretch(button.Label.rectTransform, 4f, 38f, 4f, 4f);
            }

            var go = btnHolder.gameObject;
            button.Clicked += () =>
            {
                _pulsing.Remove(go);
                go.transform.localScale = Vector3.one;
                onClick?.Invoke();
            };
            _barButtons[label] = go;
        }

        // ---------- Chat / Say Bar ----------

        void BuildChatBar()
        {
            var chat = Ui.Rect("ChatBar", transform);
            Ui.Place(chat, Ui.BottomRight, new Vector2(400f, 60f), new Vector2(-Theme.Space3, Theme.Space3), Ui.BottomRight);

            var h = chat.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.spacing = Theme.Space2;
            h.childControlWidth = true;
            h.childControlHeight = true;
            h.childForceExpandWidth = false;

            // Input field
            var inputRt = Ui.Rect("InputHolder", chat);
            var le = inputRt.gameObject.AddComponent<LayoutElement>();
            le.flexibleWidth = 1f;

            var bg = inputRt.gameObject.AddComponent<Image>();
            Ui.SetSprite(bg, Theme.RowSprite());

            var textArea = Ui.Rect("TextArea", inputRt);
            Ui.Stretch(textArea, Theme.Space3, 4f, Theme.Space3, 4f);
            textArea.gameObject.AddComponent<RectMask2D>();

            var text = Ui.Rect("Text", textArea).gameObject.AddComponent<TextMeshProUGUI>();
            var font = UiFont.Asset;
            if (font != null) text.font = font;
            text.fontSize = Theme.TextSm;
            text.color = Theme.TextDark;
            text.alignment = TextAlignmentOptions.MidlineLeft;
            text.richText = false;
            Ui.Stretch(text.rectTransform);

            var ph = Ui.Rect("Placeholder", textArea).gameObject.AddComponent<TextMeshProUGUI>();
            if (font != null) ph.font = font;
            ph.fontSize = Theme.TextSm;
            ph.color = Theme.TextMuted;
            ph.alignment = TextAlignmentOptions.MidlineLeft;
            ph.text = "Nói gì đó...";
            Ui.Stretch(ph.rectTransform);

            _chatInput = inputRt.gameObject.AddComponent<TMP_InputField>();
            _chatInput.textViewport = textArea;
            _chatInput.textComponent = text;
            _chatInput.placeholder = ph;
            if (font != null) _chatInput.fontAsset = font;

            // Send button
            var sendHolder = Ui.Rect("SendHolder", chat);
            var sendLe = sendHolder.gameObject.AddComponent<LayoutElement>();
            sendLe.minWidth = sendLe.preferredWidth = 72f;

            var sendBtn = UiTextButton.Create(sendHolder, "Nói", Theme.Btn.Blue);
            Ui.Stretch(sendBtn.Rect);
            sendBtn.Clicked += SendSay;

            _chatInput.onSubmit.AddListener(_ => SendSay());
        }

        void SendSay()
        {
            if (_chatInput == null) return;
            string txt = _chatInput.text.Trim();
            if (string.IsNullOrEmpty(txt)) return;
            if (_net != null)
            {
                _net.Send("say", new Dictionary<string, object> { ["text"] = txt });
            }
            _chatInput.text = "";
            _chatInput.ActivateInputField();
        }

        // ---------- State & Profile Sync ----------

        public void Refresh(Profile p, StreetState st = null)
        {
            _profile = p;
            if (st != null) _state = st;
            if (p == null) return;

            // Update stats
            if (_nameLabel) _nameLabel.text = p.name ?? "";
            if (_levelLabel) _levelLabel.text = p.level.ToString();

            long nextXp = Math.Max(1L, p.xpToLevelUp);
            if (_xpLabel) _xpLabel.text = $"{p.xp}/{nextXp} KN";
            if (_xpFill) _xpFill.rectTransform.anchorMax = new Vector2(Mathf.Clamp((float)p.xp / nextXp, 0.05f, 1f), 1f);

            if (_moneyChip) _moneyChip.SetValue(Network.Money(p.money));
            if (_staminaChip) _staminaChip.SetValue($"{p.stamina}/20");

            int used = StoreUsed(p);
            if (_storeChip) _storeChip.SetValue($"Kho {used}/{p.storeCapacity}");
            if (_fameChip) _fameChip.SetValue(p.fame.ToString());

            // Avatar portrait
            if (_avatarPortrait != null && p.appearance != null)
            {
                string look = $"{p.appearance.gender},{p.appearance.hair},{p.appearance.brows},{p.appearance.lips},{p.appearance.cheeks},{p.appearance.earrings}";
                Character.FillPortrait(_avatarPortrait, look);
            }

            RefreshBar(p);
            RefreshTutorial(p);
            RefreshStreetInfo();
        }

        public void RefreshStreet(StreetState st)
        {
            _state = st;
            RefreshStreetInfo();
            if (_profile != null)
            {
                RefreshBar(_profile);
                RefreshTutorial(_profile);
            }
        }

        void RefreshStreetInfo()
        {
            if (_state == null) return;

            bool isHome = OnHomeStreet;
            string streetTitle = isHome
                ? _state.districtName
                : $"{_state.ownerName} · {_state.districtName}";
            if (_streetNameLabel) _streetNameLabel.text = streetTitle ?? "";

            if (_eventLabel)
            {
                _eventLabel.text = string.IsNullOrEmpty(_state.eventName)
                    ? ""
                    : "Sự kiện: " + _state.eventName;
            }
        }

        static int StoreUsed(Profile p)
        {
            if (p?.store == null) return 0;
            int total = 0;
            foreach (var kv in p.store) total += kv.Value;
            return total;
        }

        bool OnHomeStreet
        {
            get
            {
                var ownerId = _state?.ownerId;
                return string.IsNullOrEmpty(ownerId) || (_net?.Account != null && ownerId == _net.Account.id);
            }
        }

        void RefreshBar(Profile p)
        {
            bool done = p.tutorial >= TutorialDone;
            var opened = new List<string>();

            void Show(string label, bool visible, bool announce = true)
            {
                if (!_barButtons.TryGetValue(label, out var button)) return;
                if (visible && !button.activeSelf && announce && _barReady)
                {
                    opened.Add(label);
                    _pulsing.Add(button);
                }
                button.SetActive(visible);
            }

            Show("Dọn hàng", true);
            Show("Xe buýt", p.tutorial >= 7);
            Show("Về nhà", !OnHomeStreet, announce: false);
            Show("Nhật ký", done);
            Show("Thêm", done);
            Show("Tủ đồ", p.level >= 2);
            Show("Cửa hàng", p.level >= 2);
            Show("Nhân viên", p.level >= 3);

            if (_barReady && done)
            {
                foreach (var unlock in MenuUnlocks)
                {
                    if (unlock.level > _lastMenuLevel && unlock.level <= p.level)
                    {
                        opened.Add(unlock.label);
                        if (_barButtons.TryGetValue("Thêm", out var moreBtn))
                        {
                            _pulsing.Add(moreBtn);
                        }
                    }
                }
            }
            _lastMenuLevel = p.level;
            _barReady = true;

            if (opened.Count > 0)
            {
                UiToast.Show("Trưởng xóm: mở thêm " + string.Join(", ", opened) + " cho cháu rồi đấy!", Theme.ToastTone.Success);
            }
        }

        static string TutorialLine(int step, bool home)
        {
            if (!home && step == 7) return "Chạm vào cây chuối trên phố này để tưới giúp, cả hai cùng có thưởng.";
            if (!home && step == 8) return "Cảm ơn cháu! Bấm Về nhà để quay lại phố mình.";
            if (step >= 0 && step < TutorialLines.Length) return TutorialLines[step];
            return "";
        }

        void RefreshTutorial(Profile p)
        {
            if (_tutorialStrip == null) return;
            bool home = OnHomeStreet;
            int key = p.tutorial * 2 + (home ? 1 : 0);
            if (key == _lastTutorial) return;

            int previous = _lastTutorial < 0 ? -1 : _lastTutorial / 2;
            if (previous >= 0 && previous < 5 && p.tutorial >= 5)
            {
                UiToast.Show("Bán được nải đầu tiên rồi, giỏi lắm cháu!", Theme.ToastTone.Success);
            }
            if (previous >= 0 && previous < TutorialDone && p.tutorial >= TutorialDone)
            {
                UiToast.Show("Xong rồi! Nhật ký và Thêm đã mở. Chuối và quán trà sẽ chờ cháu quay lại.", Theme.ToastTone.Success);
            }

            _lastTutorial = key;
            bool show = p.tutorial < TutorialDone;
            _tutorialStrip.gameObject.SetActive(show);
            if (show && _tutorialText)
            {
                _tutorialText.text = TutorialLine(p.tutorial, home);
            }
        }

        void Update()
        {
            if (_pulsing.Count > 0)
            {
                float pulse = 1f + 0.08f * Mathf.Abs(Mathf.Sin(Time.time * 4f));
                foreach (var button in _pulsing)
                {
                    if (button) button.transform.localScale = new Vector3(pulse, pulse, 1f);
                }
            }
        }
    }
}
