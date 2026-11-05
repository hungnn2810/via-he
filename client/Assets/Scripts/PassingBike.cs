// A motorbike riding along the road: the wheels spin, the bike bounces over the road and the exhaust puffs.
// Client-side decoration only. Wheel positions come from Resources/Sprites/street_wheels.txt (client/Tools/cut_street.py).
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace ViaHeOnline
{
    public class PassingBike : MonoBehaviour
    {
        const float SpinPerUnit = 220f;     // wheel degrees per unit travelled
        const float Bounce = 0.012f, Pitch = 0.5f, PuffSeconds = 0.22f;
        const float SpokeRadius = 68f;      // wheel_spin pixels that match a wheel radius; keeps the spokes inside the tyre

        static Dictionary<string, List<Vector3>> _wheels;

        readonly List<Transform> _spins = new List<Transform>();
        Vector3 _start;
        float _speed, _phase, _nextPuff, _halfWidth;

        public static PassingBike Create(Transform parent, string sprite, Vector2 position, float scale, int order, float speed)
        {
            var sr = Draw.Put(parent, sprite, position, scale, order);
            // A negative scale mirrors the wheels too, which flipX would not
            sr.transform.localScale = new Vector3(speed > 0 ? scale : -scale, scale, 1);
            var bike = sr.gameObject.AddComponent<PassingBike>();
            bike._start = sr.transform.position;
            bike._speed = speed;
            bike._phase = Random.Range(0f, 6f);
            bike._halfWidth = sr.bounds.size.x / 2f;
            foreach (var wheel in Wheels(sprite))
            {
                var spin = Draw.Put(sr.transform, "wheel_spin", new Vector2(wheel.x, wheel.y) / SpriteLibrary.PPU, 1, order + 1);
                float size = wheel.z / SpokeRadius;
                spin.transform.localScale = new Vector3(size, size, 1);
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
                if (!list) Debug.LogError("Missing Resources/Sprites/street_wheels.txt");
                else foreach (var line in list.text.Split('\n'))
                {
                    var c = line.Trim().Split(',');
                    if (c.Length < 4) continue;
                    var wheels = new List<Vector3>();
                    for (int i = 1; i + 2 < c.Length; i += 3) wheels.Add(new Vector3(Num(c[i]), Num(c[i + 1]), Num(c[i + 2])));
                    _wheels[c[0]] = wheels;
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
            transform.rotation = Quaternion.Euler(0, 0, Mathf.Sin(t * 0.7f) * Pitch);
            foreach (var spin in _spins) spin.Rotate(0, 0, -Mathf.Abs(step) * SpinPerUnit);

            if (Time.time > _nextPuff)
            {
                _nextPuff = Time.time + PuffSeconds;
                float behind = _speed > 0 ? -_halfWidth : _halfWidth;
                ExhaustPuff.Create(transform.parent, _start + new Vector3(behind, 0.22f, 0), Mathf.Sign(_speed));
            }
        }
    }

    // A small grey cloud that grows, drifts backwards and fades
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
            puff._sprite.sortingOrder = 1299;
            puff._direction = -bikeDirection;
        }

        void Update()
        {
            _age += Time.deltaTime;
            float t = _age / Life;
            if (t >= 1) { Destroy(gameObject); return; }
            transform.position += new Vector3(_direction * 0.5f, 0.25f, 0) * Time.deltaTime;
            transform.localScale = Vector3.one * Mathf.Lerp(0.08f, 0.3f, t);
            _sprite.color = new Color(0.75f, 0.75f, 0.75f, 0.5f * (1 - t));
        }
    }
}
