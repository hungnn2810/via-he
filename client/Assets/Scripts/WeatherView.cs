// Draws the sky over the street from StreetState.gameMinute / dayPhase / weather:
// the sun and moon on their arcs, stars, drifting clouds, rain with splashes and puddles, lightning,
// lamp glow at the stalls by night and umbrellas over people in the rain. It never tints the street's colours.
// Shapes are built in code (soft circles, streaks); none of this has server state of its own.
using System;
using System.Collections.Generic;
using ViaHeOnline.Schema;
using UnityEngine;

namespace ViaHeOnline
{
    public class WeatherView : MonoBehaviour
    {
        // Sky bodies and clouds sit on the painted backdrop, behind all scenery
        const int SkyOrder = -986;
        const int CloudOrder = -982;
        const int PuddleOrder = -930;
        const int LightningOrder = Depth.Rain - 10;
        const int LampOrder = Depth.Traffic + 50;  // in front of street objects and traffic

        const int MaxDrops = 170;
        const int MaxClouds = 10;
        const int StarCount = 45;
        const int PuddleCount = 8;

        static readonly Color[] UmbrellaColors =
        {
            new Color(0.85f, 0.2f, 0.2f), new Color(0.2f, 0.45f, 0.85f), new Color(0.95f, 0.75f, 0.15f),
            new Color(0.25f, 0.65f, 0.35f), new Color(0.6f, 0.3f, 0.7f), new Color(0.15f, 0.15f, 0.2f),
        };

        // Clouds wanted on screen, and their colour, per weather
        static readonly Dictionary<string, (int Count, Color Tone)> CloudCover = new Dictionary<string, (int, Color)>
        {
            ["sunny"] = (3, new Color(1f, 1f, 1f, 0.9f)),
            ["hot"] = (1, new Color(1f, 1f, 0.97f, 0.8f)),
            ["cloudy"] = (8, new Color(0.86f, 0.88f, 0.9f, 0.95f)),
            ["rain"] = (10, new Color(0.45f, 0.48f, 0.55f, 0.97f)),
        };

        class Drop { public Transform T; public SpriteRenderer Sr; public float LandY; public float Speed; }
        class Splash { public Transform T; public SpriteRenderer Sr; public float Age = 1f; }
        class Cloud { public Transform T; public SpriteRenderer[] Puffs; public float Speed; public float Alpha; public float Y; }
        class Star { public SpriteRenderer Sr; public Vector2 Offset; public float Phase; }

        Camera _cam;
        float _wallBaseY, _viewBottom, _stallY;
        Func<string, string> _productName;

        // From the state
        string _weather = "", _phase = "", _weatherName = "", _phaseName = "", _boost = "";
        float _hour = 12f;
        bool _hasClock;
        readonly List<float> _stallXs = new List<float>();
        float _length = 20f;

        // Built once
        SpriteRenderer _flash, _sunCore, _sunGlow, _sunHalo, _moon, _moonGlow;
        readonly List<Drop> _drops = new List<Drop>();
        readonly List<Splash> _splashes = new List<Splash>();
        readonly List<Cloud> _clouds = new List<Cloud>();
        readonly List<Star> _stars = new List<Star>();
        readonly List<SpriteRenderer> _puddles = new List<SpriteRenderer>();
        readonly List<(SpriteRenderer Glow, SpriteRenderer Bulb)> _lamps = new List<(SpriteRenderer, SpriteRenderer)>();
        readonly Dictionary<Character, Transform> _umbrellas = new Dictionary<Character, Transform>();

        // Animated values
        float _rain, _wet, _night, _flashAlpha, _nextFlash, _umbrellaScan;
        int _splashCursor;
        bool _synced;

        static Sprite _glow, _canopy;

        public void Init(Camera cam, float wallBaseY, float viewBottom, float stallY, Func<string, string> productName)
        {
            _cam = cam;
            _wallBaseY = wallBaseY;
            _viewBottom = viewBottom;
            _stallY = stallY;
            _productName = productName;
            if (!_flash) Build();
        }

        public void Sync(StreetState st, float length)
        {
            if (st == null) return;
            _length = length;
            _hasClock = !string.IsNullOrEmpty(st.dayPhase);
            _hour = st.gameMinute / 60f;

            string weather = st.weather ?? "";
            // An admin "rain" event still makes it rain
            if (!string.IsNullOrEmpty(st.@event) && st.@event.Contains("rain")) weather = "rain";
            AnnounceChanges(weather, st);
            _weather = weather;
            _phase = st.dayPhase ?? "";
            _weatherName = st.weatherName ?? "";
            _phaseName = st.dayPhaseName ?? "";
            _boost = st.skyBoost ?? "";

            _stallXs.Clear();
            if (st.stalls != null)
                foreach (var kv in st.stalls)
                    if (int.TryParse(kv.Key, out int slot)) _stallXs.Add(StreetScene.SlotX(slot, st));
            PlacePuddles();
        }

        // ---------- Toasts ----------

        void AnnounceChanges(string weather, StreetState st)
        {
            if (!_synced) { _synced = true; return; }
            bool weatherChanged = weather != _weather && !string.IsNullOrEmpty(weather);
            bool phaseChanged = st.dayPhase != _phase && !string.IsNullOrEmpty(st.dayPhase);
            if (!weatherChanged && !phaseChanged) return;

            string head = weatherChanged && phaseChanged ? $"{st.dayPhaseName} · {st.weatherName}"
                : weatherChanged ? WeatherHeadline(weather, st.weatherName)
                : $"Trời đã {st.dayPhaseName.ToLowerInvariant()}";
            string crave = CraveText(st.skyBoost);
            UiToast.Show(string.IsNullOrEmpty(crave) ? head : $"{head}. Khách đang thèm: {crave}", Theme.ToastTone.Info);
        }

        static string WeatherHeadline(string weather, string name) => weather switch
        {
            "rain" => "Trời đổ mưa! Vườn được tưới, khách thưa hơn",
            "hot" => "Nắng gắt chang chang!",
            "cloudy" => "Trời kéo mây râm mát",
            _ => $"{name}!",
        };

        string CraveText(string boost)
        {
            if (string.IsNullOrEmpty(boost)) return "";
            var names = new List<string>();
            foreach (var id in boost.Split(','))
            {
                var n = _productName?.Invoke(id);
                if (!string.IsNullOrEmpty(n)) names.Add(n);
                if (names.Count == 4) break;
            }
            return string.Join(", ", names);
        }

        // ---------- Build ----------

        void Build()
        {
            _flash = Block("Lightning", Draw.Square, LightningOrder);

            _sunHalo = Block("SunHalo", Glow, SkyOrder);
            _sunGlow = Block("SunGlow", Glow, SkyOrder + 1);
            _sunCore = Block("Sun", Draw.Circle, SkyOrder + 2);
            _moonGlow = Block("MoonGlow", Glow, SkyOrder);
            _moon = Block("Moon", Draw.Circle, SkyOrder + 2);

            for (int i = 0; i < StarCount; i++)
            {
                var sr = Block("Star", Draw.Square, SkyOrder - 1);
                float s = UnityEngine.Random.Range(0.03f, 0.07f);
                sr.transform.localScale = new Vector3(s, s, 1f);
                _stars.Add(new Star { Sr = sr, Offset = new Vector2(UnityEngine.Random.value, UnityEngine.Random.value), Phase = UnityEngine.Random.value * 6.28f });
            }

            for (int i = 0; i < MaxClouds; i++)
            {
                var root = new GameObject("Cloud").transform;
                root.SetParent(transform, false);
                int n = UnityEngine.Random.Range(4, 7);
                var puffs = new SpriteRenderer[n];
                float width = UnityEngine.Random.Range(1.8f, 3.4f);
                for (int p = 0; p < n; p++)
                {
                    var sr = Draw.Block(root, "Puff", Draw.Circle, Color.clear,
                        new Vector2((p / (float)(n - 1) - 0.5f) * width, UnityEngine.Random.Range(-0.05f, 0.25f) * (p % 2 == 0 ? 1f : 0.6f)),
                        Vector2.one * UnityEngine.Random.Range(0.8f, 1.4f), CloudOrder + (p % 2));
                    puffs[p] = sr;
                }
                _clouds.Add(new Cloud { T = root, Puffs = puffs, Speed = UnityEngine.Random.Range(0.12f, 0.35f), Y = UnityEngine.Random.Range(0.6f, 3.2f) });
                root.position = new Vector3(UnityEngine.Random.Range(-4f, _length + 4f), 0f, 0f);
            }

            for (int i = 0; i < MaxDrops; i++)
            {
                var sr = Block("Drop", Draw.Square, Depth.Rain);
                sr.transform.localScale = new Vector3(0.025f, 0.45f, 1f);
                sr.transform.rotation = Quaternion.Euler(0f, 0f, -12f);
                sr.enabled = false;
                _drops.Add(new Drop { T = sr.transform, Sr = sr });
            }
            for (int i = 0; i < 50; i++)
            {
                var sr = Block("Splash", Draw.Circle, PuddleOrder + 1);
                sr.enabled = false;
                _splashes.Add(new Splash { T = sr.transform, Sr = sr });
            }
            for (int i = 0; i < PuddleCount; i++) _puddles.Add(Block("Puddle", Draw.Circle, PuddleOrder));
        }

        SpriteRenderer Block(string name, Sprite sprite, int order) =>
            Draw.Block(transform, name, sprite, Color.clear, Vector2.zero, Vector2.one, order);

        void PlacePuddles()
        {
            for (int i = 0; i < _puddles.Count; i++)
            {
                // Spread along the street, alternating sidewalk and road
                float x = (i + 0.5f) / _puddles.Count * _length + Mathf.Sin(i * 7.1f) * 0.8f;
                float y = i % 2 == 0 ? _wallBaseY - 2.6f - (i % 3) * 0.3f : _viewBottom + 0.6f + (i % 3) * 0.25f;
                _puddles[i].transform.position = new Vector3(x, y, 0f);
                _puddles[i].transform.localScale = new Vector3(1.4f + (i % 3) * 0.5f, 0.22f + (i % 2) * 0.06f, 1f);
            }
        }

        // Soft round light: alpha falls off with the square of the distance
        static Sprite Glow
        {
            get
            {
                if (_glow) return _glow;
                const int n = 64;
                var t = new Texture2D(n, n) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
                for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(n / 2f, n / 2f)) / (n / 2f);
                    float a = Mathf.Clamp01(1f - d);
                    t.SetPixel(x, y, new Color(1, 1, 1, a * a));
                }
                t.Apply();
                return _glow = Sprite.Create(t, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), n);
            }
        }

        // Umbrella canopy: a half disc with a scalloped hem, pivot at the bottom centre, 1 unit wide
        static Sprite Canopy
        {
            get
            {
                if (_canopy) return _canopy;
                const int w = 64, h = 32;
                var t = new Texture2D(w, h) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
                for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    float dx = (x + 0.5f - w / 2f) / (w / 2f), dy = (y + 0.5f) / h;
                    bool dome = dx * dx + dy * dy <= 1f;
                    float hem = 0.12f * Mathf.Abs(Mathf.Sin((dx + 1f) * Mathf.PI * 2f)); // four scallops
                    float shade = 0.82f + 0.18f * Mathf.Abs(Mathf.Sin((dx + 1f) * Mathf.PI * 2f)); // ribs
                    t.SetPixel(x, y, dome && dy >= hem ? new Color(shade, shade, shade, 1f) : Color.clear);
                }
                t.Apply();
                return _canopy = Sprite.Create(t, new Rect(0, 0, w, h), new Vector2(0.5f, 0f), w);
            }
        }

        // ---------- Frame ----------

        void Update()
        {
            if (!_cam || !_flash) return;
            float dt = Time.deltaTime;
            bool raining = _weather == "rain";
            _rain = Mathf.MoveTowards(_rain, raining ? 1f : 0f, dt / 4f);
            _wet = Mathf.MoveTowards(_wet, raining ? 1f : 0f, dt / (raining ? 25f : 90f));
            _night = Mathf.MoveTowards(_night, _hasClock ? NightAt(_hour) : 0f, dt / 3f);

            float camH = _cam.orthographicSize, camW = camH * _cam.aspect;
            var c = _cam.transform.position;
            float top = c.y + camH, left = c.x - camW;

            PlaceFlash(c, camW, camH);
            UpdateSunAndMoon(left, top, camW);
            UpdateStars(left, top, camW, dt);
            UpdateClouds(dt, left, top, camW);
            UpdateRain(dt, left, top, camW);
            UpdateGround(c, camW);
            UpdateLightning(dt, c, camW, camH, raining);
            UpdateLamps();
            UpdateUmbrellas(dt);
        }

        static float NightAt(float h)
        {
            if (h >= 19.5f || h < 4.5f) return 1f;
            if (h >= 17.5f) return Mathf.InverseLerp(17.5f, 19.5f, h);
            if (h < 6.5f) return Mathf.InverseLerp(6.5f, 4.5f, h);
            return 0f;
        }


        void PlaceFlash(Vector3 c, float camW, float camH)
        {
            _flash.transform.position = new Vector3(c.x, c.y, 0f);
            _flash.transform.localScale = new Vector3(camW * 2f + 1f, camH * 2f + 1f, 1f);
        }

        void UpdateSunAndMoon(float left, float top, float camW)
        {
            float cover = _weather == "rain" ? 0f : _weather == "cloudy" ? 0.35f : 1f;
            bool hot = _weather == "hot";

            // Sun: rises at 6, sets at 18
            float sunT = Mathf.InverseLerp(5.5f, 18.5f, _hour);
            bool sunUp = _hasClock && _hour > 5.5f && _hour < 18.5f;
            var sunPos = Arc(sunT, left, top, camW);
            float sunA = sunUp ? cover * Mathf.Clamp01(Mathf.Min(sunT, 1f - sunT) * 8f) : 0f;
            var sunTone = Color.Lerp(new Color(1f, 0.55f, 0.25f), new Color(1f, 0.95f, 0.7f), Mathf.Clamp01(Mathf.Min(sunT, 1f - sunT) * 4f));
            float pulse = hot ? 1f + 0.08f * Mathf.Sin(Time.time * 2.2f) : 1f;
            Place(_sunCore, sunPos, 0.9f, sunTone, sunA);
            Place(_sunGlow, sunPos, (hot ? 3.2f : 2.4f) * pulse, sunTone, sunA * (hot ? 0.7f : 0.5f));
            Place(_sunHalo, sunPos, (hot ? 7f : 5f) * pulse, sunTone, sunA * (hot ? 0.35f : 0.18f));

            // Moon: rises at 18, sets at 5
            float moonHour = _hour < 12f ? _hour + 24f : _hour;
            float moonT = Mathf.InverseLerp(18f, 29f, moonHour);
            bool moonUp = _hasClock && moonHour > 18f && moonHour < 29f;
            float moonA = moonUp ? (_weather == "rain" ? 0f : _weather == "cloudy" ? 0.3f : 1f) * _night : 0f;
            var moonPos = Arc(moonT, left, top, camW);
            Place(_moon, moonPos, 0.7f, new Color(0.97f, 0.96f, 0.85f), moonA);
            Place(_moonGlow, moonPos, 2.6f, new Color(0.8f, 0.85f, 1f), moonA * 0.35f);
        }

        // A body crosses the sky left to right, highest in the middle
        static Vector2 Arc(float t, float left, float top, float camW) =>
            new Vector2(left + 1f + t * (camW * 2f - 2f), top - 3.2f + Mathf.Sin(Mathf.Clamp01(t) * Mathf.PI) * 2.3f);

        void UpdateStars(float left, float top, float camW, float dt)
        {
            float clear = _weather == "rain" ? 0f : _weather == "cloudy" ? 0.25f : 1f;
            foreach (var s in _stars)
            {
                s.Phase += dt * 1.7f;
                float a = _night * clear * (0.45f + 0.45f * Mathf.Sin(s.Phase));
                s.Sr.transform.position = new Vector3(left + s.Offset.x * camW * 2f, top - 0.2f - s.Offset.y * 3.2f, 0f);
                s.Sr.color = new Color(1f, 1f, 0.9f, a);
            }
        }

        void UpdateClouds(float dt, float left, float top, float camW)
        {
            var (count, tone) = CloudCover.TryGetValue(_weather, out var cc) ? cc : (2, new Color(1f, 1f, 1f, 0.9f));
            // Clouds darken with the night
            tone = Color.Lerp(tone, new Color(tone.r * 0.35f, tone.g * 0.38f, tone.b * 0.5f, tone.a), _night * 0.8f);
            float wind = _weather == "rain" ? 2.2f : 1f;
            float right = left + camW * 2f;
            for (int i = 0; i < _clouds.Count; i++)
            {
                var cl = _clouds[i];
                cl.Alpha = Mathf.MoveTowards(cl.Alpha, i < count ? 1f : 0f, dt / 6f);
                var p = cl.T.position;
                p.x += cl.Speed * wind * dt;
                if (p.x > right + 3f) p.x = left - 3f;
                if (p.x < left - 3.5f) p.x = right + 2.5f;
                p.y = top - cl.Y;
                cl.T.position = p;
                foreach (var puff in cl.Puffs) puff.color = new Color(tone.r, tone.g, tone.b, tone.a * cl.Alpha);
            }
        }

        void UpdateRain(float dt, float left, float top, float camW)
        {
            int active = Mathf.RoundToInt(MaxDrops * _rain);
            for (int i = 0; i < _drops.Count; i++)
            {
                var d = _drops[i];
                // Drops past the active count finish their fall, then stay off until the rain picks up again
                if (!d.Sr.enabled)
                {
                    if (i >= active) continue;
                    Respawn(d, left, top, camW, true);
                    d.Sr.enabled = true;
                }
                var p = d.T.position;
                p += new Vector3(-0.22f, -1f, 0f) * d.Speed * dt;
                if (p.y <= d.LandY)
                {
                    SpawnSplash(new Vector2(p.x, d.LandY));
                    if (i >= active) { d.Sr.enabled = false; continue; }
                    Respawn(d, left, top, camW, false);
                    continue;
                }
                d.T.position = p;
            }

            foreach (var s in _splashes)
            {
                if (!s.Sr.enabled) continue;
                s.Age += dt / 0.28f;
                if (s.Age >= 1f) { s.Sr.enabled = false; continue; }
                s.T.localScale = new Vector3(0.08f + s.Age * 0.28f, 0.03f + s.Age * 0.06f, 1f);
                s.Sr.color = new Color(0.85f, 0.92f, 1f, 0.7f * (1f - s.Age));
            }
        }

        void Respawn(Drop d, float left, float top, float camW, bool anywhere)
        {
            d.Speed = UnityEngine.Random.Range(12f, 16f);
            // Drops land on the sidewalk or the road; the river wall above stops nothing, so they fall to the ground band
            d.LandY = UnityEngine.Random.Range(_viewBottom + 0.15f, _wallBaseY - 0.2f);
            float y = anywhere ? UnityEngine.Random.Range(d.LandY, top + 1f) : top + UnityEngine.Random.Range(0.2f, 2f);
            d.T.position = new Vector3(left + UnityEngine.Random.Range(-1f, camW * 2f + 3f), y, 0f);
            d.Sr.color = new Color(0.75f, 0.85f, 1f, UnityEngine.Random.Range(0.35f, 0.6f));
        }

        void SpawnSplash(Vector2 at)
        {
            var s = _splashes[_splashCursor];
            _splashCursor = (_splashCursor + 1) % _splashes.Count;
            s.Age = 0f;
            s.T.position = new Vector3(at.x, at.y, 0f);
            s.Sr.sortingOrder = Depth.Of(at.y) - 1;
            s.Sr.enabled = true;
        }

        void UpdateGround(Vector3 c, float camW)
        {
            // Puddles grow while it rains and dry slowly after
            for (int i = 0; i < _puddles.Count; i++)
            {
                float shimmer = 0.85f + 0.15f * Mathf.Sin(Time.time * 1.3f + i);
                var tone = Color.Lerp(new Color(0.6f, 0.72f, 0.9f), new Color(0.95f, 0.8f, 0.5f), _night * 0.6f); // puddles catch lamp light
                _puddles[i].color = new Color(tone.r, tone.g, tone.b, 0.4f * _wet * shimmer);
            }
        }

        void UpdateLightning(float dt, Vector3 c, float camW, float camH, bool raining)
        {
            if (raining && _rain > 0.9f && Time.time >= _nextFlash)
            {
                _nextFlash = Time.time + UnityEngine.Random.Range(14f, 30f);
                _flashAlpha = 0.6f;
            }
            else if (!raining) _nextFlash = Mathf.Max(_nextFlash, Time.time + 6f);
            // Two quick flickers then fade
            _flashAlpha = Mathf.MoveTowards(_flashAlpha, 0f, dt * 1.6f);
            float flicker = _flashAlpha > 0.4f && _flashAlpha < 0.5f ? 0.2f : 1f;
            _flash.color = new Color(0.92f, 0.95f, 1f, _flashAlpha * flicker);
        }

        void UpdateLamps()
        {
            while (_lamps.Count < _stallXs.Count)
                _lamps.Add((Block("LampGlow", Glow, LampOrder), Block("LampBulb", Glow, LampOrder + 1)));
            for (int i = 0; i < _lamps.Count; i++)
            {
                var (glow, bulb) = _lamps[i];
                bool on = i < _stallXs.Count && _night > 0.01f;
                glow.enabled = bulb.enabled = on;
                if (!on) continue;
                float flicker = 0.93f + 0.07f * Mathf.Sin(Time.time * 9f + i * 2.3f);
                var at = new Vector2(_stallXs[i], _stallY + 1.15f);
                Place(glow, at, 3.4f, new Color(1f, 0.78f, 0.4f), 0.32f * _night * flicker);
                Place(bulb, at + new Vector2(0f, 0.15f), 0.45f, new Color(1f, 0.95f, 0.75f), 0.9f * _night);
            }
        }

        // People out in the rain open an umbrella; sellers already stand under their stall parasol
        void UpdateUmbrellas(float dt)
        {
            _umbrellaScan -= dt;
            if (_umbrellaScan <= 0f)
            {
                _umbrellaScan = 0.5f;
                foreach (var ch in FindObjectsByType<Character>())
                {
                    if (!ch.SortByDepth || _umbrellas.ContainsKey(ch)) continue;
                    _umbrellas[ch] = MakeUmbrella(ch);
                }
                var gone = new List<Character>();
                foreach (var kv in _umbrellas) if (!kv.Key) gone.Add(kv.Key);
                foreach (var g in gone) _umbrellas.Remove(g);
            }
            bool open = _weather == "rain";
            foreach (var kv in _umbrellas)
            {
                var t = kv.Value;
                if (!t) continue;
                float s = Mathf.MoveTowards(t.localScale.x, open ? 1f : 0f, dt * 3f);
                t.localScale = new Vector3(s, s, 1f);
                bool show = s > 0.01f;
                if (t.gameObject.activeSelf != show) t.gameObject.SetActive(show);
            }
        }

        Transform MakeUmbrella(Character ch)
        {
            var root = new GameObject("Umbrella").transform;
            root.SetParent(ch.transform, false);
            root.localPosition = new Vector3(0.18f, 0.8f, 0f);   // in the hand; the canopy opens above the head (frame is 1.28 tall)
            root.localScale = new Vector3(0f, 0f, 1f);
            var tone = UmbrellaColors[_umbrellas.Count % UmbrellaColors.Length];
            Draw.Block(root, "Handle", Draw.Square, new Color(0.25f, 0.2f, 0.15f), new Vector2(0f, 0.45f), new Vector2(0.035f, 0.9f), Depth.LayerAccessory + 1);
            var canopy = Draw.Block(root, "Canopy", Canopy, tone, new Vector2(0f, 0.86f), new Vector2(1.15f, 1.15f), Depth.LayerAccessory + 2);
            canopy.transform.localRotation = Quaternion.Euler(0f, 0f, 6f);
            root.gameObject.SetActive(false);
            return root;
        }

        // ---------- Helpers ----------

        static void Place(SpriteRenderer sr, Vector2 at, float size, Color tone, float alpha)
        {
            sr.enabled = alpha > 0.005f;
            if (!sr.enabled) return;
            sr.transform.position = new Vector3(at.x, at.y, 0f);
            sr.transform.localScale = new Vector3(size, size, 1f);
            sr.color = new Color(tone.r, tone.g, tone.b, alpha);
        }

    }
}
