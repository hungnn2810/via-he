// A character on the street: NPCs are one sprite cut from the street art,
// players are layers stacked from the character creator.
// Manages walking animation, shadow, speech bubbles, tags, and layer order.
// See docs/client/world.md.
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class Character : MonoBehaviour
    {
        static readonly string[] Looks = { "npc_worker", "npc_farmer", "npc_firefighter", "npc_tattooed_man", "npc_broker", "npc_cap_man", "npc_girl" };
        const float SpriteScale = 1.1f;
        const float WalkRock = 2f;
        const float Breath = 0.012f;

        Transform _body;
        SortingGroup _group;
        public bool SortByDepth = true;
        SpriteRenderer _sprite;
        readonly List<GameObject> _layers = new List<GameObject>();
        string _appearance = "", _vehicleName = "";
        SpriteRenderer _vehicle;
        string _look = Looks[0];
        int _step;
        float _happyUntil, _surprisedUntil;
        OutlinedText _name;
        SpriteRenderer _bubbleBg, _subLabelBg;
        TextMesh _bubble, _subLabel;
        float _bob, _facing = 1f, _breathPhase;

        public Vector3 Target;
        public bool IsWalking => Mathf.Abs(Target.x - transform.position.x) > 0.02f;

        public static string LookFor(int seed) => Looks[Mathf.Abs(seed) % Looks.Length];

        public static Character Create(Transform parent, string name, int order, float scale = 1f)
        {
            var go = new GameObject("Character " + name);
            go.transform.SetParent(parent, false);
            go.transform.localScale = Vector3.one * scale;
            var c = go.AddComponent<Character>();
            c._group = go.AddComponent<SortingGroup>();
            c._group.sortingOrder = order;

            var t = go.transform;
            var shadow = Draw.Put(t, "shadow", Vector2.zero, 0.9f, Depth.LayerShadow);
            if (shadow) shadow.color = new Color(1f, 1f, 1f, 0.9f);

            c._body = new GameObject("Body").transform;
            c._body.SetParent(t, false);
            c._sprite = Draw.Put(c._body, Looks[0], Vector2.zero, 1f, Depth.LayerBody);
            c._breathPhase = Random.Range(0f, 6f);

            c._name = Draw.Outlined(t, name, new Vector2(0f, 1.88f), 0.17f, Color.white, Depth.LayerName);
            c._subLabelBg = Draw.Sized(t, "ui_tag", new Vector2(0f, 1.88f), new Vector2(1.2f, 0.28f), Depth.LayerName, SpriteDrawMode.Sliced);
            c._subLabel = Draw.Text(t, "", new Vector2(0f, 1.88f), 0.15f, Theme.Gold, Depth.LayerName + 1);
            c._bubbleBg = Draw.Sized(t, "ui_speech_bubble", new Vector2(0f, 2.05f), new Vector2(1.5f, 0.6f), Depth.Bubble, SpriteDrawMode.Sliced);
            c._bubble = Draw.Text(t, "", new Vector2(0f, 2.33f), 0.17f, Theme.TextDark, Depth.BubbleText);
            c.Say("");
            c.SetSubLabel("");
            return c;
        }

        public void SetName(string name, Color color)
        {
            if (_name)
            {
                _name.gameObject.SetActive(!string.IsNullOrEmpty(name));
                _name.Text = name;
                _name.Color = color;
            }
        }

        public void SetLook(int seed)
        {
            _look = LookFor(seed);
            SetStep(_step, true);
        }

        public void SetLookNamed(string sprite)
        {
            _look = sprite;
            SetStep(_step, true);
        }

        public void SetVehicle(string vehicle)
        {
            if (vehicle == _vehicleName) return;
            _vehicleName = vehicle;
            if (_vehicle) Destroy(_vehicle.gameObject);
            if (!string.IsNullOrEmpty(vehicle) && SpriteLibrary.Has("vehicle_" + vehicle))
            {
                _vehicle = Draw.Put(_body, "vehicle_" + vehicle, Vector2.zero, 1f, Depth.LayerVehicle);
            }
        }

        /// Sprites of an appearance string "gender,hair,brows,lips,cheeks,earrings":
        /// body, then layers with their draw order relative to body.
        /// See docs/client/world.md section: Character composition.
        public static (string body, List<(string sprite, int order)> layers) Parts(string look, string outfit)
        {
            var c = (look ?? "").Split(',');
            var layers = new List<(string, int)>();
            void Add(string sprite, int order) { if (SpriteLibrary.Has(sprite)) layers.Add((sprite, order)); }

            if (c.Length >= 6)
            {
                string gender = c[0];
                string hair = c[1];
                string brows = c[2];
                string lips = c[3];
                string cheeks = c[4];
                string earrings = c[5];

                Add($"hairback_{gender}_{hair}", Depth.LayerHairBack);
                if (earrings != "0") Add($"earrings_{earrings}", Depth.LayerEarrings);
                if (cheeks != "0") Add($"cheeks_{cheeks}", Depth.LayerCheeks);
                Add($"brows_{brows}", Depth.LayerBrows);
                Add($"lips_{lips}", Depth.LayerLips);
                Add($"hair_{gender}_{hair}", Depth.LayerHair);
            }

            // outfit is "hat,shirt,pants,acc"
            var worn = (outfit ?? "").Split(',');
            if (worn.Length > 0 && !string.IsNullOrEmpty(worn[0])) Add("wear_" + worn[0], Depth.LayerHat);
            if (worn.Length > 1 && !string.IsNullOrEmpty(worn[1])) Add("wear_" + worn[1], Depth.LayerShirt);
            if (worn.Length > 2 && !string.IsNullOrEmpty(worn[2])) Add("wear_" + worn[2], Depth.LayerPants);
            if (worn.Length > 3 && !string.IsNullOrEmpty(worn[3])) Add("wear_" + worn[3], Depth.LayerAccessory);

            string body = c.Length > 0 && !string.IsNullOrEmpty(c[0]) ? $"body_{c[0]}" : Looks[0];
            return (body, layers);
        }

        public void SetAppearance(string look, string outfit = "")
        {
            if (string.IsNullOrEmpty(look) || look + outfit == _appearance) return;
            _appearance = look + outfit;
            foreach (var layer in _layers) if (layer) Destroy(layer);
            _layers.Clear();

            var (body, layers) = Parts(look, outfit);
            foreach (var (sprite, order) in layers)
            {
                var sr = Draw.Put(_body, sprite, Vector2.zero, 1f, order);
                if (sr) _layers.Add(sr.gameObject);
            }
            SetLookNamed(body);
        }

        public static void FillPortrait(RectTransform parent, string look, string outfit = "")
        {
            foreach (Transform child in parent) Destroy(child.gameObject);
            var (body, layers) = Parts(look, outfit);
            var names = new List<(string sprite, int order)>(layers) { (body, Depth.LayerBody) };
            names.Sort((a, b) => a.order.CompareTo(b.order));
            foreach (var (sprite, _) in names)
            {
                var img = Ui.Img(parent, sprite, sprite);
                if (img) Ui.Stretch(img.rectTransform);
            }
        }

        void SetStep(int step, bool force = false)
        {
            if (step == _step && !force) return;
            _step = step;
            if (_sprite) _sprite.sprite = SpriteLibrary.Get(step > 0 ? $"{_look}_step{step}" : _look);
        }

        public void Cheer(float seconds = 1.2f) => _happyUntil = Time.time + seconds;

        public void Surprise(float seconds = 1f) => _surprisedUntil = Time.time + seconds;

        float _sayUntil;

        public void Say(string text, float duration = 0)
        {
            bool show = !string.IsNullOrEmpty(text);
            if (_bubble) _bubble.gameObject.SetActive(show);
            if (_bubbleBg) _bubbleBg.gameObject.SetActive(show);
            if (!show) return;
            _sayUntil = duration > 0 ? Time.time + duration : 0;
            if (_bubble.text == text) return;
            _bubble.text = text;
            _bubbleBg.size = new Vector2(Mathf.Clamp(text.Length * 0.095f + 0.35f, 0.7f, 5f), 0.62f);
        }

        public void SetSubLabel(string text)
        {
            bool show = !string.IsNullOrEmpty(text);
            if (_subLabel) _subLabel.gameObject.SetActive(show);
            if (_subLabelBg) _subLabelBg.gameObject.SetActive(show);
            if (show && _subLabel && _subLabel.text != text)
            {
                _subLabel.text = text;
                _subLabelBg.size = new Vector2(text.Length * 0.085f + 0.25f, 0.28f);
            }
            if (show && _name) _name.gameObject.SetActive(false);
        }

        void Update()
        {
            if (_sayUntil > 0 && Time.time > _sayUntil)
            {
                _sayUntil = 0;
                Say("");
            }

            var p = transform.position;
            var next = Vector3.Lerp(p, Target, 1f - Mathf.Exp(-10f * Time.deltaTime));
            if (Mathf.Abs(next.x - p.x) > 0.0005f) _facing = Mathf.Sign(next.x - p.x);
            transform.position = next;

            bool walking = IsWalking;
            _bob = walking ? _bob + Time.deltaTime * 11f : 0;
            SetStep(walking ? new[] { 1, 0, 2, 0 }[(int)(_bob / (Mathf.PI / 2f)) % 4] : 0);

            float hop = Time.time < _happyUntil ? Mathf.Abs(Mathf.Sin((_happyUntil - Time.time) * 12f)) * 0.12f : 0f;
            if (_body)
            {
                _body.localPosition = new Vector3(0f, Mathf.Abs(Mathf.Sin(_bob)) * 0.05f + hop, 0f);
                _body.localRotation = Quaternion.Euler(0f, 0f, Mathf.Sin(_bob) * WalkRock);

                float stretch = Time.time < _surprisedUntil ? 1f + Mathf.Abs(Mathf.Sin((_surprisedUntil - Time.time) * 10f)) * 0.08f : 1f;
                if (!walking) stretch += Mathf.Sin(Time.time * 2f + _breathPhase) * Breath;
                _body.localScale = new Vector3(_facing * SpriteScale, SpriteScale * stretch, 1f);
            }

            if (SortByDepth && _group) _group.sortingOrder = Depth.Of(next.y);
        }
    }
}
