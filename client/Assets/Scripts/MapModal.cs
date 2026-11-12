// District map: the player's own districts (the first is free, up to ten) and the public districts anyone can enter.
// Prices, levels and fame come from the server catalog. All player-facing copy is in Vietnamese.
using System;
using System.Threading.Tasks;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class MapModal : UiModal
    {
        Network _net;
        Action<int> _onOpenDistrict;
        Action<string> _onOpenPublic;
        RectTransform _content;

        public static MapModal Show(Network net, Action<int> onOpenDistrict, Action<string> onOpenPublic)
        {
            if (net == null || net.Catalog == null) return null;

            var modal = MakeModal<MapModal>("Bản đồ khu phố", new Vector2(740f, 580f), Theme.Skin.Amber, closable: true);
            modal._net = net;
            modal._onOpenDistrict = onOpenDistrict;
            modal._onOpenPublic = onOpenPublic;
            modal.Build();
            modal.Open();
            modal.Rebuild();
            return modal;
        }

        void Build()
        {
            var notice = Ui.Img(Body, "Notice", Theme.BoardCreamSprite());
            notice.rectTransform.anchorMin = new Vector2(0f, 1f);
            notice.rectTransform.anchorMax = new Vector2(1f, 1f);
            notice.rectTransform.offsetMin = new Vector2(Theme.Space3, -46f);
            notice.rectTransform.offsetMax = new Vector2(-Theme.Space3, -Theme.Space1);

            var label = Ui.Label(notice.transform,
                "Mua thêm khu phố để mở rộng (tối đa 10). Khu phố chung ai cũng vào bán được, không mất phí vỉa hè.",
                Theme.TextXs, Theme.TextDark, TextAlignmentOptions.Midline, Ui.Edge.None);
            Ui.Stretch(label.rectTransform, Theme.Space2, 0, Theme.Space2, 0);

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

            AddButton("Đóng", Theme.Btn.Blue, () => Close(), closesWindow: true);
        }

        void Rebuild()
        {
            if (_content == null) return;
            foreach (Transform child in _content) Destroy(child.gameObject);

            var p = _net.Profile;
            var districts = _net.Catalog.districts;
            int owned = p?.districts != null ? p.districts.Count : 1;
            int max = Mathf.Min(_net.Catalog.maxDistricts, districts.Count);

            for (int i = 0; i < max; i++) CreateDistrictRow(i, districts[i], owned);

            if (_net.Catalog.publicDistricts != null && _net.Catalog.publicDistricts.Count > 0)
            {
                var header = Ui.Label(_content, "Khu phố chung", Theme.TextMd, Theme.TextDark, TextAlignmentOptions.MidlineLeft);
                header.rectTransform.sizeDelta = new Vector2(0f, 34f);
                foreach (var d in _net.Catalog.publicDistricts) CreatePublicRow(d);
            }
        }

        void CreateDistrictRow(int index, DistrictInfo d, int owned)
        {
            var rt = Ui.Rect("District_" + index, _content);
            rt.sizeDelta = new Vector2(0f, 66f);
            Ui.SetSprite(rt.gameObject.AddComponent<Image>(), Theme.RowSprite());

            var labelBox = Ui.Rect("Labels", rt);
            Ui.Place(labelBox, Ui.MiddleLeft, new Vector2(500f, 54f), new Vector2(Theme.Space3, 0f), Ui.MiddleLeft);
            var v = labelBox.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = 2f;
            v.childControlWidth = true;
            v.childControlHeight = false;
            v.childForceExpandWidth = true;

            Ui.Label(labelBox, $"Khu {index + 1}: {d.name}", Theme.TextMd, Theme.TextDark);
            string needs = $"cấp {d.unlockLevel}" + (d.needsFame > 0 ? $", {d.needsFame} điểm nổi tiếng" : "");
            string cost = d.cost > 0 ? $" · {Network.Money(d.cost)}" : " · miễn phí";
            Ui.Label(labelBox, needs + cost, Theme.TextSm, Theme.TextMuted);

            if (index < owned)
            {
                var go = UiTextButton.Create(rt, "Đi", Theme.Btn.Green);
                Ui.Place(go.Rect, Ui.MiddleRight, new Vector2(110f, 42f), new Vector2(-Theme.Space2, 0f), Ui.MiddleRight);
                go.Clicked += () => { Close(); _onOpenDistrict?.Invoke(index); };
            }
            else if (index == owned)
            {
                var buy = UiTextButton.Create(rt, "Mua", Theme.Btn.Blue);
                Ui.Place(buy.Rect, Ui.MiddleRight, new Vector2(110f, 42f), new Vector2(-Theme.Space2, 0f), Ui.MiddleRight);
                buy.Clicked += BuyNext;
            }
            else
            {
                var locked = Ui.Label(rt, "Mua khu trước đó", Theme.TextSm, Theme.TextMuted, TextAlignmentOptions.MidlineRight);
                Ui.Place(locked.rectTransform, Ui.MiddleRight, new Vector2(150f, 42f), new Vector2(-Theme.Space2, 0f), Ui.MiddleRight);
            }
        }

        void CreatePublicRow(PublicDistrictInfo d)
        {
            var rt = Ui.Rect("Public_" + d.id, _content);
            rt.sizeDelta = new Vector2(0f, 56f);
            Ui.SetSprite(rt.gameObject.AddComponent<Image>(), Theme.RowSprite());

            var name = Ui.Label(rt, d.name, Theme.TextMd, Theme.TextDark, TextAlignmentOptions.MidlineLeft);
            Ui.Place(name.rectTransform, Ui.MiddleLeft, new Vector2(500f, 40f), new Vector2(Theme.Space3, 0f), Ui.MiddleLeft);

            var go = UiTextButton.Create(rt, "Vào", Theme.Btn.Green);
            Ui.Place(go.Rect, Ui.MiddleRight, new Vector2(110f, 42f), new Vector2(-Theme.Space2, 0f), Ui.MiddleRight);
            go.Clicked += () => { Close(); _onOpenPublic?.Invoke(d.id); };
        }

        // The server checks level, fame and money; its answer arrives as a profile update (or an error toast)
        async void BuyNext()
        {
            _net.Send("buyDistrict");
            try
            {
                await Task.Delay(500);
                Rebuild();
            }
            catch (Exception) { /* modal closed meanwhile */ }
        }
    }
}
