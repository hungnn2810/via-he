// Notification and counter badge.
// Commonly pinned to tabs, icons, and HUD elements.
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class UiBadge : MonoBehaviour
    {
        public RectTransform Rect { get; private set; }
        public Image Background { get; private set; }
        public TextMeshProUGUI CountLabel { get; private set; }
        public Theme.BadgeTone Tone { get; private set; } = Theme.BadgeTone.Red;

        public static UiBadge Create(Transform parent, int count = 0, Theme.BadgeTone tone = Theme.BadgeTone.Red)
        {
            var go = Ui.Rect("Badge", parent);
            var badge = go.gameObject.AddComponent<UiBadge>();
            badge.Rect = go;
            badge.Tone = tone;

            badge.Background = Ui.Img(go, "Bg", Theme.BadgeSprite(tone));
            Ui.Stretch(badge.Background.rectTransform);

            badge.CountLabel = Ui.Label(go, count > 99 ? "99+" : count.ToString(), Theme.TextXs, Theme.TextOnDark,
                TextAlignmentOptions.Midline, Ui.Edge.Thin, name: "Text");
            Ui.Stretch(badge.CountLabel.rectTransform);

            badge.SetCount(count);
            return badge;
        }

        public void SetTone(Theme.BadgeTone tone)
        {
            Tone = tone;
            Ui.SetSprite(Background, Theme.BadgeSprite(tone));
        }

        public void SetCount(int count)
        {
            if (count <= 0)
            {
                gameObject.SetActive(false);
                return;
            }

            gameObject.SetActive(true);
            string text = count > 99 ? "99+" : count.ToString();
            CountLabel.text = text;

            // Adjust width depending on digit length: dot/single digit vs multi digit
            float minWidth = text.Length > 2 ? 34f : text.Length > 1 ? 28f : 20f;
            Rect.sizeDelta = new Vector2(minWidth, Theme.BadgeHeight);
        }

        public void SetText(string text)
        {
            if (string.IsNullOrEmpty(text))
            {
                gameObject.SetActive(false);
                return;
            }
            gameObject.SetActive(true);
            CountLabel.text = text;
            float width = Mathf.Max(20f, CountLabel.GetPreferredValues(text).x + Theme.Space2 * 2f);
            Rect.sizeDelta = new Vector2(width, Theme.BadgeHeight);
        }
    }
}
