// Base for the windows that sit above the screens: Modal (centred) and Sheet (docked to an edge).
// Owns the scrim, the frame, the close badge, Escape handling and the open/close animation.
using System;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public abstract class UiPanel : UiLayer
    {
        public Theme.Skin Skin { get; private set; }
        public RectTransform Frame { get; private set; }
        /// The area inside the frame's board, where a window puts its content.
        public RectTransform Body { get; private set; }
        public UiIconButton CloseButton { get; private set; }
        public Image Scrim { get; private set; }

        /// Tapping the dimmed area outside the window closes it.
        public bool DismissOnScrim { get; set; } = true;
        /// Escape / Android Back closes it.
        public bool CloseOnBack { get; set; } = true;

        public event Action Closed;

        UiRoot _root;

        protected UiRoot Root => _root ? _root : (_root = UiRoot.Ensure());

        /// Builds the scrim and the frame under the window layer. Subclasses size the frame afterwards.
        protected static T Make<T>(string name, Theme.Skin skin, bool closable) where T : UiPanel
        {
            var root = UiRoot.Ensure();
            var holder = Ui.Stretch(Ui.Rect(name, root.WindowLayer));
            T made = holder.gameObject.AddComponent<T>();
            UiPanel panel = made;
            panel._root = root;
            panel.Skin = skin;

            panel.Scrim = Ui.Img(holder, "Scrim", null, true);
            panel.Scrim.color = Theme.Dim;
            Ui.Stretch(panel.Scrim.rectTransform);
            Ui.OnTap(panel.Scrim, panel.OnScrimTapped);

            // The frame swallows taps so a tap on the window itself never reaches the scrim
            var frame = Ui.Img(holder, "Frame", Theme.PanelSprite(skin), true);
            panel.Frame = frame.rectTransform;

            panel.Body = Ui.Rect("Body", panel.Frame);

            if (closable)
            {
                panel.CloseButton = UiIconButton.CreateClose(panel.Frame, () => panel.Close());
                Ui.Place(panel.CloseButton.Rect, Ui.TopRight, Vector2.one * Theme.CloseButtonSize, new Vector2(-6f, 4f), Ui.Center);
            }
            return made;
        }

        void OnScrimTapped()
        {
            if (DismissOnScrim) Close();
        }

        protected override void OnOpened() => Root.Register(this);

        protected override void OnClosed()
        {
            Root.Unregister(this);
            Closed?.Invoke();
        }

        protected override void Apply(float eased)
        {
            base.Apply(eased);
            if (Frame) ApplyFrame(eased);
        }

        /// Moves or scales the frame for the open/close animation. eased is 0 closed, 1 open.
        protected abstract void ApplyFrame(float eased);

        void OnDestroy()
        {
            if (_root) _root.Unregister(this);
        }
    }
}
