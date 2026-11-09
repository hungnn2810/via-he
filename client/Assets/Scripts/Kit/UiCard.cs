// Inner container card / sub-panel.
// Uses Theme.BoardSprite(skin) (e.g. board_cream or board_blue).
// Provides standardized padding and content hierarchy for nested views.
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class UiCard : MonoBehaviour
    {
        public Image Background { get; private set; }
        public RectTransform Body { get; private set; }
        public Theme.Skin Skin { get; private set; }

        public static UiCard Create(Transform parent, Theme.Skin skin = Theme.Skin.Amber,
            float padding = Theme.Space2)
        {
            var go = Ui.Rect("Card", parent);
            var card = go.gameObject.AddComponent<UiCard>();
            card.Skin = skin;

            card.Background = Ui.Img(go, "Bg", Theme.BoardSprite(skin));
            Ui.Stretch(card.Background.rectTransform);

            card.Body = Ui.Rect("Body", go);
            Ui.Stretch(card.Body, padding, padding, padding, padding);

            return card;
        }

        public void SetSkin(Theme.Skin skin)
        {
            Skin = skin;
            Ui.SetSprite(Background, Theme.BoardSprite(skin));
        }
    }
}
