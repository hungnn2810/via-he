// Builds uGUI in code from the sprite set: 9-slice frames, outlined text, icon buttons, input fields, scroll lists.
using System;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public static class UIBuilder
    {
        public static readonly Color TextDark = Draw.Hex("#1d3557");
        public static readonly Color TextMuted = Draw.Hex("#8aa1b8");
        public static readonly Color TextOutline = Draw.Hex("#3b2414");

        public static Canvas CreateCanvas()
        {
            var go = new GameObject("UI");
            var c = go.AddComponent<Canvas>();
            c.renderMode = RenderMode.ScreenSpaceOverlay;
            c.sortingOrder = 10;
            var s = go.AddComponent<CanvasScaler>();
            s.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            s.referenceResolution = new Vector2(1280, 720);
            s.matchWidthOrHeight = 0.5f;
            go.AddComponent<GraphicRaycaster>();
            if (!UnityEngine.Object.FindAnyObjectByType<EventSystem>())
            {
                var es = new GameObject("EventSystem");
                es.AddComponent<EventSystem>();
                es.AddComponent<StandaloneInputModule>();
            }
            return c;
        }

        public static RectTransform Box(Transform parent, string name)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        // Position by anchor + position + size (in 1280x720 reference units)
        public static RectTransform Place(RectTransform rt, Vector2 anchor, Vector2 position, Vector2 size, Vector2? pivot = null)
        {
            rt.anchorMin = rt.anchorMax = anchor;
            rt.pivot = pivot ?? anchor;
            rt.anchoredPosition = position;
            rt.sizeDelta = size;
            return rt;
        }

        public static void Fill(RectTransform rt, float margin = 0)
        {
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = new Vector2(margin, margin); rt.offsetMax = new Vector2(-margin, -margin);
        }

        // Image from the sprite set; 9-slice if the sprite has a border
        public static Image Image(Transform parent, string name, Color? color = null)
        {
            var rt = Box(parent, name);
            var im = rt.gameObject.AddComponent<Image>();
            im.sprite = SpriteLibrary.Get(name);
            im.color = color ?? Color.white;
            if (im.sprite && im.sprite.border != Vector4.zero) { im.type = UnityEngine.UI.Image.Type.Sliced; im.pixelsPerUnitMultiplier = 1.6f; }
            else im.preserveAspect = true;
            im.raycastTarget = false;
            return im;
        }

        public static Text Text(Transform parent, string text, int size, Color color, TextAnchor align = TextAnchor.MiddleLeft, bool outline = false)
        {
            var rt = Box(parent, "Text");
            var t = rt.gameObject.AddComponent<Text>();
            t.font = Draw.Font;
            t.text = text;
            t.fontSize = size;
            t.fontStyle = FontStyle.Normal;
            t.color = color;
            t.alignment = align;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            if (outline)
            {
                var o = rt.gameObject.AddComponent<Outline>();
                o.effectColor = new Color(0, 0, 0, 0.55f);
                o.effectDistance = new Vector2(1.6f, -1.6f);
            }
            return t;
        }

        // Glossy button: color = orange | green | blue | red | gray; optional icon (an icon_* sprite) above the label
        public static Button Button(Transform parent, string label, UnityAction onClick, string color = "orange", int fontSize = 20, string icon = null)
        {
            var im = Image(parent, "ui_button_" + color);
            im.raycastTarget = true;
            var go = im.gameObject;
            go.name = "Button " + label;
            var b = go.AddComponent<Button>();
            b.onClick.AddListener(SoundFx.Tap);
            b.onClick.AddListener(onClick);
            var c = b.colors; c.pressedColor = new Color(0.8f, 0.8f, 0.8f); b.colors = c;
            var t = Text(go.transform, label, fontSize, Color.white, TextAnchor.MiddleCenter, true);
            Fill(t.rectTransform, 4);
            if (icon != null)
            {
                var ic = Image(go.transform, icon);
                ic.rectTransform.anchorMin = new Vector2(0.15f, 0.36f); ic.rectTransform.anchorMax = new Vector2(0.85f, 0.97f);
                ic.rectTransform.offsetMin = ic.rectTransform.offsetMax = Vector2.zero;
                t.alignment = TextAnchor.LowerCenter;
                t.rectTransform.offsetMin = new Vector2(2, 6);
            }
            var le = go.AddComponent<LayoutElement>();
            le.minHeight = 50; le.preferredHeight = 50; le.minWidth = 100;
            return b;
        }

        public static InputField Input(Transform parent, string placeholder, string value, bool dark = false)
        {
            var im = Image(parent, dark ? "ui_tag" : "ui_row");
            im.raycastTarget = true;
            var go = im.gameObject;
            go.name = "Input";
            var f = go.AddComponent<InputField>();
            var t = Text(go.transform, value, 22, dark ? Color.white : TextDark); Fill(t.rectTransform, 16);
            t.supportRichText = false; t.fontStyle = FontStyle.Normal;
            var p = Text(go.transform, placeholder, 22, dark ? new Color(1, 1, 1, 0.55f) : TextMuted); Fill(p.rectTransform, 16);
            p.fontStyle = FontStyle.Italic;
            f.textComponent = t; f.placeholder = p; f.text = value;
            var le = go.AddComponent<LayoutElement>();
            le.minHeight = 54; le.preferredHeight = 54; le.flexibleWidth = 1;
            return f;
        }

        public static HorizontalLayoutGroup Row(Transform parent, float height = 60, bool background = true)
        {
            var rt = Box(parent, "Row");
            if (background) { var im = rt.gameObject.AddComponent<Image>(); im.sprite = SpriteLibrary.Get("ui_row"); im.type = UnityEngine.UI.Image.Type.Sliced; im.pixelsPerUnitMultiplier = 1.6f; }
            var h = rt.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.padding = new RectOffset(12, 10, 5, 5);
            h.spacing = 8; h.childControlWidth = true; h.childControlHeight = true;
            h.childForceExpandWidth = false; h.childForceExpandHeight = true;
            h.childAlignment = TextAnchor.MiddleLeft;
            var le = rt.gameObject.AddComponent<LayoutElement>();
            le.minHeight = height; le.preferredHeight = height;
            return h;
        }

        // Small icon at the start of a row
        public static Image Icon(Transform parent, string name, float size = 48)
        {
            var im = Image(parent, name);
            var le = im.gameObject.AddComponent<LayoutElement>();
            le.minWidth = le.preferredWidth = size; le.minHeight = size;
            return im;
        }

        // Window: rounded blue frame, title ribbon, red close button, vertically scrolling content. Returns the Transform that holds the rows.
        public static Transform Window(Transform parent, string title, Action onClose, out RectTransform root)
        {
            root = Box(parent, "Window " + title);
            Fill(root);
            var dim = root.gameObject.AddComponent<Image>(); dim.color = new Color(0, 0, 0, 0.45f);
            var frame = Image(root, "ui_panel").rectTransform;
            frame.anchorMin = Vector2.zero; frame.anchorMax = Vector2.one;
            frame.offsetMin = new Vector2(150, 50); frame.offsetMax = new Vector2(-150, -70);
            frame.GetComponent<Image>().raycastTarget = true;

            var ribbon = Place(Image(frame, "ui_ribbon").rectTransform, new Vector2(0.5f, 1), new Vector2(0, 34), new Vector2(420, 78), new Vector2(0.5f, 1));
            var titleText = Text(ribbon, title, 28, Color.white, TextAnchor.MiddleCenter, true);
            Fill(titleText.rectTransform); titleText.rectTransform.offsetMin = new Vector2(0, 14);

            var close = Button(frame, "✕", () => onClose(), "red", 26);
            Place((RectTransform)close.transform, new Vector2(1, 1), new Vector2(-14, -12), new Vector2(58, 54));

            var viewport = Box(frame, "Viewport");
            viewport.anchorMin = Vector2.zero; viewport.anchorMax = Vector2.one;
            viewport.offsetMin = new Vector2(30, 28); viewport.offsetMax = new Vector2(-30, -74);
            viewport.gameObject.AddComponent<RectMask2D>();
            var sr = viewport.gameObject.AddComponent<ScrollRect>();
            sr.horizontal = false;
            sr.scrollSensitivity = 30;
            var content = Box(viewport, "Content");
            content.anchorMin = new Vector2(0, 1); content.anchorMax = new Vector2(1, 1);
            content.pivot = new Vector2(0.5f, 1);
            content.offsetMin = content.offsetMax = Vector2.zero;
            var v = content.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = 8; v.childControlWidth = true; v.childControlHeight = true;
            v.childForceExpandWidth = true; v.childForceExpandHeight = false;
            content.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            sr.content = content;
            sr.viewport = viewport;
            return content;
        }

        // A flexible line of text in a list / row
        public static Text Label(Transform parent, string text, int size = 20, Color? color = null)
        {
            var t = Text(parent, text, size, color ?? TextDark);
            var le = t.gameObject.AddComponent<LayoutElement>();
            le.flexibleWidth = 1; le.minHeight = size + 10;
            return t;
        }
    }
}
