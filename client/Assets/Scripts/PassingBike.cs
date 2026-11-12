// Motorbikes riding along the road: spinning wheels, road bounce, and exhaust puffs.
// Client-side decoration only. Wheel positions come from Resources/Sprites/street_wheels.txt.
// See docs/client/world.md.
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace ViaHeOnline
{
    public class PassingBike : MonoBehaviour
    {
        const float SpinPerUnit = 220f;
        const float Bounce = 0.012f;
        const float Pitch = 0.5f;
        const float PuffSeconds = 0.22f;
        const float SpokeRadius = 68f;

        static readonly string[] VendorShouts =
        {
            "Ai bánh mì Sài Gòn đặc ruột thơm bơ nào...",
            "Bắp xào bơ, bắp luộc ngô nướng nóng hổi đê!",
            "Tào phớ đây, nước đường hoa bưởi thanh mát!",
            "Ve chai đồng nát bán đê...",
            "Giao hàng nhanh đây cô bác ơi!",
            "Tránh đường em ship đơn hỏa tốc nào!"
        };

        static Dictionary<string, List<Vector3>> _wheels;

        readonly List<Transform> _spins = new List<Transform>();
        Vector3 _start;
        float _speed, _phase, _nextPuff, _halfWidth, _bubbleUntil;
        string _shout;
        GameObject _bubble;

        public static PassingBike Create(Transform parent, string sprite, Vector2 position, float scale, int order, float speed)
        {
            var sr = Draw.Put(parent, sprite, position, scale, order);
            sr.transform.localScale = new Vector3(speed > 0 ? scale : -scale, scale, 1f);
            var bike = sr.gameObject.AddComponent<PassingBike>();
            bike._start = sr.transform.position;
            bike._speed = speed;
            bike._phase = Random.Range(0f, 6f);
            bike._halfWidth = sr.bounds.size.x / 2f;
            if (Random.value < 0.45f) bike._shout = VendorShouts[Random.Range(0, VendorShouts.Length)];

            if (SpriteLibrary.Has("wheel_spin")) foreach (var wheel in Wheels(sprite))
            {
                var spin = Draw.Put(sr.transform, "wheel_spin", new Vector2(wheel.x, wheel.y) / SpriteLibrary.PPU, 1f, order + 1);
                float size = wheel.z / SpokeRadius;
                spin.transform.localScale = new Vector3(size, size, 1f);
                bike._spins.Add(spin.transform);
            }
            return bike;
        }

        static List<Vector3> Wheels(string sprite)
        {
            if (_wheels == null)
            {
                _wheels = new Dictionary<string, List<Vector3>>();
                var list = Resources.Load<TextAsset>("Sprites/street_wheels");
                if (list)
                {
                    foreach (var line in list.text.Split('\n'))
                    {
                        var c = line.Trim().Split(',');
                        if (c.Length < 4) continue;
                        var wheels = new List<Vector3>();
                        for (int i = 1; i + 2 < c.Length; i += 3)
                        {
                            wheels.Add(new Vector3(Num(c[i]), Num(c[i + 1]), Num(c[i + 2])));
                        }
                        _wheels[c[0]] = wheels;
                    }
                }
            }
            return _wheels.TryGetValue(sprite, out var found) ? found : new List<Vector3>();
        }

        static float Num(string s) => float.Parse(s, CultureInfo.InvariantCulture);

        void Update()
        {
            float step = _speed * Time.deltaTime;
            _start += Vector3.right * step;
            float t = Time.time * 16f + _phase;
            transform.position = _start + Vector3.up * Mathf.Abs(Mathf.Sin(t)) * Bounce;
            transform.rotation = Quaternion.Euler(0f, 0f, Mathf.Sin(t * 0.7f) * Pitch);
            foreach (var spin in _spins) spin.Rotate(0f, 0f, -Mathf.Abs(step) * SpinPerUnit);

            if (Time.time > _nextPuff)
            {
                _nextPuff = Time.time + PuffSeconds;
                float behind = _speed > 0 ? -_halfWidth : _halfWidth;
                ExhaustPuff.Create(transform.parent, _start + new Vector3(behind, 0.22f, 0f), Mathf.Sign(_speed));
            }

            if (!string.IsNullOrEmpty(_shout) && _bubble == null && _bubbleUntil == 0 && Camera.main)
            {
                if (Mathf.Abs(transform.position.x - Camera.main.transform.position.x) < 3.2f)
                {
                    ShowShout(_shout);
                    SoundFx.Horn();
                }
            }

            if (_bubble)
            {
                if (Time.time > _bubbleUntil)
                {
                    Destroy(_bubble);
                    _bubble = null;
                }
                else
                {
                    _bubble.transform.position = transform.position + Vector3.up * 1.55f;
                }
            }
        }

        void ShowShout(string line)
        {
            _bubble = new GameObject("BikeBubble");
            var t = _bubble.transform;
            t.SetParent(transform.parent, false);
            t.position = transform.position + Vector3.up * 1.55f;
            Draw.Sized(t, "ui_speech_bubble", Vector2.zero,
                new Vector2(Mathf.Clamp(line.Length * 0.095f + 0.35f, 0.7f, 5f), 0.62f), Depth.Bubble, SpriteDrawMode.Sliced);
            Draw.Text(t, line, new Vector2(0f, 0.28f), 0.17f, Theme.TextDark, Depth.BubbleText);
            _bubbleUntil = Time.time + 3.2f;
        }

        void OnDestroy()
        {
            if (_bubble) Destroy(_bubble);
        }
    }

    public class ExhaustPuff : MonoBehaviour
    {
        const float Life = 0.7f;
        SpriteRenderer _sprite;
        float _age, _direction;

        public static void Create(Transform parent, Vector3 position, float bikeDirection)
        {
            var go = new GameObject("ExhaustPuff");
            go.transform.SetParent(parent, false);
            go.transform.position = position;
            var puff = go.AddComponent<ExhaustPuff>();
            puff._sprite = go.AddComponent<SpriteRenderer>();
            puff._sprite.sprite = Draw.Circle;
            puff._sprite.sortingOrder = Depth.Traffic - 1;
            puff._direction = -bikeDirection;
        }

        void Update()
        {
            _age += Time.deltaTime;
            float t = _age / Life;
            if (t >= 1f) { Destroy(gameObject); return; }
            transform.position += new Vector3(_direction * 0.5f, 0.25f, 0f) * Time.deltaTime;
            transform.localScale = Vector3.one * Mathf.Lerp(0.08f, 0.3f, t);
            _sprite.color = new Color(0.75f, 0.75f, 0.75f, 0.5f * (1f - t));
        }
    }
}
