// Full-screen presentation layer.
// Screens sit in UiRoot.ScreenLayer. Persistent screens (such as the main HUD) remain visible underneath,
// while regular screens participate in the back-stack navigation history.
using UnityEngine;

namespace ViaHeOnline
{
    public abstract class UiScreen : UiLayer
    {
        public RectTransform Rect { get; private set; }
        public RectTransform Content { get; private set; }
        public UiSafeArea SafeArea { get; private set; }

        /// If true, this screen stays alive underneath other screens (e.g. Street HUD).
        public virtual bool Persistent => false;

        protected UiRoot Root => UiRoot.Instance;

        protected override void Awake()
        {
            base.Awake();
            Rect = (RectTransform)transform;
        }

        /// Base factory helper to construct a screen under UiRoot.ScreenLayer.
        protected static T CreateScreen<T>(string name, bool useSafeArea = true) where T : UiScreen
        {
            var root = UiRoot.Ensure();
            var holder = Ui.Stretch(Ui.Rect(name, root.ScreenLayer));
            var screen = holder.gameObject.AddComponent<T>();

            if (useSafeArea)
            {
                var safeGo = Ui.Stretch(Ui.Rect("SafeArea", holder.transform));
                screen.SafeArea = safeGo.gameObject.AddComponent<UiSafeArea>();
                screen.Content = safeGo;
            }
            else
            {
                screen.Content = holder;
            }

            screen.gameObject.SetActive(false);
            return screen;
        }

        protected override void Apply(float eased)
        {
            base.Apply(eased);
            // Screens fade in/out cleanly
            if (Content) Content.localScale = Vector3.one * Mathf.Lerp(0.98f, 1f, eased);
        }
    }
}
