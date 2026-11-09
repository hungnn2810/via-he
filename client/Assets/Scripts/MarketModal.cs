// Market modal: Wholesale market purchases and communal shared bulk orders.
// All player-facing copy is in Vietnamese.
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class MarketModal : UiModal
    {
        Network _net;
        UiTabBar _tabBar;

        // Header chips
        UiStatChip _moneyChip;
        UiStatChip _storeChip;
        UiStatChip _debtChip;

        // Content containers
        RectTransform _wholesaleContainer;
        RectTransform _wholesaleList;
        RectTransform _sharedContainer;

        // State cache
        MarketPricesResult _prices;
        SharedOrderResult _shared;
        int _activeTab = 0;

        public static MarketModal Show(Network net)
        {
            if (net == null || net.Profile == null) return null;

            var modal = MakeModal<MarketModal>("Chợ đầu mối", new Vector2(820f, 580f), Theme.Skin.Blue, closable: true);
            modal._net = net;
            modal.Build();
            modal.Open();
            return modal;
        }

        void Build()
        {
            BuildHeaderChips();
            BuildTabs();

            // Wholesale panel
            _wholesaleContainer = Ui.Rect("WholesalePanel", Body);
            Ui.Stretch(_wholesaleContainer, Theme.Space3, 56f, Theme.Space3, 44f);
            BuildWholesaleView();

            // Shared order panel
            _sharedContainer = Ui.Rect("SharedPanel", Body);
            Ui.Stretch(_sharedContainer, Theme.Space3, 56f, Theme.Space3, 44f);
            BuildSharedOrderView();

            // Switch to default tab
            SelectTab(0);

            // Footer
            AddButton("Đóng", Theme.Btn.Blue, () => Close(), closesWindow: true);

            // Wire real-time network events
            if (_net != null)
            {
                _net.OnProfileChanged += HandleProfileChanged;
                _net.OnSharedOrderGiven += HandleSharedOrderGiven;
                _net.OnSharedOrderClaimed += HandleSharedOrderClaimed;
            }

            // Initial fetch
            FetchMarketPrices();
            FetchSharedOrder();
        }

        void BuildHeaderChips()
        {
            var headerGo = Ui.Rect("HeaderChips", Body);
            headerGo.anchorMin = new Vector2(0f, 1f);
            headerGo.anchorMax = new Vector2(1f, 1f);
            headerGo.offsetMin = new Vector2(Theme.Space3, -40f);
            headerGo.offsetMax = new Vector2(-Theme.Space3, -Theme.Space1);

            var h = headerGo.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.spacing = Theme.Space2;
            h.childControlWidth = false;
            h.childControlHeight = true;
            h.childForceExpandWidth = false;
            h.childForceExpandHeight = true;

            var p = _net?.Profile;
            long money = p != null ? p.money : 0;
            int used = CalculateStoreUsed(p);
            int cap = p != null ? p.storeCapacity : 50;

            _moneyChip = UiStatChip.Create(headerGo, Theme.Icon.Coin, money.ToString("N0") + "đ", width: 140f);
            _storeChip = UiStatChip.Create(headerGo, Theme.Icon.Store, $"Kho {used}/{cap}", width: 130f);

            long debt = p?.market != null ? p.market.debt : 0;
            _debtChip = UiStatChip.Create(headerGo, Theme.Icon.Coin, $"Nợ: {debt:N0}đ", width: 130f);
            _debtChip.gameObject.SetActive(debt > 0);
        }

        void BuildTabs()
        {
            var tabHolder = Ui.Rect("TabStrip", Body);
            tabHolder.anchorMin = new Vector2(0f, 1f);
            tabHolder.anchorMax = new Vector2(1f, 1f);
            tabHolder.offsetMin = new Vector2(Theme.Space3, -84f);
            tabHolder.offsetMax = new Vector2(-Theme.Space3, -46f);

            _tabBar = UiTabBar.Create(tabHolder, new[] { "Nhập hàng sỉ", "Đơn gom chung" }, (idx) => SelectTab(idx), tabWidth: 160f, height: 36f);
        }

        void SelectTab(int index)
        {
            _activeTab = index;
            if (_wholesaleContainer != null) _wholesaleContainer.gameObject.SetActive(index == 0);
            if (_sharedContainer != null) _sharedContainer.gameObject.SetActive(index == 1);

            if (index == 0)
            {
                if (_prices == null) FetchMarketPrices();
                else RefreshWholesaleList();
            }
            else
            {
                if (_shared == null) FetchSharedOrder();
                else RefreshSharedOrderView();
            }
        }

        // =========================================================================
        // Tab 0: Wholesale Market (Nhập hàng sỉ)
        // =========================================================================

        void BuildWholesaleView()
        {
            // Banner rule info
            var banner = Ui.Img(_wholesaleContainer, "Banner", Theme.BoardCreamSprite());
            banner.rectTransform.anchorMin = new Vector2(0f, 1f);
            banner.rectTransform.anchorMax = new Vector2(1f, 1f);
            banner.rectTransform.offsetMin = new Vector2(0f, -36f);
            banner.rectTransform.offsetMax = new Vector2(0f, 0f);

            var bannerText = Ui.Label(banner.transform, "Giá sỉ biến động mỗi ngày (70% - 130%). Mua từ 20 phần giảm 10%, từ 50 phần giảm 20%.",
                Theme.TextXs, Theme.TextDark, TextAlignmentOptions.MidlineLeft, Ui.Edge.None);
            Ui.Stretch(bannerText.rectTransform, Theme.Space2, 0f, Theme.Space2, 0f);

            // Scroll container
            var scrollGo = Ui.Rect("ScrollWholesale", _wholesaleContainer);
            Ui.Stretch(scrollGo, 0f, 0f, 0f, 42f);

            var scroll = scrollGo.gameObject.AddComponent<ScrollRect>();
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.scrollSensitivity = 25f;

            var viewport = Ui.Rect("Viewport", scrollGo);
            Ui.Stretch(viewport, 0f, 0f, 8f, 0f);
            viewport.gameObject.AddComponent<RectMask2D>();
            scroll.viewport = viewport;

            var content = Ui.Rect("Content", viewport);
            content.anchorMin = new Vector2(0f, 1f);
            content.anchorMax = new Vector2(1f, 1f);
            content.pivot = new Vector2(0.5f, 1f);
            content.offsetMin = content.offsetMax = Vector2.zero;
            scroll.content = content;

            var vlg = content.gameObject.AddComponent<VerticalLayoutGroup>();
            vlg.spacing = Theme.Space2;
            vlg.childControlWidth = true;
            vlg.childControlHeight = false;
            vlg.childForceExpandWidth = true;

            var csf = content.gameObject.AddComponent<ContentSizeFitter>();
            csf.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            _wholesaleList = content;
        }

        async void FetchMarketPrices()
        {
            try
            {
                _prices = await _net.GetMarketPrices();
                if (this != null && gameObject != null && _activeTab == 0)
                {
                    RefreshWholesaleList();
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning("[MarketModal] Failed to get market prices: " + ex.Message);
            }
        }

        void RefreshWholesaleList()
        {
            if (_wholesaleList == null) return;
            foreach (Transform child in _wholesaleList) Destroy(child.gameObject);

            if (_prices == null || _prices.prices == null || _prices.prices.Count == 0)
            {
                var empty = Ui.Rect("EmptyNotice", _wholesaleList);
                empty.sizeDelta = new Vector2(0f, 60f);
                Ui.Label(empty, "Đang tải dữ liệu giá chợ...", Theme.TextSm, Theme.TextMuted, TextAlignmentOptions.Midline);
                return;
            }

            var p = _net.Profile;
            int playerLevel = p != null ? p.level : 1;

            foreach (var item in _prices.prices)
            {
                CreateWholesaleItemRow(_wholesaleList, item, playerLevel);
            }
        }

        void CreateWholesaleItemRow(Transform parent, MarketPriceItem item, int playerLevel)
        {
            var rowGo = Ui.Rect("Item_" + item.item, parent);
            rowGo.sizeDelta = new Vector2(0f, 76f);
            var bg = rowGo.gameObject.AddComponent<Image>();
            Ui.SetSprite(bg, Theme.RowSprite());

            // Product Icon
            string spriteName = "counter_" + item.item;
            if (!SpriteLibrary.Has(spriteName)) spriteName = "icon_stall";
            var icon = Ui.Img(rowGo, "Icon", spriteName);
            Ui.Place(icon.rectTransform, Ui.MiddleLeft, new Vector2(56f, 56f), new Vector2(Theme.Space2, 0f), Ui.MiddleLeft);

            // Left Block: Name & Price
            var leftBlock = Ui.Rect("LeftBlock", rowGo);
            Ui.Place(leftBlock, Ui.MiddleLeft, new Vector2(210f, 64f), new Vector2(72f, 0f), Ui.MiddleLeft);

            var nameLabel = Ui.Label(leftBlock, item.name, Theme.TextMd, Theme.TextDark, TextAlignmentOptions.TopLeft, Ui.Edge.Thin);
            nameLabel.rectTransform.anchorMin = new Vector2(0f, 0.5f);
            nameLabel.rectTransform.anchorMax = new Vector2(1f, 1f);
            nameLabel.rectTransform.offsetMin = nameLabel.rectTransform.offsetMax = Vector2.zero;

            string pctStr = item.pct < 100 ? $"-{100 - item.pct}% (Rẻ)" : (item.pct > 100 ? $"+{item.pct - 100}% (Đắt)" : "Giá chuẩn");
            Color pctColor = item.pct < 100 ? Theme.FigureGain : (item.pct > 100 ? Theme.FigureCost : Theme.TextMuted);

            var priceLabel = Ui.Label(leftBlock, $"{item.price:N0}đ/phần", Theme.TextSm, Theme.TextDark, TextAlignmentOptions.BottomLeft, Ui.Edge.None);
            priceLabel.rectTransform.anchorMin = new Vector2(0f, 0f);
            priceLabel.rectTransform.anchorMax = new Vector2(0.6f, 0.5f);
            priceLabel.rectTransform.offsetMin = priceLabel.rectTransform.offsetMax = Vector2.zero;

            var pctLabel = Ui.Label(leftBlock, pctStr, Theme.TextXs, pctColor, TextAlignmentOptions.BottomLeft, Ui.Edge.None);
            pctLabel.rectTransform.anchorMin = new Vector2(0.6f, 0f);
            pctLabel.rectTransform.anchorMax = new Vector2(1f, 0.5f);
            pctLabel.rectTransform.offsetMin = pctLabel.rectTransform.offsetMax = Vector2.zero;

            bool isUnlocked = playerLevel >= item.unlockLevel;

            if (!isUnlocked)
            {
                var lockBadge = Ui.Label(rowGo, $"Cần cấp {item.unlockLevel}", Theme.TextSm, Theme.TextMuted, TextAlignmentOptions.MidlineRight, Ui.Edge.None);
                Ui.Place(lockBadge.rectTransform, Ui.MiddleRight, new Vector2(160f, 32f), new Vector2(-Theme.Space3, 0f), Ui.MiddleRight);
                return;
            }

            // Stepper & Calculations
            int currentQty = 10;
            int CalculateDiscountPct(int q) => q >= 50 ? 20 : (q >= 20 ? 10 : 0);
            long CalculateTotalCost(int q)
            {
                int disc = CalculateDiscountPct(q);
                long unit = (long)Math.Round(item.price * (100 - disc) / 100.0);
                return unit * q;
            }

            // Middle Block: Stepper & Quick Pills
            var midBlock = Ui.Rect("MidBlock", rowGo);
            Ui.Place(midBlock, Ui.MiddleLeft, new Vector2(240f, 64f), new Vector2(290f, 0f), Ui.MiddleLeft);

            var stepperRow = Ui.Rect("Stepper", midBlock);
            stepperRow.anchorMin = new Vector2(0f, 0.45f);
            stepperRow.anchorMax = new Vector2(1f, 1f);
            stepperRow.offsetMin = stepperRow.offsetMax = Vector2.zero;

            var btnMinus = UiTextButton.Create(stepperRow, "-", Theme.Btn.Gray);
            Ui.Place(btnMinus.Rect, Ui.MiddleLeft, new Vector2(32f, 30f), Vector2.zero, Ui.MiddleLeft);

            var qtyText = Ui.Label(stepperRow, currentQty.ToString(), Theme.TextMd, Theme.TextDark, TextAlignmentOptions.Midline, Ui.Edge.Thin);
            Ui.Place(qtyText.rectTransform, Ui.MiddleLeft, new Vector2(50f, 30f), new Vector2(36f, 0f), Ui.MiddleLeft);

            var btnPlus = UiTextButton.Create(stepperRow, "+", Theme.Btn.Gray);
            Ui.Place(btnPlus.Rect, Ui.MiddleLeft, new Vector2(32f, 30f), new Vector2(90f, 0f), Ui.MiddleLeft);

            var btn20 = UiTextButton.Create(stepperRow, "20", Theme.Btn.Blue);
            Ui.Place(btn20.Rect, Ui.MiddleLeft, new Vector2(36f, 26f), new Vector2(130f, 0f), Ui.MiddleLeft);

            var btn50 = UiTextButton.Create(stepperRow, "50", Theme.Btn.Blue);
            Ui.Place(btn50.Rect, Ui.MiddleLeft, new Vector2(36f, 26f), new Vector2(172f, 0f), Ui.MiddleLeft);

            var totalCostLabel = Ui.Label(midBlock, "", Theme.TextSm, Theme.FigureGain, TextAlignmentOptions.BottomLeft, Ui.Edge.None);
            totalCostLabel.rectTransform.anchorMin = new Vector2(0f, 0f);
            totalCostLabel.rectTransform.anchorMax = new Vector2(1f, 0.45f);
            totalCostLabel.rectTransform.offsetMin = totalCostLabel.rectTransform.offsetMax = Vector2.zero;

            void UpdateQty(int newQty)
            {
                currentQty = Mathf.Clamp(newQty, 1, 200);
                qtyText.text = currentQty.ToString();
                int disc = CalculateDiscountPct(currentQty);
                long total = CalculateTotalCost(currentQty);
                string discTag = disc > 0 ? $" (-{disc}%)" : "";
                totalCostLabel.text = $"Tổng: {total:N0}đ{discTag}";
            }

            btnMinus.Clicked += () => UpdateQty(currentQty - (currentQty > 10 ? 10 : 1));
            btnPlus.Clicked += () => UpdateQty(currentQty + (currentQty >= 10 ? 10 : 1));
            btn20.Clicked += () => UpdateQty(20);
            btn50.Clicked += () => UpdateQty(50);
            UpdateQty(currentQty);

            // Right Block: Action Buttons (Cash & Credit)
            var rightBlock = Ui.Rect("RightBlock", rowGo);
            Ui.Place(rightBlock, Ui.MiddleRight, new Vector2(210f, 64f), new Vector2(-Theme.Space2, 0f), Ui.MiddleRight);

            var btnCash = UiTextButton.Create(rightBlock, "TIỀN MẶT", Theme.Btn.Green);
            Ui.Place(btnCash.Rect, Ui.TopRight, new Vector2(100f, 34f), Vector2.zero, Ui.TopRight);
            btnCash.Clicked += () =>
            {
                var prof = _net.Profile;
                long total = CalculateTotalCost(currentQty);
                if (prof.money < total)
                {
                    UiToast.Show("Không đủ tiền mặt để nhập!", Theme.ToastTone.Warning);
                    return;
                }
                int usedSpace = CalculateStoreUsed(prof);
                if (usedSpace + currentQty > prof.storeCapacity)
                {
                    UiToast.Show("Kho hàng không đủ chỗ trống!", Theme.ToastTone.Warning);
                    return;
                }

                _net.Send("marketBuy", new Dictionary<string, object>
                {
                    ["item"] = item.item,
                    ["quantity"] = currentQty,
                    ["credit"] = false,
                });
                SoundFx.Coins();
                UiToast.Show($"Đã nhập {currentQty} {item.name} về kho!", Theme.ToastTone.Success);
            };

            bool canCredit = playerLevel >= (_prices != null ? _prices.creditLevel : 4);
            var btnCredit = UiTextButton.Create(rightBlock, canCredit ? "NHẬP CHỊU" : "NỢ (CẤP 4)", canCredit ? Theme.Btn.Amber : Theme.Btn.Gray);
            Ui.Place(btnCredit.Rect, Ui.BottomRight, new Vector2(100f, 26f), Vector2.zero, Ui.BottomRight);
            btnCredit.Clicked += () =>
            {
                if (!canCredit)
                {
                    UiToast.Show("Cần đạt cấp 4 để mở tính năng nhập chịu!", Theme.ToastTone.Warning);
                    return;
                }
                var prof = _net.Profile;
                int usedSpace = CalculateStoreUsed(prof);
                if (usedSpace + currentQty > prof.storeCapacity)
                {
                    UiToast.Show("Kho hàng không đủ chỗ trống!", Theme.ToastTone.Warning);
                    return;
                }

                _net.Send("marketBuy", new Dictionary<string, object>
                {
                    ["item"] = item.item,
                    ["quantity"] = currentQty,
                    ["credit"] = true,
                });
                SoundFx.Tap();
                UiToast.Show($"Đã nhập chịu {currentQty} {item.name} (+5% lãi)!", Theme.ToastTone.Info);
            };
        }

        // =========================================================================
        // Tab 1: Communal Shared Order (Đơn hàng lớn / Đơn gom chung)
        // =========================================================================

        void BuildSharedOrderView()
        {
            // Banner rule info
            var banner = Ui.Img(_sharedContainer, "Banner", Theme.BoardCreamSprite());
            banner.rectTransform.anchorMin = new Vector2(0f, 1f);
            banner.rectTransform.anchorMax = new Vector2(1f, 1f);
            banner.rectTransform.offsetMin = new Vector2(0f, -36f);
            banner.rectTransform.offsetMax = new Vector2(0f, 0f);

            var bannerText = Ui.Label(banner.transform, "Đơn xuất khẩu gom chung toàn phố. Cùng nhau góp hàng để nhận phần thưởng lớn chia đều!",
                Theme.TextXs, Theme.TextDark, TextAlignmentOptions.MidlineLeft, Ui.Edge.None);
            Ui.Stretch(bannerText.rectTransform, Theme.Space2, 0f, Theme.Space2, 0f);

            var bodyArea = Ui.Rect("SharedContent", _sharedContainer);
            Ui.Stretch(bodyArea, 0f, 0f, 0f, 42f);
        }

        async void FetchSharedOrder()
        {
            try
            {
                _shared = await _net.GetSharedOrder();
                if (this != null && gameObject != null && _activeTab == 1)
                {
                    RefreshSharedOrderView();
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning("[MarketModal] Failed to get shared order: " + ex.Message);
            }
        }

        void RefreshSharedOrderView()
        {
            if (_sharedContainer == null) return;
            var bodyArea = _sharedContainer.Find("SharedContent");
            if (bodyArea == null) return;

            foreach (Transform child in bodyArea) Destroy(child.gameObject);

            if (_shared == null)
            {
                var loading = Ui.Rect("LoadingNotice", bodyArea);
                loading.sizeDelta = new Vector2(0f, 60f);
                Ui.Label(loading, "Đang tải đơn hàng gom chung...", Theme.TextSm, Theme.TextMuted, TextAlignmentOptions.Midline);
                return;
            }

            var p = _net.Profile;
            int playerLevel = p != null ? p.level : 1;

            if (playerLevel < _shared.level)
            {
                var lockCard = Ui.Rect("LockNotice", bodyArea);
                Ui.Place(lockCard, Ui.Center, new Vector2(500f, 120f), Vector2.zero);
                var bg = lockCard.gameObject.AddComponent<Image>();
                Ui.SetSprite(bg, Theme.RowSprite());
                Ui.Label(lockCard, $"Tính năng Đơn gom chung yêu cầu Cấp {_shared.level}!\nHãy bán hàng tích lũy thêm kinh nghiệm.",
                    Theme.TextMd, Theme.TextDark, TextAlignmentOptions.Midline, Ui.Edge.None);
                return;
            }

            // Order Card
            var card = Ui.Rect("OrderCard", bodyArea);
            Ui.Place(card, Ui.TopCenter, new Vector2(740f, 230f), new Vector2(0f, -Theme.Space2), Ui.TopCenter);
            var cardBg = card.gameObject.AddComponent<Image>();
            Ui.SetSprite(cardBg, Theme.RowSprite());

            // Dish Icon
            string spriteName = "counter_" + _shared.item;
            if (!SpriteLibrary.Has(spriteName)) spriteName = "icon_stall";
            var icon = Ui.Img(card, "Icon", spriteName);
            Ui.Place(icon.rectTransform, Ui.TopLeft, new Vector2(80f, 80f), new Vector2(Theme.Space3, -Theme.Space3), Ui.TopLeft);

            // Order Details
            var infoRt = Ui.Rect("Info", card);
            Ui.Place(infoRt, Ui.TopLeft, new Vector2(400f, 80f), new Vector2(100f, -Theme.Space3), Ui.TopLeft);

            var titleLbl = Ui.Label(infoRt, $"Đơn xuất khẩu #{_shared.id}: {_shared.target} phần {GetProductName(_shared.item)}",
                Theme.TextLg, Theme.TextDark, TextAlignmentOptions.TopLeft, Ui.Edge.Thin);
            titleLbl.rectTransform.anchorMin = new Vector2(0f, 0.5f);
            titleLbl.rectTransform.anchorMax = new Vector2(1f, 1f);
            titleLbl.rectTransform.offsetMin = titleLbl.rectTransform.offsetMax = Vector2.zero;

            var rewardLbl = Ui.Label(infoRt, $"Tổng thưởng: {_shared.reward:N0}đ (chia theo % đóng góp)",
                Theme.TextSm, Theme.FigureGain, TextAlignmentOptions.BottomLeft, Ui.Edge.None);
            rewardLbl.rectTransform.anchorMin = new Vector2(0f, 0f);
            rewardLbl.rectTransform.anchorMax = new Vector2(1f, 0.5f);
            rewardLbl.rectTransform.offsetMin = rewardLbl.rectTransform.offsetMax = Vector2.zero;

            // Communal Progress Bar
            var barRt = Ui.Rect("ProgressHolder", card);
            Ui.Place(barRt, Ui.TopLeft, new Vector2(680f, 26f), new Vector2(Theme.Space3, -110f), Ui.TopLeft);
            var pBar = UiProgressBar.Create(barRt, 680f, 24f, Theme.ProgressTone.Green, true);
            pBar.SetProgress(_shared.progress, _shared.target, "{0}/{1} phần hoàn thành");

            // Player Contribution Status
            int inStore = 0;
            if (p.store != null && p.store.ContainsKey(_shared.item)) inStore = p.store[_shared.item];
            int dailyLeft = Mathf.Max(0, _shared.perDay - _shared.givenToday);
            int neededLeft = Mathf.Max(0, _shared.target - _shared.progress);

            var statsLbl = Ui.Label(card,
                $"Bạn đã góp: {_shared.mine} phần  •  Hôm nay còn góp được: {dailyLeft}/{_shared.perDay} phần  •  Có sẵn trong kho: {inStore} phần",
                Theme.TextSm, Theme.TextDark, TextAlignmentOptions.MidlineLeft, Ui.Edge.None);
            Ui.Place(statsLbl.rectTransform, Ui.TopLeft, new Vector2(680f, 24f), new Vector2(Theme.Space3, -145f), Ui.TopLeft);

            // Contribution Controls
            int contributeQty = Mathf.Min(5, inStore, dailyLeft, neededLeft);
            if (contributeQty < 1 && inStore > 0 && dailyLeft > 0 && neededLeft > 0) contributeQty = 1;

            var ctrlRow = Ui.Rect("CtrlRow", card);
            Ui.Place(ctrlRow, Ui.BottomLeft, new Vector2(680f, 36f), new Vector2(Theme.Space3, Theme.Space2), Ui.BottomLeft);

            var btnMinus = UiTextButton.Create(ctrlRow, "-", Theme.Btn.Gray);
            Ui.Place(btnMinus.Rect, Ui.MiddleLeft, new Vector2(36f, 34f), Vector2.zero, Ui.MiddleLeft);

            var qtyText = Ui.Label(ctrlRow, contributeQty.ToString(), Theme.TextMd, Theme.TextDark, TextAlignmentOptions.Midline, Ui.Edge.Thin);
            Ui.Place(qtyText.rectTransform, Ui.MiddleLeft, new Vector2(50f, 34f), new Vector2(40f, 0f), Ui.MiddleLeft);

            var btnPlus = UiTextButton.Create(ctrlRow, "+", Theme.Btn.Gray);
            Ui.Place(btnPlus.Rect, Ui.MiddleLeft, new Vector2(36f, 34f), new Vector2(94f, 0f), Ui.MiddleLeft);

            var btnMax = UiTextButton.Create(ctrlRow, "Góp hết", Theme.Btn.Blue);
            Ui.Place(btnMax.Rect, Ui.MiddleLeft, new Vector2(80f, 34f), new Vector2(140f, 0f), Ui.MiddleLeft);

            int maxPossible = Mathf.Min(inStore, dailyLeft, neededLeft);
            void SetQty(int val)
            {
                contributeQty = Mathf.Clamp(val, 0, maxPossible);
                qtyText.text = contributeQty.ToString();
            }

            btnMinus.Clicked += () => SetQty(contributeQty - 1);
            btnPlus.Clicked += () => SetQty(contributeQty + 1);
            btnMax.Clicked += () => SetQty(maxPossible);

            var btnContribute = UiTextButton.Create(ctrlRow, "GÓP HÀNG", Theme.Btn.Green);
            Ui.Place(btnContribute.Rect, Ui.MiddleRight, new Vector2(140f, 34f), Vector2.zero, Ui.MiddleRight);
            btnContribute.Clicked += () =>
            {
                if (contributeQty <= 0)
                {
                    if (inStore <= 0) UiToast.Show("Kho của bạn không có món này!", Theme.ToastTone.Warning);
                    else if (dailyLeft <= 0) UiToast.Show("Hôm nay bạn đã góp đủ giới hạn!", Theme.ToastTone.Warning);
                    else if (neededLeft <= 0) UiToast.Show("Đơn hàng này đã đủ số lượng!", Theme.ToastTone.Info);
                    else UiToast.Show("Hãy chọn số lượng muốn góp!", Theme.ToastTone.Warning);
                    return;
                }

                _net.Send("contributeSharedOrder", new Dictionary<string, object>
                {
                    ["quantity"] = contributeQty,
                });
                SoundFx.Tap();
                UiToast.Show($"Đã góp {contributeQty} phần vào đơn xuất khẩu!", Theme.ToastTone.Success);
            };

            // Unclaimed Order Rewards Section
            if (_shared.claimable > 0)
            {
                var claimCard = Ui.Rect("ClaimCard", bodyArea);
                Ui.Place(claimCard, Ui.TopCenter, new Vector2(740f, 70f), new Vector2(0f, -260f), Ui.TopCenter);
                var claimBg = claimCard.gameObject.AddComponent<Image>();
                Ui.SetSprite(claimBg, Theme.RowSprite());

                var claimText = Ui.Label(claimCard, $"Bạn có {_shared.claimable} phần thưởng đơn hàng cũ đã hoàn thành!",
                    Theme.TextMd, Theme.FigureGain, TextAlignmentOptions.MidlineLeft, Ui.Edge.Thin);
                Ui.Place(claimText.rectTransform, Ui.MiddleLeft, new Vector2(480f, 40f), new Vector2(Theme.Space3, 0f), Ui.MiddleLeft);

                var btnClaim = UiTextButton.Create(claimCard, "NHẬN THƯỞNG", Theme.Btn.Gold);
                Ui.Place(btnClaim.Rect, Ui.MiddleRight, new Vector2(160f, 40f), new Vector2(-Theme.Space3, 0f), Ui.MiddleRight);
                btnClaim.Clicked += () =>
                {
                    _net.Send("claimSharedOrder");
                    SoundFx.Coins();
                    UiToast.Show("Đang nhận thưởng đơn hàng...", Theme.ToastTone.Success);
                };
            }
        }

        string GetProductName(string id)
        {
            var p = _net.Catalog?.products?.Find(x => x.id == id);
            return p != null ? p.name : id;
        }

        int CalculateStoreUsed(Profile p)
        {
            if (p?.store == null) return 0;
            int total = 0;
            foreach (var kvp in p.store) total += kvp.Value;
            return total;
        }

        void HandleProfileChanged(Profile p)
        {
            if (this == null || gameObject == null || p == null) return;
            if (_moneyChip != null) _moneyChip.SetValue(p.money.ToString("N0") + "đ");

            int used = CalculateStoreUsed(p);
            if (_storeChip != null) _storeChip.SetValue($"Kho {used}/{p.storeCapacity}");

            long debt = p.market != null ? p.market.debt : 0;
            if (_debtChip != null)
            {
                _debtChip.SetValue($"Nợ: {debt:N0}đ");
                _debtChip.gameObject.SetActive(debt > 0);
            }

            if (_activeTab == 0) RefreshWholesaleList();
            else RefreshSharedOrderView();
        }

        void HandleSharedOrderGiven(SharedOrderGivenMessage msg)
        {
            FetchSharedOrder();
        }

        void HandleSharedOrderClaimed(SharedOrderClaimedMessage msg)
        {
            FetchSharedOrder();
        }

        protected override void OnDestroy()
        {
            if (_net != null)
            {
                _net.OnProfileChanged -= HandleProfileChanged;
                _net.OnSharedOrderGiven -= HandleSharedOrderGiven;
                _net.OnSharedOrderClaimed -= HandleSharedOrderClaimed;
            }
            base.OnDestroy();
        }
    }
}
