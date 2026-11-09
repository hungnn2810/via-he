// Floating speech bubble / tooltip with tail pointing to a target UI element.
// Uses Theme.TooltipSprite() and Theme.TooltipTailSprite().
using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class UiTooltip : UiLayer
    {
        public Image BodyImage { get; private set; }
        public Image TailImage { get; private set; }
        public TextMeshProUGUI TextLabel { get; private set; }

        float _hideAt;
        bool _hasTimer;

        public static UiTooltip Show(Transform target, string text, float duration = 3.5f, Vector2? offset = null)
        {
            var root = UiRoot.Ensure();
            var go = Ui.Rect("Tooltip", root.OverlayLayer);
            var tooltip = go.gameObject.AddComponent<UiTooltip>();

            tooltip.BodyImage = Ui.Img(go, "Body", Theme.TooltipSprite(), true);
            Ui.Stretch(tooltip.BodyImage.rectTransform);

            tooltip.TailImage = Ui.Img(go, "Tail", Theme.TooltipTailSprite());
            tooltip.TailImage.rectTransform.pivot = new Vector2(0.5f, 1f);

            tooltip.TextLabel = Ui.Label(go, text, Theme.TextSm, Theme.TextDark,
                TextAlignmentOptions.Midline, Ui.Edge.None, wrap: true, name: "Text");
            Ui.Stretch(tooltip.TextLabel.rectTransform, Theme.Space3, Theme.Space2, Theme.Space3, Theme.Space2);

            // Size to content
            var preferred = tooltip.TextLabel.GetPreferredValues(text, 280f, 0f);
            float width = Mathf.Clamp(preferred.x + Theme.Space4 * 2f, 100f, 320f);
            float height = Mathf.Max(40f, preferred.y + Theme.Space3 * 2f);
            go.sizeDelta = new Vector2(width, height);

            // Position above target
            var targetRt = target as RectTransform;
            Vector3 worldPos = targetRt ? targetRt.position : target.position;
            Vector2 screenPoint = RectTransformUtility.WorldToScreenPoint(null, worldPos);
            RectTransformUtility.ScreenPointToLocalPointInRectangle(root.OverlayLayer, screenPoint, null, out var localPoint);

            var off = offset ?? new Vector2(0f, 40f);
            go.anchoredPosition = localPoint + off;

            // Tail position at bottom center
            Ui.Place(tooltip.TailImage.rectTransform, Ui.BottomCenter, new Vector2(24f, 14f), new Vector2(0f, -2f), Ui.TopCenter);

            // Tap tooltip to close early
            Ui.OnTap(tooltip.BodyImage, () => tooltip.Close());

            if (duration > 0f)
            {
                tooltip._hasTimer = true;
                tooltip._hideAt = Time.unscaledTime + duration;
            }

            tooltip.Open();
            return tooltip;
        }

        void LateUpdate()
        {
            if (_hasTimer && Time.unscaledTime >= _hideAt)
            {
                _hasTimer = false;
                Close();
            }
        }

        protected override void OnClosed()
        {
            base.OnClosed();
            Destroy(gameObject, Duration + 0.05f);
        }
    }
}
