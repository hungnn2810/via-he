// Builders shared by every widget in the kit: rects, sprite images and TextMeshPro labels.
// Sprites are always looked up through Theme; nothing in the kit spells a sprite name.
using System;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public static class Ui
    {
        /// The dark outline drawn around text. Thin for body copy, Thick for display numerals and titles.
        public enum Edge { None, Thin, Thick }

        public static RectTransform Rect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.layer = parent.gameObject.layer;
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            return rt;
        }

        /// Fill the parent, inset by the given amounts.
        public static RectTransform Stretch(RectTransform rt, float left = 0, float bottom = 0, float right = 0, float top = 0)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.offsetMin = new Vector2(left, bottom);
            rt.offsetMax = new Vector2(-right, -top);
            return rt;
        }

        /// Inset given as (left, bottom, right, top), the same order as a sprite border.
        public static RectTransform Stretch(RectTransform rt, Vector4 inset) => Stretch(rt, inset.x, inset.y, inset.z, inset.w);

        /// Pin to a single anchor point with a fixed size. The pivot defaults to the anchor.
        public static RectTransform Place(RectTransform rt, Vector2 anchor, Vector2 size, Vector2 position, Vector2? pivot = null)
        {
            rt.anchorMin = anchor;
            rt.anchorMax = anchor;
            rt.pivot = pivot ?? anchor;
            rt.sizeDelta = size;
            rt.anchoredPosition = position;
            return rt;
        }

        public static readonly Vector2 Center = new Vector2(0.5f, 0.5f);
        public static readonly Vector2 TopLeft = new Vector2(0f, 1f);
        public static readonly Vector2 TopCenter = new Vector2(0.5f, 1f);
        public static readonly Vector2 TopRight = new Vector2(1f, 1f);
        public static readonly Vector2 BottomLeft = new Vector2(0f, 0f);
        public static readonly Vector2 BottomCenter = new Vector2(0.5f, 0f);
        public static readonly Vector2 BottomRight = new Vector2(1f, 0f);
        public static readonly Vector2 MiddleLeft = new Vector2(0f, 0.5f);
        public static readonly Vector2 MiddleRight = new Vector2(1f, 0.5f);

        /// An Image child. A null sprite name gives a flat white quad (tint it with color).
        public static Image Img(Transform parent, string name, string sprite, bool raycast = false)
        {
            var img = Rect(name, parent).gameObject.AddComponent<Image>();
            SetSprite(img, sprite);
            img.raycastTarget = raycast;
            return img;
        }

        public static void SetSprite(Image img, string sprite) => SetSprite(img, SpriteLibrary.Get(sprite));

        /// Sprites with a 9-slice border are drawn Sliced at the theme's border scale; the rest stay Simple.
        public static void SetSprite(Image img, Sprite sprite)
        {
            img.sprite = sprite;
            img.type = sprite != null && sprite.border != Vector4.zero ? Image.Type.Sliced : Image.Type.Simple;
            img.pixelsPerUnitMultiplier = Theme.PixelsPerUnitMultiplier;
            img.preserveAspect = img.type == Image.Type.Simple;
        }

        public static TextMeshProUGUI Label(Transform parent, string text, int size, Color color,
            TextAlignmentOptions align = TextAlignmentOptions.MidlineLeft, Edge edge = Edge.None, bool wrap = false,
            string name = "Label")
        {
            var t = Rect(name, parent).gameObject.AddComponent<TextMeshProUGUI>();
            var font = UiFont.Asset;
            if (font != null) t.font = font;
            t.fontSize = size;
            t.color = color;
            t.alignment = align;
            t.richText = true;
            t.raycastTarget = false;
            t.textWrappingMode = wrap ? TextWrappingModes.Normal : TextWrappingModes.NoWrap;
            t.overflowMode = TextOverflowModes.Ellipsis;
            SetEdge(t, edge);
            t.text = text ?? "";
            return t;
        }

        /// Outline comes from a shared material, so every label with the same edge batches together.
        public static void SetEdge(TMP_Text label, Edge edge)
        {
            var m = UiFont.EdgeMaterial(edge);
            if (m != null) label.fontSharedMaterial = m;
        }

        public static Color WithAlpha(Color c, float a) => new Color(c.r, c.g, c.b, a);

        /// 12345678 -> "12.345.678", the Vietnamese grouping, without allocating a culture.
        static readonly System.Globalization.NumberFormatInfo Grouped = new System.Globalization.NumberFormatInfo
        {
            NumberGroupSeparator = ".",
            NumberDecimalDigits = 0,
        };

        public static string Number(long value) => value.ToString("N0", Grouped);

        /// Gives any rect a tap handler without drawing anything.
        public static UiTap OnTap(Graphic target, Action onTap)
        {
            target.raycastTarget = true;
            var tap = target.gameObject.GetComponent<UiTap>();
            if (tap == null) tap = target.gameObject.AddComponent<UiTap>();
            tap.Tapped = onTap;
            return tap;
        }
    }

    /// A bare click handler: used for scrims and row bodies that need no pressed art.
    public class UiTap : MonoBehaviour, IPointerClickHandler
    {
        public Action Tapped;

        public void OnPointerClick(PointerEventData eventData) => Tapped?.Invoke();
    }
}
