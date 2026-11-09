// Wardrobe modal: view equipped outfit and wardrobe inventory for player and employees.
// All player-facing copy is in Vietnamese.
using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class WardrobeModal : UiModal
    {
        Network _net;
        Employee _selectedEmployee; // null = Tôi
        RectTransform _content;
        TextMeshProUGUI _targetLabel;

        public static WardrobeModal Show(Network net)
        {
            if (net == null || net.Profile == null) return null;

            var modal = MakeModal<WardrobeModal>("Tủ đồ", new Vector2(780f, 560f), Theme.Skin.Amber, closable: true);
            modal._net = net;
            modal.Build();
            modal.Open();
            return modal;
        }

        void Build()
        {
            // Target Selector Header (Tôi vs Employees)
            var targetBox = Ui.Rect("TargetBox", Body);
            targetBox.anchorMin = new Vector2(0f, 1f);
            targetBox.anchorMax = new Vector2(1f, 1f);
            targetBox.offsetMin = new Vector2(Theme.Space3, -48f);
            targetBox.offsetMax = new Vector2(-Theme.Space3, -Theme.Space1);

            var tbH = targetBox.gameObject.AddComponent<HorizontalLayoutGroup>();
            tbH.spacing = Theme.Space2;
            tbH.childControlWidth = true;
            tbH.childControlHeight = true;
            tbH.childForceExpandWidth = false;

            var lbl = Ui.Label(targetBox, "Mặc cho:", Theme.TextMd, Theme.TextDark, TextAlignmentOptions.MidlineLeft);
            lbl.gameObject.AddComponent<LayoutElement>().preferredWidth = 90f;

            string targetName = _selectedEmployee != null ? _selectedEmployee.name : "Tôi";
            _targetLabel = Ui.Label(targetBox, targetName, Theme.TextMd, Theme.TextDark, TextAlignmentOptions.MidlineLeft);
            _targetLabel.gameObject.AddComponent<LayoutElement>().preferredWidth = 140f;

            var cycleBtn = UiTextButton.Create(targetBox, "Đổi người", Theme.Btn.Blue);
            cycleBtn.Rect.gameObject.AddComponent<LayoutElement>().preferredWidth = 100f;
            cycleBtn.Clicked += CycleTarget;

            // Scroll container
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

        void CycleTarget()
        {
            var p = _net.Profile;
            var employees = p.employees ?? new List<Employee>();

            if (_selectedEmployee == null)
            {
                if (employees.Count > 0) _selectedEmployee = employees[0];
            }
            else
            {
                int idx = employees.IndexOf(_selectedEmployee);
                if (idx >= 0 && idx < employees.Count - 1)
                {
                    _selectedEmployee = employees[idx + 1];
                }
                else
                {
                    _selectedEmployee = null; // Back to Tôi
                }
            }

            if (_targetLabel) _targetLabel.text = _selectedEmployee != null ? _selectedEmployee.name : "Tôi";
            RefreshList();
        }

        Dictionary<string, string> CurrentOutfit()
        {
            var p = _net.Profile;
            return _selectedEmployee != null ? _selectedEmployee.outfit : p.outfit;
        }

        void RefreshList()
        {
            if (_content == null) return;
            foreach (Transform child in _content) Destroy(child.gameObject);

            var p = _net.Profile;
            var outfit = CurrentOutfit() ?? new Dictionary<string, string>();

            // Section 1: Equipped Items
            var eqHeader = Ui.Rect("EqHeader", _content);
            eqHeader.sizeDelta = new Vector2(0f, 32f);
            Ui.Label(eqHeader, "Đang mặc", Theme.TextMd, Theme.TextDark, TextAlignmentOptions.MidlineLeft);

            string[] slots = { "hat", "shirt", "pants", "acc" };
            string[] slotNames = { "Mũ", "Áo", "Quần", "Phụ kiện" };

            for (int i = 0; i < slots.Length; i++)
            {
                string slotKey = slots[i];
                string slotTitle = slotNames[i];
                bool hasEquipped = outfit.TryGetValue(slotKey, out var wearableId) && !string.IsNullOrEmpty(wearableId);
                var w = hasEquipped ? _net.GetWearable(wearableId) : null;

                CreateEquippedRow(_content, slotKey, slotTitle, w);
            }

            // Section 2: Wardrobe Inventory
            var wbHeader = Ui.Rect("WbHeader", _content);
            wbHeader.sizeDelta = new Vector2(0f, 36f);
            Ui.Label(wbHeader, "Trong tủ", Theme.TextMd, Theme.TextDark, TextAlignmentOptions.MidlineLeft);

            if (p.wardrobe == null || p.wardrobe.Count == 0)
            {
                var emptyCard = Ui.Rect("EmptyNotice", _content);
                emptyCard.sizeDelta = new Vector2(0f, 44f);
                Ui.Label(emptyCard, "Tủ trống. Mua đồ ở Cửa hàng.", Theme.TextSm, Theme.TextMuted, TextAlignmentOptions.Midline);
            }
            else
            {
                foreach (var id in p.wardrobe)
                {
                    var w = _net.GetWearable(id);
                    if (w == null) continue;
                    bool isEquippedByCurrent = outfit.TryGetValue(w.slot, out var equippedId) && equippedId == w.id;
                    if (isEquippedByCurrent) continue; // Already shown in equipped section

                    CreateWardrobeRow(_content, w);
                }
            }
        }

        void CreateEquippedRow(Transform parent, string slotKey, string slotTitle, Wearable w)
        {
            var rt = Ui.Rect("Slot_" + slotKey, parent);
            rt.sizeDelta = new Vector2(0f, 54f);

            var bg = rt.gameObject.AddComponent<Image>();
            Ui.SetSprite(bg, Theme.RowSprite());

            // Label
            var labelBox = Ui.Rect("Labels", rt);
            Ui.Place(labelBox, Ui.MiddleLeft, new Vector2(400f, 44f), new Vector2(Theme.Space3, 0f), Ui.MiddleLeft);

            if (w != null)
            {
                string text = $"{slotTitle}: {w.name}   +{w.moneyPct}% tiền · +{w.charm} đẹp";
                Ui.Label(labelBox, text, Theme.TextMd, Theme.TextDark);

                var takeOffBtn = UiTextButton.Create(rt, "Cởi", Theme.Btn.Gray);
                Ui.Place(takeOffBtn.Rect, Ui.MiddleRight, new Vector2(80f, 36f), new Vector2(-Theme.Space2, 0f), Ui.MiddleRight);
                takeOffBtn.Clicked += () =>
                {
                    _net.Send("takeOff", new Dictionary<string, object>
                    {
                        ["slot"] = slotKey,
                        ["employeeId"] = _selectedEmployee != null ? _selectedEmployee.id : ""
                    });
                    CurrentOutfit()?.Remove(slotKey);
                    RefreshList();
                };
            }
            else
            {
                Ui.Label(labelBox, $"{slotTitle}: (trống)", Theme.TextMd, Theme.TextMuted);
            }
        }

        void CreateWardrobeRow(Transform parent, Wearable w)
        {
            var rt = Ui.Rect("WItem_" + w.id, parent);
            rt.sizeDelta = new Vector2(0f, 60f);

            var bg = rt.gameObject.AddComponent<Image>();
            Ui.SetSprite(bg, Theme.RowSprite());

            // Icon
            string spriteName = "wear_" + w.id;
            if (!SpriteLibrary.Has(spriteName)) spriteName = "icon_wardrobe";
            var icon = Ui.Img(rt, "Icon", spriteName);
            Ui.Place(icon.rectTransform, Ui.MiddleLeft, new Vector2(42f, 42f), new Vector2(Theme.Space2, 0f), Ui.MiddleLeft);

            // Labels
            var labelBox = Ui.Rect("Labels", rt);
            Ui.Place(labelBox, Ui.MiddleLeft, new Vector2(400f, 44f), new Vector2(56f, 0f), Ui.MiddleLeft);
            var v = labelBox.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = 2f;
            v.childControlWidth = true;
            v.childControlHeight = false;
            v.childForceExpandWidth = true;

            Ui.Label(labelBox, w.name, Theme.TextMd, Theme.TextDark);
            string stats = $"+{w.moneyPct}% tiền · +{w.xpPct}% KN · +{w.charm} đẹp";
            Ui.Label(labelBox, stats, Theme.TextSm, Theme.TextMuted);

            // Wear Button
            var wearBtn = UiTextButton.Create(rt, "Mặc", Theme.Btn.Green);
            Ui.Place(wearBtn.Rect, Ui.MiddleRight, new Vector2(90f, 38f), new Vector2(-Theme.Space2, 0f), Ui.MiddleRight);
            wearBtn.Clicked += () =>
            {
                _net.Send("wear", new Dictionary<string, object>
                {
                    ["wearableId"] = w.id,
                    ["employeeId"] = _selectedEmployee != null ? _selectedEmployee.id : ""
                });
                var outfit = CurrentOutfit();
                if (outfit != null) outfit[w.slot] = w.id;
                RefreshList();
            };
        }
    }
}
