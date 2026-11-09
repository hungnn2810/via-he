// Shop modal: purchasing wearable clothing and accessories from the catalog.
// All player-facing copy is in Vietnamese.
using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class ShopModal : UiModal
    {
        Network _net;
        RectTransform _content;
        string _filterSlot = "all";

        public static ShopModal Show(Network net)
        {
            if (net == null || net.Profile == null) return null;

            var modal = MakeModal<ShopModal>("Cửa hàng quần áo", new Vector2(780f, 560f), Theme.Skin.Blue, closable: true);
            modal._net = net;
            modal.Build();
            modal.Open();
            return modal;
        }

        void Build()
        {
            // Category Tabs
            var tabHolder = Ui.Rect("TabHolder", Body);
            tabHolder.anchorMin = new Vector2(0f, 1f);
            tabHolder.anchorMax = new Vector2(1f, 1f);
            tabHolder.offsetMin = new Vector2(Theme.Space3, -48f);
            tabHolder.offsetMax = new Vector2(-Theme.Space3, -Theme.Space1);

            var h = tabHolder.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.spacing = Theme.Space2;
            h.childControlWidth = true;
            h.childControlHeight = true;
            h.childForceExpandWidth = true;

            void AddTab(string label, string slotKey)
            {
                var btn = UiTextButton.Create(tabHolder, label, _filterSlot == slotKey ? Theme.Btn.Gold : Theme.Btn.Gray);
                btn.Clicked += () =>
                {
                    _filterSlot = slotKey;
                    Build(); // Rebuild with selected tab
                };
            }

            AddTab("Tất cả", "all");
            AddTab("Mũ", "hat");
            AddTab("Áo", "shirt");
            AddTab("Quần", "pants");
            AddTab("Phụ kiện", "acc");

            // Scrollable list container
            var scrollGo = Ui.Rect("ScrollList", Body);
            Ui.Stretch(scrollGo, Theme.Space3, Theme.Space2, Theme.Space3, 56f);

            var scroll = scrollGo.gameObject.AddComponent<ScrollRect>();
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.scrollSensitivity = 25f;

            var viewport = Ui.Rect("Viewport", scrollGo);
            Ui.Stretch(viewport, 0, 0, 10f, 0);
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

            _content = content;

            RefreshList();

            // Footer
            AddButton("Đóng", Theme.Btn.Blue, () => Close(), closesWindow: true);
        }

        void RefreshList()
        {
            if (_content == null) return;
            foreach (Transform child in _content) Destroy(child.gameObject);

            var p = _net.Profile;
            var wearables = _net.Catalog?.wearables ?? new List<Wearable>();

            int count = 0;
            foreach (var w in wearables)
            {
                if (_filterSlot != "all" && w.slot != _filterSlot) continue;
                CreateWearableRow(_content, w);
                count++;
            }

            if (count == 0)
            {
                var emptyCard = Ui.Rect("EmptyNotice", _content);
                emptyCard.sizeDelta = new Vector2(0f, 60f);
                Ui.Label(emptyCard, "Không có món đồ nào trong danh mục này.", Theme.TextSm, Theme.TextMuted, TextAlignmentOptions.Midline);
            }
        }

        void CreateWearableRow(Transform parent, Wearable w)
        {
            var p = _net.Profile;
            bool alreadyOwned = p.wardrobe != null && p.wardrobe.Contains(w.id);
            bool locked = p.level < w.unlockLevel;

            var rt = Ui.Rect("Item_" + w.id, parent);
            rt.sizeDelta = new Vector2(0f, 68f);

            var bg = rt.gameObject.AddComponent<Image>();
            Ui.SetSprite(bg, Theme.RowSprite());

            // Icon
            string spriteName = "wear_" + w.id;
            if (!SpriteLibrary.Has(spriteName)) spriteName = "icon_wardrobe";
            var icon = Ui.Img(rt, "Icon", spriteName);
            Ui.Place(icon.rectTransform, Ui.MiddleLeft, new Vector2(48f, 48f), new Vector2(Theme.Space2, 0f), Ui.MiddleLeft);

            // Labels
            var labelBox = Ui.Rect("Labels", rt);
            Ui.Place(labelBox, Ui.MiddleLeft, new Vector2(380f, 52f), new Vector2(64f, 0f), Ui.MiddleLeft);
            var v = labelBox.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = 2f;
            v.childControlWidth = true;
            v.childControlHeight = false;
            v.childForceExpandWidth = true;

            string title = locked ? $"{w.name}   (cấp {w.unlockLevel})" : w.name;
            Color titleColor = locked ? Theme.TextMuted : Theme.TextDark;
            Ui.Label(labelBox, title, Theme.TextMd, titleColor);

            string stats = $"+{w.moneyPct}% tiền · +{w.xpPct}% KN · +{w.charm} đẹp";
            Ui.Label(labelBox, stats, Theme.TextSm, Theme.TextMuted);

            // Purchase / Owned Action
            if (alreadyOwned)
            {
                var ownedTag = Ui.Label(rt, "Đã có", Theme.TextMd, Theme.FigureSuccess, TextAlignmentOptions.MidlineRight);
                Ui.Place(ownedTag.rectTransform, Ui.MiddleRight, new Vector2(100f, 40f), new Vector2(-Theme.Space3, 0f), Ui.MiddleRight);
            }
            else if (locked)
            {
                var lockBtn = UiTextButton.Create(rt, $"Cấp {w.unlockLevel}", Theme.Btn.Gray);
                lockBtn.Interactable = false;
                Ui.Place(lockBtn.Rect, Ui.MiddleRight, new Vector2(140f, 44f), new Vector2(-Theme.Space2, 0f), Ui.MiddleRight);
            }
            else
            {
                var buyBtn = UiTextButton.Create(rt, $"Mua {Network.Money(w.price)}", Theme.Btn.Green);
                Ui.Place(buyBtn.Rect, Ui.MiddleRight, new Vector2(160f, 44f), new Vector2(-Theme.Space2, 0f), Ui.MiddleRight);
                buyBtn.Clicked += () =>
                {
                    if (p.money < w.price)
                    {
                        UiToast.Show("Không đủ tiền để mua", Theme.ToastTone.Warning);
                        return;
                    }
                    _net.Send("buyWearable", new Dictionary<string, object> { ["wearableId"] = w.id });
                    if (p.wardrobe == null) p.wardrobe = new List<string>();
                    p.wardrobe.Add(w.id);
                    p.money -= w.price;
                    UiToast.Show($"Đã mua {w.name}!", Theme.ToastTone.Success);
                    RefreshList();
                };
            }
        }
    }
}
