// Top bar for screens, sheets, or major window sections.
// Displays title, subtitle, optional left navigation button (Back) and right action/close buttons.
using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class UiHeader : MonoBehaviour
    {
        public Image Background { get; private set; }
        public TextMeshProUGUI TitleLabel { get; private set; }
        public TextMeshProUGUI SubtitleLabel { get; private set; }
        public UiIconButton LeftButton { get; private set; }
        public UiIconButton RightButton { get; private set; }
        public RectTransform RightSlot { get; private set; }

        public static UiHeader Create(Transform parent, string title, string subtitle = null,
            Action onBack = null, Action onClose = null, float height = Theme.HeaderHeight)
        {
            var go = Ui.Rect("Header", parent);
            go.anchorMin = new Vector2(0f, 1f);
            go.anchorMax = new Vector2(1f, 1f);
            go.pivot = new Vector2(0.5f, 1f);
            go.sizeDelta = new Vector2(0f, height);

            var header = go.gameObject.AddComponent<UiHeader>();
            header.Background = Ui.Img(go, "Bar", Theme.BarSprite());
            Ui.Stretch(header.Background.rectTransform);

            // Left back button if onBack provided
            float leftPad = Theme.Space3;
            if (onBack != null)
            {
                header.LeftButton = UiIconButton.Create(go, Theme.Icon.ArrowLeft, Theme.Btn.Blue, 40f, onBack);
                Ui.Place(header.LeftButton.Rect, Ui.MiddleLeft, new Vector2(40f, 40f), new Vector2(Theme.Space3, 0f), Ui.MiddleLeft);
                leftPad = 40f + Theme.Space4;
            }

            // Right close or custom action
            float rightPad = Theme.Space3;
            if (onClose != null)
            {
                header.RightButton = UiIconButton.CreateClose(go, onClose);
                Ui.Place(header.RightButton.Rect, Ui.MiddleRight, Vector2.one * Theme.CloseButtonSize, new Vector2(-Theme.Space3, 0f), Ui.MiddleRight);
                rightPad = Theme.CloseButtonSize + Theme.Space4;
            }

            header.RightSlot = Ui.Rect("RightSlot", go);
            Ui.Place(header.RightSlot, Ui.MiddleRight, new Vector2(120f, height), new Vector2(-rightPad, 0f), Ui.MiddleRight);

            // Titles
            var titlesHolder = Ui.Rect("Titles", go);
            Ui.Stretch(titlesHolder, leftPad, Theme.Space1, rightPad + 120f, Theme.Space1);

            header.TitleLabel = Ui.Label(titlesHolder, title, Theme.TextLg, Theme.Gold,
                TextAlignmentOptions.MidlineLeft, Ui.Edge.Thick, name: "Title");
            Ui.Place(header.TitleLabel.rectTransform, Ui.MiddleLeft, new Vector2(400f, 32f),
                string.IsNullOrEmpty(subtitle) ? Vector2.zero : new Vector2(0f, 8f), Ui.MiddleLeft);

            if (!string.IsNullOrEmpty(subtitle))
            {
                header.SubtitleLabel = Ui.Label(titlesHolder, subtitle, Theme.TextXs, Theme.TextOnDark,
                    TextAlignmentOptions.MidlineLeft, Ui.Edge.Thin, name: "Subtitle");
                Ui.Place(header.SubtitleLabel.rectTransform, Ui.MiddleLeft, new Vector2(400f, 20f), new Vector2(0f, -12f), Ui.MiddleLeft);
            }

            return header;
        }

        public void SetTitle(string title, string subtitle = null)
        {
            TitleLabel.text = title ?? "";
            if (SubtitleLabel)
            {
                SubtitleLabel.text = subtitle ?? "";
                SubtitleLabel.gameObject.SetActive(!string.IsNullOrEmpty(subtitle));
            }
        }
    }
}
