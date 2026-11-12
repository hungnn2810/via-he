// Heads-Up Display: player stats, currencies, street info, tutorial strip,
// bottom dock with district tabs, top-right feature cluster, chat bar, and minigame button.
// All player-facing copy is in Vietnamese.
// See docs/client/art-direction.md for information architecture and visual specification.
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ViaHeOnline.Schema;

namespace ViaHeOnline
{
    public class Hud : MonoBehaviour
    {
        const int TutorialDone = 10;
        static readonly string[] DistrictNames =
        {
            "Bãi đất", "Ven sông", "Gần chợ", "Phố cổ", "Cổng trường",
            "Bến xe buýt", "Chợ đêm", "Bờ hồ", "Phố ẩm thực", "Phố đi bộ",
        };


        Network _net;
        Profile _profile;
        StreetState _state;

        // Top-Left: Player block
        RectTransform _avatarPortrait;
        TextMeshProUGUI _levelLabel, _nameLabel, _xpLabel;
        Image _xpFill;
        UiStatChip _moneyChip, _staminaChip, _storeChip, _fameChip;

        // Top-Right: Feature cluster & Countdown pill
        UiIconButton _btnMap, _btnMarket, _btnNeighbours, _btnOrders, _btnSeason, _btnFortune, _btnActivities;
        UiBadge _badgeMap, _badgeNeighbours, _badgeOrders;
        TextMeshProUGUI _countdownLabel;
        TextMeshProUGUI _streetNameLabel;

        // Minigame
        UiTextButton _kickButton;

        // Tutorial strip
        RectTransform _tutorialStrip;
        TextMeshProUGUI _tutorialText;
        int _lastTutorial = -1;

        // Bottom dock elements
        // Tabs 0..MaxDistricts-1 are the player's own districts (the first is free), the rest are server-owned public districts
        const int MaxDistricts = 10;
        static readonly string[] PublicDistrictIds = { "public-market", "public-plaza" };
        static readonly string[] PublicDistrictNames = { "Chợ trung tâm", "Quảng trường" };
        const int TabCount = MaxDistricts + 2;
        readonly DistrictTabItem[] _districtTabs = new DistrictTabItem[TabCount];
        readonly int[] _districtPlayerCounts = new int[TabCount];
        float _lastOccupancyFetchTime = -999f;
        TMP_InputField _chatInput;

        class DistrictTabItem
        {
            public int Index;
            public RectTransform Root;
            public Image Background;
            public TextMeshProUGUI TitleLabel;
            public TextMeshProUGUI OccupancyLabel;
            public Image LockIcon;
        }

        // Public button callbacks
        public event Action OnHomeClicked;
        public event Action OnBusClicked;
        public event Action OnMenuClicked;
        public event Action<int> OnDistrictSelected;
        public event Action<string> OnPublicDistrictSelected;

        // Feature cluster events
        public event Action OnMapClicked;
        public event Action OnMarketClicked;
        public event Action OnNeighboursClicked;
        public event Action OnOrdersClicked;
        public event Action OnSeasonClicked;
        public event Action OnFortuneClicked;
        public event Action OnActivitiesClicked;

        // Overflow / more events (retained for backward compatibility and feature wires)
        public event Action OnStallClicked;
        public event Action OnStaffClicked;
        public event Action OnWardrobeClicked;
        public event Action OnShopClicked;
        public event Action OnLogClicked;
        public event Action OnBarberClicked;
        public event Action OnDecorationClicked;
        public event Action OnDailyClicked;
        public event Action OnStoreClicked;
        public event Action OnProfessionClicked;
        public event Action OnVehicleClicked;
        public event Action OnLeaderboardClicked;
        public event Action OnCafeClicked;

        public static Hud Create(Transform parent, Network net)
        {
            var go = Ui.Rect("Hud", parent);
            Ui.Stretch(go);
            go.gameObject.AddComponent<UiSafeArea>();
            var hud = go.gameObject.AddComponent<Hud>();
            hud._net = net;
            hud.Build();
            return hud;
        }

        void Build()
        {
            BuildTopBar();
            BuildMinigameButton();
            BuildBottomDock();
        }

        // =========================================================================
        // Top Bar: Player Block (Left) & Feature Cluster (Right)
        // =========================================================================

        void BuildTopBar()
        {
            var top = Ui.Rect("TopBar", transform);
            top.anchorMin = new Vector2(0f, 1f);
            top.anchorMax = new Vector2(1f, 1f);
            top.pivot = new Vector2(0.5f, 1f);
            top.offsetMin = new Vector2(Theme.Space3, -100f);
            top.offsetMax = new Vector2(-Theme.Space3, 0f);

            BuildPlayerBlock(top);
            BuildFeatureCluster(top);
        }

        void BuildPlayerBlock(Transform parent)
        {
            var leftGroup = Ui.Rect("PlayerBlock", parent);
            Ui.Place(leftGroup, Ui.TopLeft, new Vector2(520f, 96f), new Vector2(0f, -Theme.Space1), Ui.TopLeft);

            // Circular avatar frame
            var avatarFrame = Ui.Img(leftGroup, "AvatarFrame", Theme.AvatarFrameSprite());
            Ui.Place(avatarFrame.rectTransform, Ui.TopLeft, new Vector2(72f, 72f), new Vector2(0f, -6f), Ui.TopLeft);

            var faceMaskGo = Ui.Rect("FaceMask", avatarFrame.transform);
            Ui.Stretch(faceMaskGo, 8f, 8f, 8f, 8f);
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
            Ui.Place(levelStar.rectTransform, Ui.BottomRight, new Vector2(34f, 34f), new Vector2(4f, -4f), Ui.Center);
            _levelLabel = Ui.Label(levelStar.transform, "1", Theme.TextSm, Color.white,
                TextAlignmentOptions.Midline, Ui.Edge.Thick, name: "LevelNum");
            _levelLabel.overflowMode = TextOverflowModes.Overflow;
            Ui.Stretch(_levelLabel.rectTransform);

            // Name
            _nameLabel = Ui.Label(leftGroup, "Người chơi", Theme.TextMd, Color.white,
                TextAlignmentOptions.MidlineLeft, Ui.Edge.Thick, name: "PlayerName");
            _nameLabel.overflowMode = TextOverflowModes.Overflow;
            Ui.Place(_nameLabel.rectTransform, Ui.TopLeft, new Vector2(240f, 22f), new Vector2(80f, -6f), Ui.TopLeft);

            // XP track
            var xpTrack = Ui.Rect("XpTrack", leftGroup);
            Ui.Place(xpTrack, Ui.TopLeft, new Vector2(220f, 18f), new Vector2(80f, -30f), Ui.TopLeft);
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
            _xpLabel.overflowMode = TextOverflowModes.Overflow;
            Ui.Stretch(_xpLabel.rectTransform);

            // Resource chips row (chip_navy)
            var chipsRow = Ui.Rect("ChipsRow", leftGroup);
            Ui.Place(chipsRow, Ui.TopLeft, new Vector2(430f, 32f), new Vector2(80f, -54f), Ui.TopLeft);
            var hChips = chipsRow.gameObject.AddComponent<HorizontalLayoutGroup>();
            hChips.spacing = 6f;
            hChips.childControlWidth = true;
            hChips.childControlHeight = true;
            hChips.childForceExpandWidth = false;
            hChips.childForceExpandHeight = false;

            _moneyChip = UiStatChip.Create(chipsRow, Theme.Icon.Coin, "0đ", width: 125f);
            _moneyChip.ValueLabel.overflowMode = TextOverflowModes.Overflow;
            var le1 = _moneyChip.gameObject.AddComponent<LayoutElement>();
            le1.preferredWidth = 125f; le1.preferredHeight = 32f;

            _storeChip = UiStatChip.Create(chipsRow, Theme.Icon.Store, "Kho 0/50", width: 110f);
            _storeChip.ValueLabel.overflowMode = TextOverflowModes.Overflow;
            var le2 = _storeChip.gameObject.AddComponent<LayoutElement>();
            le2.preferredWidth = 110f; le2.preferredHeight = 32f;

            _fameChip = UiStatChip.Create(chipsRow, Theme.Icon.Fame, "0", width: 80f);
            _fameChip.ValueLabel.overflowMode = TextOverflowModes.Overflow;
            var le3 = _fameChip.gameObject.AddComponent<LayoutElement>();
            le3.preferredWidth = 80f; le3.preferredHeight = 32f;

            _staminaChip = UiStatChip.Create(chipsRow, Theme.Icon.Energy, "20/20", width: 85f);
            _staminaChip.ValueLabel.overflowMode = TextOverflowModes.Overflow;
            var le4 = _staminaChip.gameObject.AddComponent<LayoutElement>();
            le4.preferredWidth = 85f; le4.preferredHeight = 32f;
        }

        void BuildFeatureCluster(Transform parent)
        {
            var rightGroup = Ui.Rect("FeatureCluster", parent);
            Ui.Place(rightGroup, Ui.TopRight, new Vector2(440f, 88f), new Vector2(0f, -Theme.Space1), Ui.TopRight);

            // 7 Icon Buttons Row (318px = 7 * 40 + 6 * 6)
            var iconsRow = Ui.Rect("IconsRow", rightGroup);
            Ui.Place(iconsRow, Ui.TopRight, new Vector2(318f, 40f), Vector2.zero, Ui.TopRight);
            var hRow = iconsRow.gameObject.AddComponent<HorizontalLayoutGroup>();
            hRow.spacing = 6f;
            hRow.childControlWidth = true;
            hRow.childControlHeight = true;
            hRow.childForceExpandWidth = false;
            hRow.childForceExpandHeight = false;
            hRow.childAlignment = TextAnchor.MiddleRight;

            _btnMap = AddClusterButton(iconsRow, Theme.Icon.Map, "Bản đồ khu phố", () =>
            {
                if (OnMapClicked != null) OnMapClicked.Invoke();
                else UiToast.Show("Bản đồ khu phố", Theme.ToastTone.Info);
            });
            _badgeMap = AddBadge(_btnMap.Rect);

            _btnMarket = AddClusterButton(iconsRow, Theme.Icon.Market, "Chợ sỉ", () =>
            {
                if (OnMarketClicked != null) OnMarketClicked.Invoke();
                else UiToast.Show("Chợ sỉ (mở hàng ngày)", Theme.ToastTone.Info);
            });

            _btnNeighbours = AddClusterButton(iconsRow, Theme.Icon.Neighbours, "Hàng xóm", () =>
            {
                if (OnNeighboursClicked != null) OnNeighboursClicked.Invoke();
                else UiToast.Show("Hàng xóm", Theme.ToastTone.Info);
            });
            _badgeNeighbours = AddBadge(_btnNeighbours.Rect);

            _btnOrders = AddClusterButton(iconsRow, Theme.Icon.Orders, "Đơn giao", () =>
            {
                if (OnOrdersClicked != null) OnOrdersClicked.Invoke();
                else UiToast.Show("Đơn giao hàng", Theme.ToastTone.Info);
            });
            _badgeOrders = AddBadge(_btnOrders.Rect);

            _btnSeason = AddClusterButton(iconsRow, Theme.Icon.Season, "Mùa giải", () =>
            {
                if (OnSeasonClicked != null) OnSeasonClicked.Invoke();
                else UiToast.Show("Mùa giải", Theme.ToastTone.Info);
            });

            _btnFortune = AddClusterButton(iconsRow, Theme.Icon.Fortune, "Xem bói", () =>
            {
                if (OnFortuneClicked != null) OnFortuneClicked.Invoke();
                else UiToast.Show("Xem bói may mắn", Theme.ToastTone.Info);
            });

            _btnActivities = AddClusterButton(iconsRow, Theme.Icon.Activities, "Hoạt động xóm phố", () =>
            {
                if (OnActivitiesClicked != null) OnActivitiesClicked.Invoke();
                else UiToast.Show("Hoạt động xóm phố", Theme.ToastTone.Info);
            });

            // Sub row: Street name banner / Countdown pill
            var subRow = Ui.Rect("SubRow", rightGroup);
            Ui.Place(subRow, Ui.BottomRight, new Vector2(360f, 32f), new Vector2(0f, -4f), Ui.BottomRight);

            // Street name label
            _streetNameLabel = Ui.Label(subRow, "Phố vỉa hè", Theme.TextSm, Theme.Gold,
                TextAlignmentOptions.MidlineRight, Ui.Edge.Thick, name: "StreetName");
            _streetNameLabel.overflowMode = TextOverflowModes.Overflow;
            Ui.Place(_streetNameLabel.rectTransform, Ui.MiddleLeft, new Vector2(240f, 30f), Vector2.zero, Ui.MiddleLeft);

            // Countdown Pill
            var pillGo = Ui.Rect("CountdownPill", subRow);
            Ui.Place(pillGo, Ui.MiddleRight, new Vector2(108f, 28f), Vector2.zero, Ui.MiddleRight);
            var pillBg = pillGo.gameObject.AddComponent<Image>();
            Ui.SetSprite(pillBg, Theme.ChipSprite());

            var pillIcon = Ui.Img(pillGo, "TimeIcon", Theme.IconSprite(Theme.Icon.Time));
            Ui.Place(pillIcon.rectTransform, Ui.MiddleLeft, new Vector2(18f, 18f), new Vector2(Theme.Space1, 0f), Ui.MiddleLeft);

            _countdownLabel = Ui.Label(pillGo, "00:00:00", Theme.TextXs, Color.white,
                TextAlignmentOptions.MidlineRight, Ui.Edge.Thin, name: "CountdownText");
            _countdownLabel.overflowMode = TextOverflowModes.Overflow;
            Ui.Stretch(_countdownLabel.rectTransform, 24f, 0f, Theme.Space2, 0f);
        }

        UiIconButton AddClusterButton(Transform parent, Theme.Icon icon, string tooltip, Action onClick)
        {
            var btn = UiIconButton.Create(parent, icon, Theme.Btn.Blue, 40f, onClick);
            var le = btn.Rect.gameObject.AddComponent<LayoutElement>();
            le.preferredWidth = 40f;
            le.preferredHeight = 40f;
            return btn;
        }

        UiBadge AddBadge(RectTransform parent)
        {
            var badge = UiBadge.Create(parent, 0, Theme.BadgeTone.Red);
            Ui.Place(badge.Rect, Ui.TopRight, new Vector2(20f, Theme.BadgeHeight), new Vector2(4f, 4f), Ui.TopRight);
            badge.gameObject.SetActive(false);
            return badge;
        }

        // =========================================================================
        // Minigame Button & Tutorial Strip
        // =========================================================================

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

        // =========================================================================
        // Bottom Dock: Home, 4 District Tabs, Bus, More, Chat Bar
        // =========================================================================

        void BuildBottomDock()
        {
            var dockRt = Ui.Rect("BottomDock", transform);
            dockRt.anchorMin = new Vector2(0f, 0f);
            dockRt.anchorMax = new Vector2(1f, 0f);
            dockRt.pivot = new Vector2(0.5f, 0f);
            dockRt.offsetMin = new Vector2(Theme.Space3, Theme.Space1);
            dockRt.offsetMax = new Vector2(-Theme.Space3, 72f + Theme.Space1);

            // Navy dock bar background
            var dockBg = Ui.Img(dockRt, "DockBg", Theme.BarSprite());
            Ui.Stretch(dockBg.rectTransform);

            // Left Navigation container (Home + 4 Tabs + Bus + More)
            var navBox = Ui.Rect("NavGroup", dockRt);
            Ui.Place(navBox, Ui.MiddleLeft, new Vector2(610f, 48f), new Vector2(Theme.Space2, 0f), Ui.MiddleLeft);

            var hNav = navBox.gameObject.AddComponent<HorizontalLayoutGroup>();
            hNav.spacing = 6f;
            hNav.childControlWidth = true;
            hNav.childControlHeight = true;
            hNav.childForceExpandWidth = false;
            hNav.childForceExpandHeight = false;
            hNav.childAlignment = TextAnchor.MiddleLeft;

            // 1. Home button
            var homeBtn = UiIconButton.Create(navBox, Theme.Icon.Home, Theme.Btn.Blue, 46f, () => OnHomeClicked?.Invoke());
            var leHome = homeBtn.Rect.gameObject.AddComponent<LayoutElement>();
            leHome.preferredWidth = 46f;
            leHome.preferredHeight = 46f;

            // 2. District tabs strip: up to 10 own districts then the public ones, in a sideways scroll view
            var tabsViewport = Ui.Rect("DistrictTabs", navBox);
            var leTabs = tabsViewport.gameObject.AddComponent<LayoutElement>();
            leTabs.preferredWidth = 420f;
            leTabs.preferredHeight = 46f;
            tabsViewport.gameObject.AddComponent<RectMask2D>();
            var tabsHit = tabsViewport.gameObject.AddComponent<Image>(); // invisible, lets the strip catch drags between tabs
            tabsHit.color = new Color(0f, 0f, 0f, 0f);

            var tabsContainer = Ui.Rect("Content", tabsViewport);
            tabsContainer.anchorMin = new Vector2(0f, 0f);
            tabsContainer.anchorMax = new Vector2(0f, 1f);
            tabsContainer.pivot = new Vector2(0f, 0.5f);
            tabsContainer.offsetMin = Vector2.zero;
            tabsContainer.offsetMax = Vector2.zero;

            var hTabs = tabsContainer.gameObject.AddComponent<HorizontalLayoutGroup>();
            hTabs.spacing = 4f;
            hTabs.childControlWidth = true;
            hTabs.childControlHeight = true;
            hTabs.childForceExpandWidth = false;
            hTabs.childForceExpandHeight = false;
            hTabs.childAlignment = TextAnchor.MiddleLeft;

            var fitTabs = tabsContainer.gameObject.AddComponent<ContentSizeFitter>();
            fitTabs.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;

            var scrollTabs = tabsViewport.gameObject.AddComponent<ScrollRect>();
            scrollTabs.viewport = tabsViewport;
            scrollTabs.content = tabsContainer;
            scrollTabs.horizontal = true;
            scrollTabs.vertical = false;
            scrollTabs.movementType = ScrollRect.MovementType.Clamped;
            scrollTabs.scrollSensitivity = 28f;

            for (int i = 0; i < TabCount; i++)
            {
                _districtTabs[i] = CreateDistrictTab(tabsContainer, i);
            }

            // 3. Bus button
            var busBtn = UiIconButton.Create(navBox, Theme.Icon.Bus, Theme.Btn.Green, 46f, () =>
            {
                _ = RefreshDistrictOccupancyAsync();
                OnBusClicked?.Invoke();
            });
            var leBus = busBtn.Rect.gameObject.AddComponent<LayoutElement>();
            leBus.preferredWidth = 46f;
            leBus.preferredHeight = 46f;

            // 4. More button
            var moreBtn = UiIconButton.Create(navBox, Theme.Icon.More, Theme.Btn.Blue, 46f, () =>
            {
                OnMenuClicked?.Invoke();
                ShowMoreMenu();
            });
            var leMore = moreBtn.Rect.gameObject.AddComponent<LayoutElement>();
            leMore.preferredWidth = 46f;
            leMore.preferredHeight = 46f;

            // Right: Chat Bar
            BuildChatBar(dockRt);
        }

        static bool IsPublicTab(int index) => index >= MaxDistricts;
        static string TabName(int index) => IsPublicTab(index) ? PublicDistrictNames[index - MaxDistricts] : DistrictNames[index];

        DistrictTabItem CreateDistrictTab(Transform parent, int index)
        {
            var tabRt = Ui.Rect("Tab_" + TabName(index), parent);
            var le = tabRt.gameObject.AddComponent<LayoutElement>();
            le.preferredWidth = 100f;
            le.preferredHeight = 44f;

            var bg = Ui.Img(tabRt, "Bg", Theme.TabSprite(index == 0), true);
            Ui.Stretch(bg.rectTransform);

            // Title occupies top 52%
            var title = Ui.Label(tabRt, TabName(index), Theme.TextSm, Theme.TextDark,
                TextAlignmentOptions.Center, Ui.Edge.None, name: "Title");
            title.overflowMode = TextOverflowModes.Overflow;
            title.rectTransform.anchorMin = new Vector2(0f, 0.42f);
            title.rectTransform.anchorMax = new Vector2(1f, 1f);
            title.rectTransform.offsetMin = new Vector2(2f, 0f);
            title.rectTransform.offsetMax = new Vector2(-2f, -2f);

            // Occupancy occupies bottom 48%
            var occ = Ui.Label(tabRt, "0 người", Theme.TextXs, Theme.TextMuted,
                TextAlignmentOptions.Center, Ui.Edge.None, name: "Occupancy");
            occ.overflowMode = TextOverflowModes.Overflow;
            occ.rectTransform.anchorMin = new Vector2(0f, 0f);
            occ.rectTransform.anchorMax = new Vector2(1f, 0.46f);
            occ.rectTransform.offsetMin = new Vector2(2f, 2f);
            occ.rectTransform.offsetMax = new Vector2(-2f, 0f);

            // Lock overlay at top-right
            var lockImg = Ui.Img(tabRt, "Lock", Theme.IconSprite(Theme.Icon.Lock));
            Ui.Place(lockImg.rectTransform, Ui.TopRight, new Vector2(18f, 18f), new Vector2(-3f, -3f), Ui.TopRight);
            lockImg.gameObject.SetActive(index > 0 && !IsPublicTab(index));

            var item = new DistrictTabItem
            {
                Index = index,
                Root = tabRt,
                Background = bg,
                TitleLabel = title,
                OccupancyLabel = occ,
                LockIcon = lockImg
            };

            Ui.OnTap(bg, () => OnDistrictTabTapped(index));
            return item;
        }

        void OnDistrictTabTapped(int index)
        {
            SoundFx.Tap();
            if (IsPublicTab(index))
            {
                if (_state != null && _state.isPublic && _state.ownerId == PublicDistrictIds[index - MaxDistricts]) return;
                OnPublicDistrictSelected?.Invoke(PublicDistrictIds[index - MaxDistricts]);
                return;
            }
            bool isPurchased = index == 0 || (_profile != null && _profile.districts != null && index < _profile.districts.Count);
            if (!isPurchased)
            {
                if (OnMapClicked != null) OnMapClicked.Invoke();
                UiToast.Show($"Khu {DistrictNames[index]} đang bị khoá. Mở Bản đồ khu phố để mua!", Theme.ToastTone.Info);
            }
            else
            {
                if (_state != null && !_state.isPublic && _state.district == index) return;
                OnDistrictSelected?.Invoke(index);
            }
        }

        void BuildChatBar(Transform parent)
        {
            var chat = Ui.Rect("ChatBar", parent);
            Ui.Place(chat, Ui.MiddleRight, new Vector2(340f, 44f), new Vector2(-Theme.Space2, 0f), Ui.MiddleRight);

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
            text.overflowMode = TextOverflowModes.Overflow;
            Ui.Stretch(text.rectTransform);

            var ph = Ui.Rect("Placeholder", textArea).gameObject.AddComponent<TextMeshProUGUI>();
            if (font != null) ph.font = font;
            ph.fontSize = Theme.TextSm;
            ph.color = Theme.TextMuted;
            ph.alignment = TextAlignmentOptions.MidlineLeft;
            ph.overflowMode = TextOverflowModes.Overflow;
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
            sendLe.minWidth = sendLe.preferredWidth = 64f;

            var sendBtn = UiTextButton.Create(sendHolder, "Nói", Theme.Btn.Blue);
            sendBtn.Label.overflowMode = TextOverflowModes.Overflow;
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

        // =========================================================================
        // More Menu Modal: Wardrobe, Shop, Staff, Barber, Decoration, etc.
        // =========================================================================

        public void ShowMoreMenu()
        {
            var modal = UiModal.Create("Thêm", new Vector2(580f, 430f), Theme.Skin.Blue);

            var gridGo = Ui.Rect("Grid", modal.Body);
            Ui.Stretch(gridGo, Theme.Space3, Theme.Space3, Theme.Space3, Theme.Space3);
            var grid = gridGo.gameObject.AddComponent<GridLayoutGroup>();
            grid.cellSize = new Vector2(120f, 84f);
            grid.spacing = new Vector2(Theme.Space2, Theme.Space2);
            grid.childAlignment = TextAnchor.MiddleCenter;

            void AddMenuItem(string label, Theme.Icon icon, Theme.Btn btnRole, Action action)
            {
                var holder = Ui.Rect("Item_" + label, gridGo);
                var button = UiIconButton.Create(holder, icon, btnRole, 48f, () =>
                {
                    modal.Close();
                    action?.Invoke();
                });
                Ui.Place(button.Rect, Ui.TopCenter, new Vector2(48f, 48f), Vector2.zero, Ui.TopCenter);
                var lbl = Ui.Label(holder, label, Theme.TextXs, Theme.TextDark, TextAlignmentOptions.Midline, Ui.Edge.None);
                lbl.overflowMode = TextOverflowModes.Overflow;
                Ui.Place(lbl.rectTransform, Ui.BottomCenter, new Vector2(120f, 26f), Vector2.zero, Ui.BottomCenter);
            }

            AddMenuItem("Tủ đồ", Theme.Icon.Wardrobe, Theme.Btn.Gold, () =>
            {
                if (OnWardrobeClicked != null) OnWardrobeClicked.Invoke();
                else UiToast.Show("Tủ đồ cá nhân", Theme.ToastTone.Info);
            });

            AddMenuItem("Cửa hàng", Theme.Icon.Shop, Theme.Btn.Gold, () =>
            {
                if (OnShopClicked != null) OnShopClicked.Invoke();
                else UiToast.Show("Cửa hàng thời trang", Theme.ToastTone.Info);
            });

            AddMenuItem("Nhân viên", Theme.Icon.Staff, Theme.Btn.Gold, () =>
            {
                if (OnStaffClicked != null) OnStaffClicked.Invoke();
                else UiToast.Show("Quản lý nhân viên", Theme.ToastTone.Info);
            });

            AddMenuItem("Hớt tóc", Theme.Icon.Barber, Theme.Btn.Blue, () =>
            {
                if (OnBarberClicked != null) OnBarberClicked.Invoke();
                else UiToast.Show("Tiệm hớt tóc", Theme.ToastTone.Info);
            });

            AddMenuItem("Trang trí", Theme.Icon.Decoration, Theme.Btn.Gold, () =>
            {
                if (OnDecorationClicked != null) OnDecorationClicked.Invoke();
                else UiToast.Show("Trang trí vỉa hè", Theme.ToastTone.Info);
            });

            AddMenuItem("Hằng ngày", Theme.Icon.Daily, Theme.Btn.Green, () =>
            {
                if (OnDailyClicked != null) OnDailyClicked.Invoke();
                else UiToast.Show("Nhiệm vụ hằng ngày", Theme.ToastTone.Info);
            });

            AddMenuItem("Kho hàng", Theme.Icon.Store, Theme.Btn.Gold, () =>
            {
                if (OnStoreClicked != null) OnStoreClicked.Invoke();
                else UiToast.Show("Kho hàng", Theme.ToastTone.Info);
            });

            AddMenuItem("Nghề", Theme.Icon.Profession, Theme.Btn.Blue, () =>
            {
                if (OnProfessionClicked != null) OnProfessionClicked.Invoke();
                else UiToast.Show("Nghề nghiệp", Theme.ToastTone.Info);
            });

            AddMenuItem("Xe cộ", Theme.Icon.Vehicle, Theme.Btn.Green, () =>
            {
                if (OnVehicleClicked != null) OnVehicleClicked.Invoke();
                else UiToast.Show("Nhà để xe", Theme.ToastTone.Info);
            });

            AddMenuItem("Xếp hạng", Theme.Icon.Fame, Theme.Btn.Gold, () =>
            {
                if (OnLeaderboardClicked != null) OnLeaderboardClicked.Invoke();
                else UiToast.Show("Bảng xếp hạng", Theme.ToastTone.Info);
            });

            AddMenuItem("Quán cà phê", Theme.Icon.Cafe, Theme.Btn.Gold, () =>
            {
                if (OnCafeClicked != null) OnCafeClicked.Invoke();
                else UiToast.Show("Quán cà phê phố", Theme.ToastTone.Info);
            });

            AddMenuItem("Nhật ký", Theme.Icon.Log, Theme.Btn.Blue, () =>
            {
                if (OnLogClicked != null) OnLogClicked.Invoke();
                else UiToast.Show("Nhật ký kinh doanh", Theme.ToastTone.Info);
            });

            modal.Open();
        }

        // =========================================================================
        // State & Profile Synchronization
        // =========================================================================

        public void Refresh(Profile p, StreetState st = null)
        {
            _profile = p;
            if (st != null) _state = st;
            if (p == null) return;

            // Player stats
            string pName = !string.IsNullOrEmpty(p.name) ? p.name : "Người chơi";
            if (_nameLabel) _nameLabel.text = pName;
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

            RefreshDistrictTabs();
            RefreshBadges();
            RefreshTutorial(p);
            RefreshStreetInfo();

            if (Time.unscaledTime - _lastOccupancyFetchTime > 30f)
            {
                _ = RefreshDistrictOccupancyAsync();
            }
        }

        public void RefreshStreet(StreetState st)
        {
            _state = st;
            RefreshStreetInfo();
            RefreshDistrictTabs();
            if (_profile != null)
            {
                RefreshBadges();
                RefreshTutorial(_profile);
            }
            if (Time.unscaledTime - _lastOccupancyFetchTime > 30f)
            {
                _ = RefreshDistrictOccupancyAsync();
            }
        }

        void RefreshDistrictTabs()
        {
            int currentDistrict = _state != null ? _state.district : 0;
            bool inPublic = _state != null && _state.isPublic;
            int purchasedCount = _profile != null && _profile.districts != null ? _profile.districts.Count : 1;

            for (int i = 0; i < TabCount; i++)
            {
                var tab = _districtTabs[i];
                if (tab == null) continue;

                bool isCurrent = IsPublicTab(i)
                    ? inPublic && _state.ownerId == PublicDistrictIds[i - MaxDistricts]
                    : !inPublic && currentDistrict == i;
                bool isPurchased = IsPublicTab(i) || i == 0 || i < purchasedCount;

                Ui.SetSprite(tab.Background, Theme.TabSprite(isCurrent));
                tab.TitleLabel.color = isCurrent ? Theme.TextDark : (isPurchased ? Theme.TextDark : Theme.TextMuted);
                tab.OccupancyLabel.color = isCurrent ? Theme.TextDark : (isPurchased ? Theme.TextMuted : Theme.TextMuted);

                if (tab.LockIcon) tab.LockIcon.gameObject.SetActive(!isPurchased);
                if (tab.OccupancyLabel) tab.OccupancyLabel.text = _districtPlayerCounts[i] + " người";
            }
        }

        public async Task RefreshDistrictOccupancyAsync()
        {
            if (_net == null || _net.Account == null) return;
            _lastOccupancyFetchTime = Time.unscaledTime;
            try
            {
                var streets = await _net.ListStreets();
                var publicDistricts = await _net.ListPublicDistricts();
                if (streets != null)
                {
                    Array.Clear(_districtPlayerCounts, 0, _districtPlayerCounts.Length);
                    foreach (var s in streets)
                    {
                        if (s.district >= 0 && s.district < MaxDistricts)
                        {
                            _districtPlayerCounts[s.district] += s.playerCount;
                        }
                    }
                    if (publicDistricts != null)
                    {
                        foreach (var s in publicDistricts)
                        {
                            int slot = Array.IndexOf(PublicDistrictIds, s.ownerId);
                            if (slot >= 0) _districtPlayerCounts[MaxDistricts + slot] = s.playerCount;
                        }
                    }
                    RefreshDistrictTabs();
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning("[Hud] RefreshDistrictOccupancy failed: " + e.Message);
            }
        }

        void RefreshBadges()
        {
            if (_profile == null) return;

            // 1. Map badge: next district is newly affordable
            int mapBadge = 0;
            int ownedDistricts = _profile.districts != null ? _profile.districts.Count : 1;
            // The price list comes from the server catalog; no badge until it has loaded
            if (ownedDistricts < MaxDistricts && _net?.Catalog?.districts != null && ownedDistricts < _net.Catalog.districts.Count)
            {
                var d = _net.Catalog.districts[ownedDistricts];
                if (_profile.money >= d.cost && _profile.level >= d.unlockLevel && _profile.fame >= d.needsFame)
                {
                    mapBadge = 1;
                }
            }
            if (_badgeMap) _badgeMap.SetCount(mapBadge);

            // 2. Neighbours badge: quests with required items in stock or ready
            int readyQuests = 0;
            if (_net?.Catalog?.neighbours != null)
            {
                foreach (var n in _net.Catalog.neighbours)
                {
                    _profile.neighbours.TryGetValue(n.id, out var nState);
                    int qIdx = nState?.quests ?? 0;
                    if (qIdx < n.quests.Count)
                    {
                        var q = n.quests[qIdx];
                        if (q.type == "give")
                        {
                            if (_profile.store != null &&
                                _profile.store.TryGetValue(q.item, out var count) &&
                                count >= q.target)
                            {
                                readyQuests++;
                            }
                        }
                        else
                        {
                            int prog = nState?.progress ?? 0;
                            if (prog >= q.target)
                            {
                                readyQuests++;
                            }
                        }
                    }
                }
            }
            if (_badgeNeighbours) _badgeNeighbours.SetCount(readyQuests);

            // 3. Orders badge: finished delivery orders unclaimed
            int unclaimedDeliveries = 0;
            if (_profile.deliveries != null)
            {
                long now = _net != null ? _net.ServerNow : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                foreach (var d in _profile.deliveries)
                {
                    if (now >= d.doneAt) unclaimedDeliveries++;
                }
            }
            if (_badgeOrders) _badgeOrders.SetCount(unclaimedDeliveries);
        }

        void RefreshStreetInfo()
        {
            if (_state == null) return;

            bool isHome = OnHomeStreet;
            string streetTitle = isHome || _state.isPublic
                ? _state.districtName
                : $"{_state.ownerName} · {_state.districtName}";
            if (_streetNameLabel) _streetNameLabel.text = streetTitle ?? "";
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

        static string TutorialLine(int step, bool home)
        {
            if (!home && step == 7) return "Ghé thăm phố bạn bè để giao lưu và bày sạp ké, cả hai cùng có thưởng.";
            if (!home && step == 8) return "Cảm ơn bạn! Bấm Về nhà để quay lại phố mình.";
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
                UiToast.Show("Bán được đơn hàng đầu tiên rồi, giỏi lắm bạn!", Theme.ToastTone.Success);
            }
            if (previous >= 0 && previous < TutorialDone && p.tutorial >= TutorialDone)
            {
                UiToast.Show("Xong rồi! Nhật ký và Thêm đã mở. Chúc bạn buôn may bán đắt!", Theme.ToastTone.Success);
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
            // Periodic district occupancy refresh (every 30s)
            if (Time.unscaledTime - _lastOccupancyFetchTime > 30f)
            {
                _ = RefreshDistrictOccupancyAsync();
            }

            // Countdown timer update
            if (_countdownLabel)
            {
                if (_state != null && _state.eventEndsAt > 0)
                {
                    long now = _net != null ? _net.ServerNow : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    long remainingSec = Math.Max(0, (long)((_state.eventEndsAt - now) / 1000));
                    _countdownLabel.text = $"{remainingSec / 3600:D2}:{(remainingSec % 3600) / 60:D2}:{remainingSec % 60:D2}";
                }
                else
                {
                    _countdownLabel.text = "00:00:00";
                }
            }
        }
    }
}
