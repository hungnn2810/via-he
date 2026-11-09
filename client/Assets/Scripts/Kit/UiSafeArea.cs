// Fits a rect to the device's safe area (notches, rounded corners, the Android gesture bar).
// Anything that must stay tappable and readable, like the HUD, lives under one of these.
using UnityEngine;

namespace ViaHeOnline
{
    public class UiSafeArea : MonoBehaviour
    {
        RectTransform _rect;
        Rect _applied;
        Vector2Int _resolution;

        void OnEnable() => Apply();

        void Update()
        {
            if (Screen.safeArea != _applied || Screen.width != _resolution.x || Screen.height != _resolution.y) Apply();
        }

        void Apply()
        {
            if (!_rect) _rect = (RectTransform)transform;
            if (Screen.width <= 0 || Screen.height <= 0) return;
            var safe = Screen.safeArea;
            _applied = safe;
            _resolution = new Vector2Int(Screen.width, Screen.height);
            _rect.anchorMin = new Vector2(safe.xMin / Screen.width, safe.yMin / Screen.height);
            _rect.anchorMax = new Vector2(safe.xMax / Screen.width, safe.yMax / Screen.height);
            _rect.offsetMin = Vector2.zero;
            _rect.offsetMax = Vector2.zero;
        }
    }
}
