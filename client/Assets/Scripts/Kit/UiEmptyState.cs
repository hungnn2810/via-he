// Placeholder view displayed when a list, bag, or screen has no content.
// Features a centered icon, explanatory message, and optional call-to-action button.
using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class UiEmptyState : MonoBehaviour
    {
        public Image IconImage { get; private set; }
        public TextMeshProUGUI MessageLabel { get; private set; }
        public UiTextButton ActionButton { get; private set; }

        public static UiEmptyState Create(Transform parent, string message, Theme.Icon icon = Theme.Icon.Info,
            string actionText = null, Action onAction = null, Theme.Btn actionRole = Theme.Btn.Blue)
        {
            var go = Ui.Rect("EmptyState", parent);
            Ui.Stretch(go, Theme.Space4, Theme.Space4, Theme.Space4, Theme.Space4);

            var empty = go.gameObject.AddComponent<UiEmptyState>();

            // Center container
            var center = Ui.Rect("Center", go);
            Ui.Place(center, Ui.Center, new Vector2(380f, 180f), Vector2.zero, Ui.Center);

            // Icon
            empty.IconImage = Ui.Img(center, "Icon", Theme.IconSprite(icon));
            Ui.Place(empty.IconImage.rectTransform, Ui.TopCenter, new Vector2(56f, 56f), new Vector2(0f, -10f), Ui.TopCenter);

            // Message
            empty.MessageLabel = Ui.Label(center, message, Theme.TextSm, Theme.TextMuted,
                TextAlignmentOptions.Midline, Ui.Edge.None, wrap: true, name: "Message");
            Ui.Stretch(empty.MessageLabel.rectTransform, Theme.Space2, 54f, Theme.Space2, 70f);

            // Optional button
            if (!string.IsNullOrEmpty(actionText))
            {
                empty.ActionButton = UiTextButton.Create(center, actionText, actionRole, 150f, Theme.ButtonHeight - 6f, onAction);
                Ui.Place(empty.ActionButton.Rect, Ui.BottomCenter, new Vector2(150f, Theme.ButtonHeight - 6f), new Vector2(0f, 6f), Ui.BottomCenter);
            }

            return empty;
        }

        public void SetMessage(string message) => MessageLabel.text = message ?? "";
        public void SetIcon(Theme.Icon icon) => Ui.SetSprite(IconImage, Theme.IconSprite(icon));
    }
}
