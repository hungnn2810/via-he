// Bus modal: browse online streets, occupancy status, and travel to other players' streets.
// All player-facing copy is in Vietnamese.
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class BusModal : UiModal
    {
        Network _net;
        Action<string, int> _onSelectStreet;
        RectTransform _content;
        TextMeshProUGUI _statusLabel;

        public static BusModal Show(Network net, Action<string, int> onSelectStreet)
        {
            if (net == null) return null;

            var modal = MakeModal<BusModal>("Xe buýt", new Vector2(740f, 540f), Theme.Skin.Amber, closable: true);
            modal._net = net;
            modal._onSelectStreet = onSelectStreet;
            modal.Build();
            modal.Open();
            modal.LoadStreets();
            return modal;
        }

        void Build()
        {
            // Top Notice in cream board
            var notice = Ui.Img(Body, "Notice", Theme.BoardCreamSprite());
            notice.rectTransform.anchorMin = new Vector2(0f, 1f);
            notice.rectTransform.anchorMax = new Vector2(1f, 1f);
            notice.rectTransform.offsetMin = new Vector2(Theme.Space3, -46f);
            notice.rectTransform.offsetMax = new Vector2(-Theme.Space3, -Theme.Space1);

            var label = Ui.Label(notice.transform,
                "Sang phố bạn để bày hàng ké, tưới giúp và trò chuyện. Chủ phố nhận 10% phí vỉa hè.",
                Theme.TextXs, Theme.TextDark, TextAlignmentOptions.Midline, Ui.Edge.None);
            Ui.Stretch(label.rectTransform, Theme.Space2, 0, Theme.Space2, 0);

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

            _statusLabel = Ui.Label(content, "Đang tải danh sách phố...", Theme.TextSm, Theme.TextMuted, TextAlignmentOptions.Center);
            _statusLabel.rectTransform.sizeDelta = new Vector2(0f, 50f);

            // Footer
            AddButton("Đóng", Theme.Btn.Blue, () => Close(), closesWindow: true);
        }

        async void LoadStreets()
        {
            try
            {
                var streets = await _net.ListStreets();
                if (_content == null) return;

                foreach (Transform child in _content) Destroy(child.gameObject);

                if (streets == null || streets.Count == 0)
                {
                    var emptyLabel = Ui.Label(_content, "Chưa có phố nào khác.", Theme.TextSm, Theme.TextMuted, TextAlignmentOptions.Center);
                    emptyLabel.rectTransform.sizeDelta = new Vector2(0f, 50f);
                    return;
                }

                foreach (var s in streets)
                {
                    CreateStreetRow(_content, s);
                }
            }
            catch (Exception ex)
            {
                if (_statusLabel != null)
                {
                    _statusLabel.text = "Không tải được danh sách phố: " + ex.Message;
                }
            }
        }

        void CreateStreetRow(Transform parent, StreetSummary s)
        {
            var rt = Ui.Rect("Street_" + s.ownerId, parent);
            rt.sizeDelta = new Vector2(0f, 66f);

            var bg = rt.gameObject.AddComponent<Image>();
            Ui.SetSprite(bg, Theme.RowSprite());

            // Icon
            var icon = Ui.Img(rt, "Icon", "icon_bus");
            Ui.Place(icon.rectTransform, Ui.MiddleLeft, new Vector2(44f, 44f), new Vector2(Theme.Space2, 0f), Ui.MiddleLeft);

            // Labels
            var labelBox = Ui.Rect("Labels", rt);
            Ui.Place(labelBox, Ui.MiddleLeft, new Vector2(420f, 50f), new Vector2(60f, 0f), Ui.MiddleLeft);
            var v = labelBox.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = 2f;
            v.childControlWidth = true;
            v.childControlHeight = false;
            v.childForceExpandWidth = true;

            bool isMe = _net.Account != null && s.ownerId == _net.Account.id;
            string prefix = isMe ? "Bạn · " : "";
            string title = $"{prefix}Phố {s.ownerName} (cấp {s.ownerLevel})";
            Ui.Label(labelBox, title, Theme.TextMd, Theme.TextDark);

            string occupancy = s.playerCount > 0
                ? $"<color=#2f9e44>{s.playerCount} người · {s.stallCount} sạp</color>"
                : "<color=#8aa1b8>vắng</color>";
            Ui.Label(labelBox, occupancy, Theme.TextSm, Theme.TextMuted);

            // Action Button
            var goBtn = UiTextButton.Create(rt, isMe ? "Về phố" : "Đi", isMe ? Theme.Btn.Blue : Theme.Btn.Green);
            Ui.Place(goBtn.Rect, Ui.MiddleRight, new Vector2(110f, 42f), new Vector2(-Theme.Space2, 0f), Ui.MiddleRight);
            goBtn.Clicked += () =>
            {
                Close();
                _onSelectStreet?.Invoke(s.ownerId, s.district);
            };
        }
    }
}
