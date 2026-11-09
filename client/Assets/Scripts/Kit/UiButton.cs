// Buttons. A button's pressed and disabled looks are drawn art (btn_*_pressed / btn_*_disabled), swapped
// in by sprite, never a runtime tint. The label or icon is nudged down on press to match the art.
using System;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace ViaHeOnline
{
    /// Press handling and sprite swapping shared by UiTextButton and UiIconButton.
    public class UiButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler, IPointerClickHandler
    {
        // How far the pressed art sits below the raised art, in reference units (4 sprite px)
        const float PressNudge = 2.5f;

        public event Action Clicked;
        /// A tap on a disabled button. Wire it to a Tooltip that says why ("Cần cấp 5").
        public event Action ClickedWhileDisabled;

        public RectTransform Rect { get; private set; }
        public Image Face { get; private set; }
        /// Label or icon holder; moves down while pressed.
        public RectTransform Content { get; private set; }
        public bool PlaySound { get; set; } = true;
        /// When above zero the whole button shrinks to this scale while pressed (for art with no pressed frame).
        public float PressScale { get; set; }

        Sprite _normal, _pressed, _disabled;
        bool _interactable = true;
        bool _down;
        PointerEventData _pointer;

        public bool Interactable
        {
            get => _interactable;
            set
            {
                if (_interactable == value) return;
                _interactable = value;
                if (!value) _down = false;
                Refresh();
                OnInteractableChanged();
            }
        }

        protected virtual void OnInteractableChanged() { }

        /// Builds the face and content holder. Called once by the factories.
        protected void Init(RectTransform rect, Image face, RectTransform content)
        {
            Rect = rect;
            Face = face;
            Content = content;
            face.raycastTarget = true;
        }

        protected void SetArt(string normal, string pressed, string disabled)
        {
            _normal = SpriteLibrary.Get(normal);
            _pressed = SpriteLibrary.Get(pressed);
            _disabled = SpriteLibrary.Get(disabled);
            Ui.SetSprite(Face, _normal);
            Refresh();
        }

        void Refresh()
        {
            var sprite = !_interactable ? _disabled : _down ? _pressed : _normal;
            if (sprite != null && Face.sprite != sprite) Face.sprite = sprite;
            if (Content) Content.anchoredPosition = _down && PressScale <= 0f ? new Vector2(0f, -PressNudge) : Vector2.zero;
            Rect.localScale = _down && PressScale > 0f ? Vector3.one * PressScale : Vector3.one;
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            if (!_interactable) return;
            _down = true;
            _pointer = eventData;
            Refresh();
            UiRoot.Instance.WatchPress(this);
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            if (!_down) return;
            _down = false;
            Refresh();
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            if (!_down) return;
            _down = false;
            Refresh();
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            if (!_interactable)
            {
                if (PlaySound) SoundFx.Error();
                ClickedWhileDisabled?.Invoke();
                return;
            }
            if (PlaySound) SoundFx.Tap();
            Clicked?.Invoke();
        }

        // A drag that started on the button belongs to the scroll view behind it. UiRoot watches the held button and
        // calls this, so idle buttons carry no per-frame cost (and stay enabled: a disabled component gets no pointer events).
        internal bool IsPressed => _down;
        internal bool Dragging => _pointer != null && _pointer.dragging;

        internal void CancelPress()
        {
            _down = false;
            Refresh();
        }

        void OnDisable()
        {
            _down = false;
            if (Face && Rect) Refresh();
        }

        protected static Image BuildFace(Transform parent, string name, out RectTransform content)
        {
            var face = Ui.Img(parent, name, null, true);
            content = Ui.Stretch(Ui.Rect("Content", face.transform));
            return face;
        }
    }

    /// A role-coloured button with a text label.
    public class UiTextButton : UiButton
    {
        public TextMeshProUGUI Label { get; private set; }
        public Theme.Btn Role { get; private set; }

        public static UiTextButton Create(Transform parent, string text, Theme.Btn role = Theme.Btn.Green,
            float width = 160f, float height = Theme.ButtonHeight, Action onClick = null)
        {
            var face = BuildFace(parent, "Button:" + text, out var content);
            var button = face.gameObject.AddComponent<UiTextButton>();
            button.Init(face.rectTransform, face, content);
            face.rectTransform.sizeDelta = new Vector2(width, height);

            button.Label = Ui.Label(content, text, Theme.TextMd, Theme.TextOnDark, TextAlignmentOptions.Midline, Ui.Edge.Thin);
            Ui.Stretch(button.Label.rectTransform, Theme.Space2, 0, Theme.Space2, 0);
            button.SetRole(role);
            if (onClick != null) button.Clicked += onClick;
            return button;
        }

        public void SetText(string text) => Label.text = text;

        public void SetRole(Theme.Btn role)
        {
            Role = role;
            SetArt(Theme.ButtonSprite(role), Theme.ButtonSprite(role, pressed: true), Theme.ButtonSprite(role, disabled: true));
        }

        protected override void OnInteractableChanged()
        {
            // The disabled art is grey, so the label drops its light-on-colour outline for a muted ink
            Label.color = Interactable ? Theme.TextOnDark : Theme.TextMuted;
            Ui.SetEdge(Label, Interactable ? Ui.Edge.Thin : Ui.Edge.None);
        }
    }

    /// A square button with an icon on it, plus the round close badge for windows.
    public class UiIconButton : UiButton
    {
        public Image Icon { get; private set; }

        public static UiIconButton Create(Transform parent, Theme.Icon icon, Theme.Btn role = Theme.Btn.Blue,
            float size = Theme.IconButtonSize, Action onClick = null)
        {
            var face = BuildFace(parent, "IconButton:" + icon, out var content);
            var button = face.gameObject.AddComponent<UiIconButton>();
            button.Init(face.rectTransform, face, content);
            face.rectTransform.sizeDelta = new Vector2(size, size);
            button.SetArt(Theme.ButtonSprite(role), Theme.ButtonSprite(role, pressed: true), Theme.ButtonSprite(role, disabled: true));

            button.Icon = Ui.Img(content, "Icon", Theme.IconSprite(icon));
            Ui.Place(button.Icon.rectTransform, Ui.Center, Vector2.one * size * 0.6f, Vector2.zero);
            if (onClick != null) button.Clicked += onClick;
            return button;
        }

        /// The round badge pinned to a window's top-right corner. It has one drawn frame, so it shrinks on press.
        public static UiIconButton CreateClose(Transform parent, Action onClick = null)
        {
            var face = BuildFace(parent, "CloseButton", out var content);
            var button = face.gameObject.AddComponent<UiIconButton>();
            button.Init(face.rectTransform, face, content);
            face.rectTransform.sizeDelta = Vector2.one * Theme.CloseButtonSize;
            button.SetArt(Theme.CloseSprite(), Theme.CloseSprite(), Theme.CloseSprite());
            button.PressScale = 0.9f;
            if (onClick != null) button.Clicked += onClick;
            return button;
        }

        public void SetIcon(Theme.Icon icon) => Ui.SetSprite(Icon, Theme.IconSprite(icon));
        public void SetIcon(Sprite sprite) => Ui.SetSprite(Icon, sprite);
    }
}
