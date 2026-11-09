// Toast notification banner.
// Lives in UiRoot.ToastLayer (anchored to the device safe area).
// Uses Theme.ToastSprite(tone), Theme.ToastIcon(tone), and proper contrasting typography.
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class UiToast : UiLayer
    {
        public Image Plate { get; private set; }
        public Image Icon { get; private set; }
        public TextMeshProUGUI MessageLabel { get; private set; }

        float _dismissTime;
        static UiToast _current;

        public static UiToast Show(string message, Theme.ToastTone tone = Theme.ToastTone.Info, float duration = 2.5f)
        {
            if (_current)
            {
                _current.Close(animate: false);
            }

            var root = UiRoot.Ensure();
            var go = Ui.Rect("Toast", root.ToastLayer);
            var toast = go.gameObject.AddComponent<UiToast>();
            _current = toast;

            // Plate background
            toast.Plate = Ui.Img(go, "Plate", Theme.ToastSprite(tone));
            Ui.Stretch(toast.Plate.rectTransform);

            // Icon
            var iconType = Theme.ToastIcon(tone);
            toast.Icon = Ui.Img(go, "Icon", Theme.IconSprite(iconType));
            Ui.Place(toast.Icon.rectTransform, Ui.MiddleLeft, new Vector2(30f, 30f), new Vector2(Theme.Space3, 0f), Ui.MiddleLeft);

            // Label
            var textColor = Theme.ToastTextColor(tone);
            var edge = Theme.ToastTextOutlined(tone) ? Ui.Edge.Thin : Ui.Edge.None;
            toast.MessageLabel = Ui.Label(go, message, Theme.TextSm, textColor,
                TextAlignmentOptions.MidlineLeft, edge, wrap: true, name: "Msg");
            Ui.Stretch(toast.MessageLabel.rectTransform, 30f + Theme.Space4, Theme.Space1, Theme.Space3, Theme.Space1);

            // Size dynamically according to message length
            var preferred = toast.MessageLabel.GetPreferredValues(message, 450f, 0f);
            float width = Mathf.Clamp(preferred.x + 30f + Theme.Space4 + Theme.Space3 + 20f, 220f, 520f);
            float height = Mathf.Max(Theme.ToastHeight, preferred.y + Theme.Space2 * 2f);

            // Anchored to top of safe area, dropped down slightly
            Ui.Place(go, Ui.TopCenter, new Vector2(width, height), new Vector2(0f, -Theme.Space4), Ui.TopCenter);

            toast._dismissTime = Time.unscaledTime + duration;
            toast.Open();
            return toast;
        }

        void LateUpdate()
        {
            if (IsOpen && Time.unscaledTime >= _dismissTime)
            {
                Close();
            }
        }

        protected override void Apply(float eased)
        {
            base.Apply(eased);
            // Slide down gently from top
            var rt = (RectTransform)transform;
            rt.anchoredPosition = new Vector2(0f, Mathf.Lerp(20f, -Theme.Space4, eased));
        }

        protected override void OnClosed()
        {
            base.OnClosed();
            if (_current == this) _current = null;
            Destroy(gameObject, Duration + 0.05f);
        }
    }
}
