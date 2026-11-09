// Log modal: business and street event history (co-selling, visits, watering help, sidewalk fees).
// All player-facing copy is in Vietnamese.
using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class LogModal : UiModal
    {
        Network _net;

        public static LogModal Show(Network net)
        {
            if (net == null || net.Profile == null) return null;

            var modal = MakeModal<LogModal>("Nhật ký", new Vector2(700f, 500f), Theme.Skin.Blue, closable: true);
            modal._net = net;
            modal.Build();
            modal.Open();
            return modal;
        }

        void Build()
        {
            var p = _net.Profile;
            var entries = p.log ?? new List<LogEntry>();

            if (entries.Count == 0)
            {
                var emptyLabel = Ui.Label(Body, "Chưa có gì. Ai ghé phố bạn, bày hàng ké hay tưới giúp sẽ hiện ở đây.",
                    Theme.TextMd, Theme.TextMuted, TextAlignmentOptions.Center, Ui.Edge.None, wrap: true);
                Ui.Stretch(emptyLabel.rectTransform, Theme.Space6, Theme.Space6, Theme.Space6, Theme.Space6);
            }
            else
            {
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

                // Display latest first
                for (int i = entries.Count - 1; i >= 0; i--)
                {
                    CreateLogRow(content, entries[i]);
                }
            }

            // Footer
            AddButton("Đóng", Theme.Btn.Blue, () => Close(), closesWindow: true);
        }

        static string FormatLogEntry(LogEntry entry) => entry.type switch
        {
            "co_selling" => $"Cảm ơn {entry.who} đã bày hàng ké, bán được {Network.Money(entry.amount)}",
            "help" => $"{entry.who} đã ghé giúp đỡ phố của bạn",
            "sidewalk_fee" => $"Nộp {Network.Money(entry.amount)} phí vỉa hè cho phố {entry.who}",
            "visit" => $"{entry.who} ghé thăm phố bạn",
            _ => $"{entry.who}: {entry.type}"
        };

        void CreateLogRow(Transform parent, LogEntry entry)
        {
            var rt = Ui.Rect("LogEntry", parent);
            rt.sizeDelta = new Vector2(0f, 54f);

            var bg = rt.gameObject.AddComponent<Image>();
            Ui.SetSprite(bg, Theme.RowSprite());

            // Icon by event type
            string iconName = entry.type switch
            {
                "co_selling" => "icon_coin",
                "help" => "icon_heart",
                "sidewalk_fee" => "icon_fame",
                _ => "icon_log"
            };
            var icon = Ui.Img(rt, "Icon", iconName);
            Ui.Place(icon.rectTransform, Ui.MiddleLeft, new Vector2(36f, 36f), new Vector2(Theme.Space2, 0f), Ui.MiddleLeft);

            // Message label
            string message = FormatLogEntry(entry);
            var label = Ui.Label(rt, message, Theme.TextSm, Theme.TextDark, TextAlignmentOptions.MidlineLeft, wrap: true);
            Ui.Stretch(label.rectTransform, 50f, 4f, Theme.Space2, 4f);
        }
    }
}
