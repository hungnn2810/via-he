// Standard row card for list views (e.g. inventory items, neighbours, staff, quests, shop items).
// Uses Theme.RowSprite(selected) and Theme.SlotSprite().
using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class UiRow : MonoBehaviour
    {
        public Image Background { get; private set; }
        public Image Slot { get; private set; }
        public Image Icon { get; private set; }
        public TextMeshProUGUI TitleLabel { get; private set; }
        public TextMeshProUGUI SubtitleLabel { get; private set; }
        public RectTransform RightArea { get; private set; }
        public UiTextButton ActionButton { get; private set; }

        public bool IsSelected { get; private set; }
        public event Action OnClick;

        public static UiRow Create(Transform parent, float height = Theme.RowHeight)
        {
            var go = Ui.Rect("Row", parent);
            go.sizeDelta = new Vector2(0f, height);

            var row = go.gameObject.AddComponent<UiRow>();
            row.Background = Ui.Img(go, "Bg", Theme.RowSprite(false), true);
            Ui.Stretch(row.Background.rectTransform);
            Ui.OnTap(row.Background, () => row.OnClick?.Invoke());

            // Left icon slot
            float slotSize = height - Theme.Space2 * 2f;
            row.Slot = Ui.Img(go, "Slot", Theme.SlotSprite());
            Ui.Place(row.Slot.rectTransform, Ui.MiddleLeft, new Vector2(slotSize, slotSize),
                new Vector2(Theme.Space2, 0f), Ui.MiddleLeft);

            row.Icon = Ui.Img(row.Slot.transform, "Icon", null);
            Ui.Stretch(row.Icon.rectTransform, Theme.Space1, Theme.Space1, Theme.Space1, Theme.Space1);

            // Right area for button or figures
            row.RightArea = Ui.Rect("RightArea", go);
            Ui.Place(row.RightArea, Ui.MiddleRight, new Vector2(160f, height),
                new Vector2(-Theme.Space2, 0f), Ui.MiddleRight);

            // Center text content
            float textLeft = Theme.Space2 + slotSize + Theme.Space2;
            var textHolder = Ui.Rect("Texts", go);
            Ui.Stretch(textHolder, textLeft, Theme.Space1, 170f, Theme.Space1);

            row.TitleLabel = Ui.Label(textHolder, "", Theme.TextMd, Theme.TextDark,
                TextAlignmentOptions.MidlineLeft, Ui.Edge.None, name: "Title");
            Ui.Place(row.TitleLabel.rectTransform, Ui.MiddleLeft, new Vector2(300f, 26f), new Vector2(0f, 10f), Ui.MiddleLeft);

            row.SubtitleLabel = Ui.Label(textHolder, "", Theme.TextSm, Theme.TextMuted,
                TextAlignmentOptions.MidlineLeft, Ui.Edge.None, name: "Subtitle");
            Ui.Place(row.SubtitleLabel.rectTransform, Ui.MiddleLeft, new Vector2(300f, 22f), new Vector2(0f, -12f), Ui.MiddleLeft);

            return row;
        }

        public void SetSelected(bool selected)
        {
            IsSelected = selected;
            Ui.SetSprite(Background, Theme.RowSprite(selected));
        }

        public void SetIcon(string spriteName)
        {
            if (string.IsNullOrEmpty(spriteName))
            {
                Icon.gameObject.SetActive(false);
            }
            else
            {
                Icon.gameObject.SetActive(true);
                Ui.SetSprite(Icon, spriteName);
            }
        }

        public void SetIcon(Theme.Icon icon) => SetIcon(Theme.IconSprite(icon));

        public void SetTexts(string title, string subtitle = null)
        {
            TitleLabel.text = title ?? "";
            if (string.IsNullOrEmpty(subtitle))
            {
                SubtitleLabel.gameObject.SetActive(false);
                TitleLabel.rectTransform.anchoredPosition = Vector2.zero;
            }
            else
            {
                SubtitleLabel.gameObject.SetActive(true);
                SubtitleLabel.text = subtitle;
                TitleLabel.rectTransform.anchoredPosition = new Vector2(0f, 10f);
            }
        }

        public void SetActionButton(string text, Theme.Btn role, Action onClick, float width = 110f)
        {
            if (string.IsNullOrEmpty(text))
            {
                if (ActionButton) ActionButton.gameObject.SetActive(false);
                return;
            }

            if (!ActionButton)
            {
                ActionButton = UiTextButton.Create(RightArea, text, role, width, Theme.ButtonHeight - 8f, onClick);
                Ui.Place(ActionButton.Rect, Ui.MiddleRight, new Vector2(width, Theme.ButtonHeight - 8f), Vector2.zero, Ui.MiddleRight);
            }
            else
            {
                ActionButton.gameObject.SetActive(true);
                ActionButton.SetText(text);
                ActionButton.SetRole(role);
                ActionButton.Rect.sizeDelta = new Vector2(width, Theme.ButtonHeight - 8f);
                ActionButton.Clicked -= onClick;
                ActionButton.Clicked += onClick;
            }
        }
    }
}
