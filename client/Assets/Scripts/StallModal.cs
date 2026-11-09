// Stall modal: opening a street stall, picking product and seller, setting stock quantity,
// and closing an active stall. All player-facing text is in Vietnamese.
using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ViaHeOnline.Schema;

namespace ViaHeOnline
{
    public class StallModal : UiModal
    {
        Network _net;
        StreetState _state;
        int _slot;

        Product _selectedProduct;
        Employee _selectedSeller; // null = Tự bán
        int _quantity = 1;

        // UI References
        RectTransform _listContent;
        TextMeshProUGUI _sellerLabel;
        TextMeshProUGUI _qtyLabel;
        UiTextButton _confirmBtn;
        readonly List<GameObject> _productRows = new List<GameObject>();

        public static StallModal Show(Network net, StreetState state, int slot)
        {
            if (net == null || net.Profile == null) return null;

            // Auto-detect empty slot if not specified
            if (slot < 0)
            {
                slot = FindEmptySlot(net, state);
                if (slot < 0)
                {
                    UiToast.Show("Phố hết chỗ dọn hàng rồi, đi xe buýt sang phố khác nhé", Theme.ToastTone.Warning);
                    return null;
                }
            }

            var modal = MakeModal<StallModal>($"Dọn hàng ô {slot + 1}", new Vector2(760f, 540f), Theme.Skin.Amber, closable: true);
            modal._net = net;
            modal._state = state;
            modal._slot = slot;
            modal.Build();
            modal.Open();
            return modal;
        }

        public static void ShowClose(Network net, Stall stall)
        {
            if (net == null || stall == null) return;
            var product = net.GetProduct(stall.productId);

            var modal = UiModal.Create("Sạp của bạn", new Vector2(520f, 320f), Theme.Skin.Amber, closable: true);

            var msgBox = Ui.Rect("Content", modal.Body);
            Ui.Stretch(msgBox, Theme.Space4, Theme.Space3, Theme.Space4, Theme.Space3);
            var v = msgBox.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = Theme.Space3;
            v.childControlWidth = true;
            v.childControlHeight = false;
            v.childForceExpandWidth = true;

            string prodName = product != null ? product.name : stall.productId;
            Ui.Label(msgBox, $"{prodName} còn {stall.remaining} phần. Người bán: {stall.sellerName}",
                Theme.TextMd, Theme.TextDark, TextAlignmentOptions.Center);

            string refundNote = product != null && product.homegrown
                ? $"Dọn sạp sẽ cất {stall.remaining} phần {prodName} vào kho hàng."
                : $"Dọn sạp sẽ hoàn {Network.Money(stall.remaining * (product?.cost ?? 0))} tiền hàng còn lại.";
            Ui.Label(msgBox, refundNote, Theme.TextSm, Theme.TextMuted, TextAlignmentOptions.Center, wrap: true);

            modal.AddButton("Bán tiếp", Theme.Btn.Blue, () => modal.Close(), closesWindow: true);
            modal.AddButton("Dọn sạp", Theme.Btn.Red, () =>
            {
                var _net = net;
                _net.Send("closeStall", new Dictionary<string, object> { ["slot"] = stall.slot });
            }, closesWindow: true);

            modal.Open();
        }

        static int FindEmptySlot(Network net, StreetState state)
        {
            if (state == null) return -1;
            bool isOwner = net.Account != null && state.ownerId == net.Account.id;
            int start = isOwner ? 0 : state.ownerSlots;
            for (int i = start; i < state.slotCount; i++)
            {
                if (!state.stalls.ContainsKey(i.ToString())) return i;
            }
            return -1;
        }

        void Build()
        {
            var p = _net.Profile;
            var catalog = _net.Catalog;

            // Top notice in cream board
            var noteBoard = Ui.Img(Body, "NoticeBoard", Theme.BoardCreamSprite());
            Ui.Place(noteBoard.rectTransform, Ui.TopCenter, new Vector2(Body.rect.width - 2f * Theme.Space3, 40f),
                new Vector2(0f, -Theme.Space2), Ui.TopCenter);
            noteBoard.rectTransform.anchorMin = new Vector2(0f, 1f);
            noteBoard.rectTransform.anchorMax = new Vector2(1f, 1f);
            noteBoard.rectTransform.offsetMin = new Vector2(Theme.Space3, -42f);
            noteBoard.rectTransform.offsetMax = new Vector2(-Theme.Space3, -Theme.Space1);

            var noteLabel = Ui.Label(noteBoard.transform,
                "Chọn món và người đứng bán. Hàng thừa được hoàn tiền hoặc trả về kho khi dọn sạp.",
                Theme.TextXs, Theme.TextDark, TextAlignmentOptions.Midline, Ui.Edge.None);
            Ui.Stretch(noteLabel.rectTransform, Theme.Space2, 0, Theme.Space2, 0);

            // Two columns layout: Left (Product list), Right (Seller & Quantity config)
            var mainArea = Ui.Rect("MainArea", Body);
            Ui.Stretch(mainArea, Theme.Space2, Theme.Space2, Theme.Space2, 48f);

            var leftRt = Ui.Rect("LeftCol", mainArea);
            leftRt.anchorMin = new Vector2(0f, 0f);
            leftRt.anchorMax = new Vector2(0.58f, 1f);
            leftRt.offsetMin = leftRt.offsetMax = Vector2.zero;

            var rightRt = Ui.Rect("RightCol", mainArea);
            rightRt.anchorMin = new Vector2(0.60f, 0f);
            rightRt.anchorMax = new Vector2(1f, 1f);
            rightRt.offsetMin = rightRt.offsetMax = Vector2.zero;

            BuildProductList(leftRt);
            BuildControlPanel(rightRt);

            // Footer buttons
            AddButton("Bỏ qua", Theme.Btn.Gray, () => Close(), closesWindow: true);
            _confirmBtn = AddButton("Dọn hàng", Theme.Btn.Green, OnConfirmOpenStall);

            UpdateCapacity();
        }

        void BuildProductList(RectTransform parent)
        {
            var scrollGo = Ui.Rect("ScrollList", parent);
            Ui.Stretch(scrollGo);

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

            _listContent = content;

            var products = _net.Catalog?.products ?? new List<Product>();
            foreach (var prod in products)
            {
                CreateProductRow(content, prod);
            }
        }

        void CreateProductRow(Transform parent, Product prod)
        {
            var p = _net.Profile;
            bool locked = p.level < prod.unlockLevel;
            int stock = p.store != null && p.store.TryGetValue(prod.id, out var s) ? s : 0;

            var rt = Ui.Rect("Row_" + prod.id, parent);
            rt.sizeDelta = new Vector2(0f, 64f);

            var bg = rt.gameObject.AddComponent<Image>();
            Ui.SetSprite(bg, Theme.RowSprite());

            var btn = rt.gameObject.AddComponent<Button>();
            btn.targetGraphic = bg;
            btn.interactable = !locked;

            // Product Icon
            string spriteName = "counter_" + prod.id;
            if (!SpriteLibrary.Has(spriteName)) spriteName = "icon_stall";
            var icon = Ui.Img(rt, "Icon", spriteName);
            Ui.Place(icon.rectTransform, Ui.MiddleLeft, new Vector2(48f, 48f), new Vector2(Theme.Space2, 0f), Ui.MiddleLeft);

            // Labels
            var labelBox = Ui.Rect("Labels", rt);
            Ui.Place(labelBox, Ui.MiddleLeft, new Vector2(260f, 48f), new Vector2(62f, 0f), Ui.MiddleLeft);
            var v = labelBox.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = 2f;
            v.childControlWidth = true;
            v.childControlHeight = false;
            v.childForceExpandWidth = true;

            string titleText = locked
                ? $"{prod.name}   (mở ở cấp {prod.unlockLevel})"
                : prod.name;
            Color titleColor = locked ? Theme.TextMuted : Theme.TextDark;
            Ui.Label(labelBox, titleText, Theme.TextMd, titleColor);

            string priceText = prod.homegrown
                ? $"trong kho {stock} → bán {Network.Money(prod.price)}"
                : $"nhập {Network.Money(prod.cost)} → bán {Network.Money(prod.price)}";
            Ui.Label(labelBox, priceText, Theme.TextSm, Theme.TextMuted);

            btn.onClick.AddListener(() =>
            {
                SelectProduct(prod);
            });

            _productRows.Add(rt.gameObject);

            if (_selectedProduct == null && !locked)
            {
                SelectProduct(prod);
            }
        }

        void SelectProduct(Product prod)
        {
            _selectedProduct = prod;
            UpdateCapacity();
        }

        void BuildControlPanel(RectTransform parent)
        {
            var vlg = parent.gameObject.AddComponent<VerticalLayoutGroup>();
            vlg.spacing = Theme.Space3;
            vlg.childControlWidth = true;
            vlg.childControlHeight = false;
            vlg.childForceExpandWidth = true;

            // Box 1: Seller Selection
            var sellerBox = Ui.Rect("SellerBox", parent);
            sellerBox.sizeDelta = new Vector2(0f, 100f);
            var sellerBg = sellerBox.gameObject.AddComponent<Image>();
            Ui.SetSprite(sellerBg, Theme.RowSprite());

            var sbV = sellerBox.gameObject.AddComponent<VerticalLayoutGroup>();
            sbV.padding = new RectOffset((int)Theme.Space3, (int)Theme.Space3, (int)Theme.Space2, (int)Theme.Space2);
            sbV.spacing = Theme.Space2;
            sbV.childControlWidth = true;
            sbV.childControlHeight = false;
            sbV.childForceExpandWidth = true;

            Ui.Label(sellerBox, "Người đứng bán:", Theme.TextSm, Theme.TextDark);

            var sellerRow = Ui.Rect("SellerRow", sellerBox);
            sellerRow.sizeDelta = new Vector2(0f, 38f);
            var srH = sellerRow.gameObject.AddComponent<HorizontalLayoutGroup>();
            srH.spacing = Theme.Space2;
            srH.childControlWidth = true;
            srH.childControlHeight = true;
            srH.childForceExpandWidth = false;

            _sellerLabel = Ui.Label(sellerRow, "Tự bán", Theme.TextMd, Theme.TextDark, TextAlignmentOptions.MidlineLeft);
            var le = _sellerLabel.gameObject.AddComponent<LayoutElement>();
            le.preferredWidth = 140f;

            var changeSellerBtn = UiTextButton.Create(sellerRow, "Đổi", Theme.Btn.Blue);
            var leBtn = changeSellerBtn.Rect.gameObject.AddComponent<LayoutElement>();
            leBtn.preferredWidth = 70f;
            leBtn.preferredHeight = 36f;
            changeSellerBtn.Clicked += CycleSeller;

            // Box 2: Quantity Selection
            var qtyBox = Ui.Rect("QtyBox", parent);
            qtyBox.sizeDelta = new Vector2(0f, 110f);
            var qtyBg = qtyBox.gameObject.AddComponent<Image>();
            Ui.SetSprite(qtyBg, Theme.RowSprite());

            var qbV = qtyBox.gameObject.AddComponent<VerticalLayoutGroup>();
            qbV.padding = new RectOffset((int)Theme.Space3, (int)Theme.Space3, (int)Theme.Space2, (int)Theme.Space2);
            qbV.spacing = Theme.Space2;
            qbV.childControlWidth = true;
            qbV.childControlHeight = false;
            qbV.childForceExpandWidth = true;

            Ui.Label(qtyBox, "Số lượng dọn hàng:", Theme.TextSm, Theme.TextDark);

            var counterRow = Ui.Rect("CounterRow", qtyBox);
            counterRow.sizeDelta = new Vector2(0f, 40f);
            var crH = counterRow.gameObject.AddComponent<HorizontalLayoutGroup>();
            crH.spacing = Theme.Space2;
            crH.childControlWidth = true;
            crH.childControlHeight = true;
            crH.childForceExpandWidth = false;

            var minusBtn = UiTextButton.Create(counterRow, "-", Theme.Btn.Gray);
            minusBtn.Rect.gameObject.AddComponent<LayoutElement>().preferredWidth = 40f;
            minusBtn.Clicked += () => AdjustQuantity(-1);

            _qtyLabel = Ui.Label(counterRow, "1", Theme.TextLg, Theme.TextDark, TextAlignmentOptions.Midline, Ui.Edge.None);
            _qtyLabel.gameObject.AddComponent<LayoutElement>().preferredWidth = 50f;

            var plusBtn = UiTextButton.Create(counterRow, "+", Theme.Btn.Gray);
            plusBtn.Rect.gameObject.AddComponent<LayoutElement>().preferredWidth = 40f;
            plusBtn.Clicked += () => AdjustQuantity(1);

            var maxBtn = UiTextButton.Create(counterRow, "Tối đa", Theme.Btn.Gold);
            maxBtn.Rect.gameObject.AddComponent<LayoutElement>().preferredWidth = 70f;
            maxBtn.Clicked += SetMaxQuantity;
        }

        void CycleSeller()
        {
            var p = _net.Profile;
            var employees = p.employees ?? new List<Employee>();

            if (_selectedSeller == null)
            {
                if (employees.Count > 0) _selectedSeller = employees[0];
            }
            else
            {
                int idx = employees.IndexOf(_selectedSeller);
                if (idx >= 0 && idx < employees.Count - 1)
                {
                    _selectedSeller = employees[idx + 1];
                }
                else
                {
                    _selectedSeller = null; // Back to Tự bán
                }
            }

            if (_sellerLabel)
            {
                _sellerLabel.text = _selectedSeller != null ? _selectedSeller.name : "Tự bán";
            }
            UpdateCapacity();
        }

        int GetMaxAllowedQuantity()
        {
            if (_selectedProduct == null || _net.Profile == null) return 1;
            var p = _net.Profile;

            int strength = _selectedSeller == null ? p.level * 2 : _selectedSeller.strength;
            int capacity = 20 + strength / 2;

            if (_selectedProduct.homegrown)
            {
                int inStore = p.store != null && p.store.TryGetValue(_selectedProduct.id, out var s) ? s : 0;
                return Mathf.Max(1, Mathf.Min(capacity, inStore));
            }
            else
            {
                int affordable = _selectedProduct.cost > 0 ? (int)(p.money / _selectedProduct.cost) : capacity;
                return Mathf.Max(1, Mathf.Min(capacity, affordable));
            }
        }

        void UpdateCapacity()
        {
            int max = GetMaxAllowedQuantity();
            _quantity = Mathf.Clamp(_quantity, 1, max);
            if (_qtyLabel) _qtyLabel.text = _quantity.ToString();
        }

        void AdjustQuantity(int delta)
        {
            int max = GetMaxAllowedQuantity();
            _quantity = Mathf.Clamp(_quantity + delta, 1, max);
            if (_qtyLabel) _qtyLabel.text = _quantity.ToString();
        }

        void SetMaxQuantity()
        {
            _quantity = GetMaxAllowedQuantity();
            if (_qtyLabel) _qtyLabel.text = _quantity.ToString();
        }

        void OnConfirmOpenStall()
        {
            if (_selectedProduct == null) return;
            var p = _net.Profile;

            if (_selectedProduct.homegrown)
            {
                int inStore = p.store != null && p.store.TryGetValue(_selectedProduct.id, out var s) ? s : 0;
                if (inStore < 1)
                {
                    UiToast.Show("Kho hết hàng này rồi", Theme.ToastTone.Warning);
                    return;
                }
            }
            else
            {
                long totalCost = _selectedProduct.cost * _quantity;
                if (p.money < totalCost)
                {
                    UiToast.Show("Không đủ tiền nhập hàng", Theme.ToastTone.Warning);
                    return;
                }
            }

            _net.Send("openStall", new Dictionary<string, object>
            {
                ["slot"] = _slot,
                ["productId"] = _selectedProduct.id,
                ["quantity"] = _quantity,
                ["employeeId"] = _selectedSeller != null ? _selectedSeller.id : ""
            });

            UiToast.Show($"Dọn {_quantity} phần {_selectedProduct.name}. Chạm vào khách đi ngang để mời!", Theme.ToastTone.Success);
            Close();
        }
    }
}
