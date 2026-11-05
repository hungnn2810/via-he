// A character on the street: NPCs are one sprite cut from the street art (client/Tools/cut_street.py),
// players are layers from the character creator stacked on a body sprite.
// Has a shadow, an outlined name, a speech bubble and a sub-label ("Muốn: ...").
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class Character : MonoBehaviour
    {
        static readonly string[] Looks = { "npc_worker", "npc_farmer", "npc_firefighter", "npc_tattooed_man", "npc_broker", "npc_cap_man", "npc_girl" };
        const float SpriteScale = 1.1f;     // one scale for all, so they keep their heights from the street art
        const float WalkRock = 2f;          // degrees; the body rocks a little on each step
        const float Breath = 0.012f;        // how much the body swells while standing

        Transform _body; // the part that flips left/right and bobs while walking
        SortingGroup _group;
        public bool SortByDepth = true; // characters closer to the road (lower y) draw over those further in
        SpriteRenderer _sprite;
        readonly List<GameObject> _layers = new List<GameObject>();
        string _appearance = "", _vehicleName = "";
        SpriteRenderer _vehicle;
        string _look = Looks[0];
        int _step;                 // 0 standing, 1 / 2 the two walking poses
        float _happyUntil, _surprisedUntil;
        OutlinedText _name;
        SpriteRenderer _bubbleBg, _subLabelBg;
        TextMesh _bubble, _subLabel;
        float _bob, _facing = 1, _breathPhase;

        public Vector3 Target;
        public bool IsWalking => Mathf.Abs(Target.x - transform.position.x) > 0.02f;

        // A stable seed (player id) gives everyone the same look on every screen
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
            var shadow = Draw.Put(t, "shadow", Vector2.zero, 0.9f, order - 3);
            shadow.color = new Color(1, 1, 1, 0.9f);
            c._body = new GameObject("Body").transform;
            c._body.SetParent(t, false);
            c._sprite = Draw.Put(c._body, Looks[0], Vector2.zero, 1, order);
            c._breathPhase = Random.Range(0f, 6f);

            c._name = Draw.Outlined(t, name, new Vector2(0, 1.88f), 0.17f, Color.white, order + 20);
            c._subLabelBg = Draw.Sized(t, "ui_tag", new Vector2(0, 1.88f), new Vector2(1.2f, 0.28f), order + 20, SpriteDrawMode.Sliced);
            c._subLabel = Draw.Text(t, "", new Vector2(0, 1.88f), 0.15f, Draw.Hex("#ffe066"), order + 21);
            c._bubbleBg = Draw.Sized(t, "ui_speech_bubble", new Vector2(0, 2.05f), new Vector2(1.5f, 0.6f), order + 22, SpriteDrawMode.Sliced);
            c._bubble = Draw.Text(t, "", new Vector2(0, 2.33f), 0.17f, Draw.Hex("#3b2414"), order + 23);
            c.Say("");
            c.SetSubLabel("");
            return c;
        }

        public void SetName(string name, Color color)
        {
            _name.gameObject.SetActive(!string.IsNullOrEmpty(name));
            _name.Text = name;
            _name.Color = color;
        }

        public void SetLook(int seed)
        {
            _look = LookFor(seed);
            SetStep(_step, true);
        }

        // A vehicle stands under the character layers
        public void SetVehicle(string vehicle)
        {
            if (vehicle == _vehicleName) return;
            _vehicleName = vehicle;
            if (_vehicle) Destroy(_vehicle.gameObject);
            if (!string.IsNullOrEmpty(vehicle) && SpriteLibrary.Has("vehicle_" + vehicle))
                _vehicle = Draw.Put(_body, "vehicle_" + vehicle, Vector2.zero, 1, _sprite.sortingOrder - 2);
        }

        public void SetLookNamed(string sprite)
        {
            _look = sprite;
            SetStep(_step, true);
        }

        // Sprites of an appearance string "gender,hair,brows,lips,cheeks,earrings": the body, then layers with their draw order
        static (string body, List<(string sprite, int order)> layers) Parts(string look, string outfit)
        {
            var c = look.Split(',');
            var layers = new List<(string, int)>();
            void Add(string sprite, int order) { if (SpriteLibrary.Has(sprite)) layers.Add((sprite, order)); }
            Add($"hairback_{c[0]}_{c[1]}", -1);
            Add($"earrings_{c[5]}", 1);
            Add($"cheeks_{c[4]}", 2);
            Add($"brows_{c[2]}", 3);
            Add($"lips_{c[3]}", 4);
            Add($"hair_{c[0]}_{c[1]}", 5);
            // outfit is "hat,shirt,pants,acc"; pants go under the shirt and the hat sits on the hair
            var worn = (outfit ?? "").Split(',');
            int[] order = { 9, 7, 6, 10 };
            for (int i = 0; i < worn.Length && i < order.Length; i++) if (worn[i] != "") Add("wear_" + worn[i], order[i]);
            return ($"body_{c[0]}", layers);
        }

        // Player look from the character creator; does nothing for a player who has not made one yet
        public void SetAppearance(string look, string outfit = "")
        {
            if (string.IsNullOrEmpty(look) || look + outfit == _appearance) return;
            _appearance = look + outfit;
            foreach (var layer in _layers) Destroy(layer);
            _layers.Clear();
            var (body, layers) = Parts(look, outfit);
            foreach (var (sprite, order) in layers)
                _layers.Add(Draw.Put(_body, sprite, Vector2.zero, 1, _sprite.sortingOrder + order).gameObject);
            SetLookNamed(body);
        }

        // Stacks the same layers as UI images inside a rect (character creator preview, HUD avatar)
        public static void FillPortrait(RectTransform parent, string look, string outfit = "")
        {
            foreach (Transform child in parent) Destroy(child.gameObject);
            var (body, layers) = Parts(look, outfit);
            var names = new List<(string sprite, int order)>(layers) { (body, 0) };
            names.Sort((a, b) => a.order.CompareTo(b.order));
            foreach (var (sprite, _) in names) UIBuilder.Fill(UIBuilder.Image(parent, sprite).rectTransform);
        }

        void SetStep(int step, bool force = false)
        {
            if (step == _step && !force) return;
            _step = step;
            _sprite.sprite = SpriteLibrary.Get(step > 0 ? $"{_look}_step{step}" : _look);
        }

        // Hop (after a sale)
        public void Cheer(float seconds = 1.2f) => _happyUntil = Time.time + seconds;

        // Quick stretch (when invited)
        public void Surprise(float seconds = 1f) => _surprisedUntil = Time.time + seconds;

        public void Say(string text)
        {
            bool show = !string.IsNullOrEmpty(text);
            _bubble.gameObject.SetActive(show);
            _bubbleBg.gameObject.SetActive(show);
            if (!show || _bubble.text == text) return;
            _bubble.text = text;
            _bubbleBg.size = new Vector2(Mathf.Clamp(text.Length * 0.095f + 0.35f, 0.7f, 5f), 0.62f);
        }

        public void SetSubLabel(string text)
        {
            bool show = !string.IsNullOrEmpty(text);
            _subLabel.gameObject.SetActive(show);
            _subLabelBg.gameObject.SetActive(show);
            if (show && _subLabel.text != text)
            {
                _subLabel.text = text;
                _subLabelBg.size = new Vector2(text.Length * 0.085f + 0.25f, 0.28f);
            }
            if (show) _name.gameObject.SetActive(false);
        }

        void Update()
        {
            var p = transform.position;
            var next = Vector3.Lerp(p, Target, 1 - Mathf.Exp(-10f * Time.deltaTime));
            if (Mathf.Abs(next.x - p.x) > 0.0005f) _facing = Mathf.Sign(next.x - p.x);
            transform.position = next;
            bool walking = IsWalking;
            _bob = walking ? _bob + Time.deltaTime * 11f : 0;
            // step cycle 1 - 0 - 2 - 0 follows the bob
            SetStep(walking ? new[] { 1, 0, 2, 0 }[(int)(_bob / (Mathf.PI / 2)) % 4] : 0);
            float hop = Time.time < _happyUntil ? Mathf.Abs(Mathf.Sin((_happyUntil - Time.time) * 12f)) * 0.12f : 0;
            _body.localPosition = new Vector3(0, Mathf.Abs(Mathf.Sin(_bob)) * 0.05f + hop, 0);
            _body.localRotation = Quaternion.Euler(0, 0, Mathf.Sin(_bob) * WalkRock);

            float stretch = Time.time < _surprisedUntil ? 1 + Mathf.Abs(Mathf.Sin((_surprisedUntil - Time.time) * 10f)) * 0.08f : 1;
            if (!walking) stretch += Mathf.Sin(Time.time * 2f + _breathPhase) * Breath;
            _body.localScale = new Vector3(_facing * SpriteScale, SpriteScale * stretch, 1);
            if (SortByDepth) _group.sortingOrder = 1000 - Mathf.RoundToInt(next.y * 100);
        }
    }
}
