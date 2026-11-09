// HUD stat chip pill (Money, Gems, Energy, Fame, Timer, etc.).
// Uses Theme.ChipSprite() ("chip_navy"), formatted numerals and optional action (+) button.
using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class UiStatChip : MonoBehaviour
    {
        public Image Background { get; private set; }
        public Image IconImage { get; private set; }
        public TextMeshProUGUI ValueLabel { get; private set; }
        public UiIconButton PlusButton { get; private set; }
        public event Action OnTapped;

        public static UiStatChip Create(Transform parent, Theme.Icon icon, string initialValue = "0",
            Action onPlus = null, float width = 140f, float height = Theme.ChipHeight)
        {
            var go = Ui.Rect("StatChip:" + icon, parent);
            go.sizeDelta = new Vector2(width, height);

            var chip = go.gameObject.AddComponent<UiStatChip>();
            chip.Background = Ui.Img(go, "Bg", Theme.ChipSprite(), true);
            Ui.Stretch(chip.Background.rectTransform);
            Ui.OnTap(chip.Background, () => chip.OnTapped?.Invoke());

            // Left icon
            float iconSize = height - 6f;
            chip.IconImage = Ui.Img(go, "Icon", Theme.IconSprite(icon));
            Ui.Place(chip.IconImage.rectTransform, Ui.MiddleLeft, new Vector2(iconSize, iconSize),
                new Vector2(Theme.Space1, 0f), Ui.MiddleLeft);

            // Optional right plus button
            float rightPadding = Theme.Space2;
            if (onPlus != null)
            {
                float btnSize = height - 8f;
                chip.PlusButton = UiIconButton.Create(go, Theme.Icon.Plus, Theme.Btn.Green, btnSize, onPlus);
                Ui.Place(chip.PlusButton.Rect, Ui.MiddleRight, new Vector2(btnSize, btnSize),
                    new Vector2(-Theme.Space1, 0f), Ui.MiddleRight);
                rightPadding = btnSize + Theme.Space2;
            }

            // Text label
            float leftPadding = iconSize + Theme.Space2;
            chip.ValueLabel = Ui.Label(go, initialValue, Theme.TextSm, Theme.Gold,
                TextAlignmentOptions.MidlineRight, Ui.Edge.Thick, name: "Value");
            Ui.Stretch(chip.ValueLabel.rectTransform, leftPadding, 0f, rightPadding, 0f);

            return chip;
        }

        public void SetValue(string text)
        {
            ValueLabel.text = text ?? "";
        }

        public void SetValue(long number)
        {
            ValueLabel.text = Ui.Number(number);
        }

        public void SetIcon(Theme.Icon icon)
        {
            Ui.SetSprite(IconImage, Theme.IconSprite(icon));
        }
    }
}
