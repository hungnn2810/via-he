// Scene helpers: place sprites from the sprite set, outlined text, 9-slice frames in world space.
using UnityEngine;

namespace ViaHeOnline
{
    public static class Draw
    {
        static Sprite _square, _circle;
        static Font _font;

        // Charm Bold is already heavy, so text uses FontStyle.Normal; the built-in font is only a fallback
        public static Font Font => _font ??= Resources.Load<Font>("Fonts/Charm-Bold") ?? Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

        public static Sprite Square
        {
            get
            {
                if (_square) return _square;
                var t = new Texture2D(4, 4) { filterMode = FilterMode.Point };
                var px = new Color[16];
                for (int i = 0; i < 16; i++) px[i] = Color.white;
                t.SetPixels(px); t.Apply();
                return _square = Sprite.Create(t, new Rect(0, 0, 4, 4), new Vector2(0.5f, 0.5f), 4);
            }
        }

        public static Sprite Circle
        {
            get
            {
                if (_circle) return _circle;
                const int n = 64;
                var t = new Texture2D(n, n) { filterMode = FilterMode.Bilinear };
                for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(n / 2f, n / 2f));
                    t.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp01(n / 2f - d)));
                }
                t.Apply();
                return _circle = Sprite.Create(t, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), n);
            }
        }

        public static Color Hex(string hex) => ColorUtility.TryParseHtmlString(hex, out var c) ? c : Color.magenta;

        // Place a sprite from the sprite set at a position (relative to the sprite's pivot)
        public static SpriteRenderer Put(Transform parent, string name, Vector2 position, float scale, int order)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = position;
            go.transform.localScale = new Vector3(scale, scale, 1);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = SpriteLibrary.Get(name);
            sr.sortingOrder = order;
            return sr;
        }

        // Tiled sprite (sidewalk, road) or 9-slice (bubble, label); size in world units
        public static SpriteRenderer Sized(Transform parent, string name, Vector2 position, Vector2 size, int order, SpriteDrawMode mode)
        {
            var sr = Put(parent, name, position, 1, order);
            sr.drawMode = mode;
            if (mode == SpriteDrawMode.Tiled) sr.tileMode = SpriteTileMode.Continuous;
            sr.size = size;
            return sr;
        }

        public static SpriteRenderer Block(Transform parent, string name, Sprite sprite, Color color, Vector2 position, Vector2 size, int order)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = position;
            go.transform.localScale = new Vector3(size.x, size.y, 1);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.color = color;
            sr.sortingOrder = order;
            return sr;
        }

        public static TextMesh Text(Transform parent, string text, Vector2 position, float size, Color color, int order)
        {
            var go = new GameObject("Text");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = position;
            var tm = go.AddComponent<TextMesh>();
            tm.font = Font;
            tm.text = text;
            tm.fontSize = 64;
            tm.fontStyle = FontStyle.Normal;
            tm.characterSize = size / 64f * 10f;
            tm.anchor = TextAnchor.MiddleCenter;
            tm.alignment = TextAlignment.Center;
            tm.color = color;
            var mr = go.GetComponent<MeshRenderer>();
            mr.sharedMaterial = Font.material;
            mr.sortingOrder = order;
            return tm;
        }

        public static OutlinedText Outlined(Transform parent, string text, Vector2 position, float size, Color color, int order) =>
            OutlinedText.Create(parent, text, position, size, color, Hex("#3b2414"), order);
    }

    // Outlined text (4 dark copies offset around the main text) so it stays readable on busy backgrounds
    public class OutlinedText : MonoBehaviour
    {
        TextMesh _main;
        readonly TextMesh[] _outline = new TextMesh[4];

        public static OutlinedText Create(Transform parent, string text, Vector2 position, float size, Color color, Color outlineColor, int order)
        {
            var go = new GameObject("OutlinedText");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = position;
            var n = go.AddComponent<OutlinedText>();
            float d = size * 0.07f;
            var offsets = new[] { new Vector2(-d, 0), new Vector2(d, 0), new Vector2(0, -d), new Vector2(0, d) };
            for (int i = 0; i < 4; i++) n._outline[i] = Draw.Text(go.transform, text, offsets[i], size, outlineColor, order);
            n._main = Draw.Text(go.transform, text, Vector2.zero, size, color, order + 1);
            return n;
        }

        public string Text
        {
            get => _main.text;
            set { if (_main.text == value) return; _main.text = value; foreach (var o in _outline) o.text = value; }
        }

        public Color Color { set => _main.color = value; }
    }
}
