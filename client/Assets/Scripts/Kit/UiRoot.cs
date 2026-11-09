// The one Canvas everything hangs from, its layers, the safe area, the Escape / Android Back key
// and the stack of full screens.
//
// Canvas: Screen Space Overlay, 1280x720 reference, match 0.5. referencePixelsPerUnit is set to the
// sprite set's 200 px per unit so a sliced border is its sprite pixels divided by
// Theme.PixelsPerUnitMultiplier, wherever the sprite is used.
//
// Layer order, back to front: Screens < Windows < Toasts < Overlay.
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class UiRoot : MonoBehaviour
    {
        static UiRoot _instance;

        Canvas _canvas;
        readonly List<UiPanel> _panels = new List<UiPanel>();
        readonly List<UiScreen> _history = new List<UiScreen>();

        public RectTransform ScreenLayer { get; private set; }
        public RectTransform WindowLayer { get; private set; }
        /// Fitted to the safe area, because toasts must not hide under a notch.
        public RectTransform ToastLayer { get; private set; }
        public RectTransform OverlayLayer { get; private set; }
        public RectTransform Rect { get; private set; }

        public static UiRoot Instance => Ensure();

        public static UiRoot Ensure()
        {
            if (_instance) return _instance;
            var go = new GameObject("UI", typeof(RectTransform));
            go.layer = LayerMask.NameToLayer("UI");
            _instance = go.AddComponent<UiRoot>();
            _instance.Build();
            return _instance;
        }

        void Build()
        {
            Rect = (RectTransform)transform;
            _canvas = gameObject.AddComponent<Canvas>();
            _canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var scaler = gameObject.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = Theme.ReferenceResolution;
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;
            scaler.referencePixelsPerUnit = Theme.SpritePixelsPerUnit;

            gameObject.AddComponent<GraphicRaycaster>();
            EnsureEventSystem();

            ScreenLayer = Layer("Screens");
            WindowLayer = Layer("Windows");
            ToastLayer = Layer("Toasts");
            ToastLayer.gameObject.AddComponent<UiSafeArea>();
            OverlayLayer = Layer("Overlay");
        }

        RectTransform Layer(string name) => Ui.Stretch(Ui.Rect(name, transform));

        static void EnsureEventSystem()
        {
            if (FindAnyObjectByType<EventSystem>()) return;
            var es = new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            DontDestroyOnLoad(es);
        }

        /// The canvas size in reference units: 1280x720 at most aspect ratios, wider or taller otherwise.
        public Vector2 CanvasSize => new Vector2(Screen.width, Screen.height) / Mathf.Max(0.01f, _canvas.scaleFactor);

        /// Safe-area margins in reference units, as (left, bottom, right, top).
        public Vector4 SafeInsets
        {
            get
            {
                var s = Screen.safeArea;
                float k = 1f / Mathf.Max(0.01f, _canvas.scaleFactor);
                return new Vector4(s.xMin, s.yMin, Screen.width - s.xMax, Screen.height - s.yMax) * k;
            }
        }

        // ---- Escape / Android Back ----

        internal void Register(UiPanel panel)
        {
            if (!_panels.Contains(panel)) _panels.Add(panel);
        }

        internal void Unregister(UiPanel panel) => _panels.Remove(panel);

        /// True while any modal or sheet is open, so the street scene can ignore taps behind it.
        public bool HasOpenPanel => _panels.Count > 0;

        // ---- Pressed-button watch ----

        UiButton _watched;

        /// A held button belongs to a scroll view the moment the finger starts dragging; the root checks it
        /// each frame so idle buttons need no Update of their own.
        internal void WatchPress(UiButton button) => _watched = button;

        void Update()
        {
            if (_watched)
            {
                if (!_watched.IsPressed) _watched = null;
                else if (_watched.Dragging) { _watched.CancelPress(); _watched = null; }
            }
            if (!Input.GetKeyDown(KeyCode.Escape)) return;
            for (int i = _panels.Count - 1; i >= 0; i--)
            {
                if (!_panels[i].CloseOnBack) continue;
                _panels[i].Close();
                return;
            }
            if (_panels.Count == 0) Back();
        }

        // ---- Screens ----

        /// Show a full screen. Persistent screens (the HUD) stay up under whatever comes next; any other
        /// screen replaces the current one and goes on the history stack so Back can return to it.
        public void OpenScreen(UiScreen screen)
        {
            if (!screen.Persistent && _history.Count > 0)
            {
                var current = _history[_history.Count - 1];
                if (current == screen) return;
                current.Close(false);
            }
            if (!screen.Persistent) _history.Add(screen);
            screen.Open();
        }

        /// Close the current screen and show the one before it. Returns false at the bottom of the stack.
        public bool Back()
        {
            if (_history.Count < 2) return false;
            _history[_history.Count - 1].Close();
            _history.RemoveAt(_history.Count - 1);
            _history[_history.Count - 1].Open();
            return true;
        }
    }
}
