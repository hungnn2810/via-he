// Loads the sprite set in Resources/Sprites (sorted into folders by kind, see client/Tools/sprite-folders.json)
// as Sprites with pivot and 9-slice border:
// sprites.txt lists the art drawn by client/Tools/sprites.js, street_sprites.txt the art cut by client/Tools/cut_street.py,
// scene_sprites.txt the hand-cut street scene imported by client/Tools/import_scene.py.
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace ViaHeOnline
{
    public static class SpriteLibrary
    {
        static Dictionary<string, Sprite> _sprites;
        public static float PPU { get; private set; } = 200;

        static void Load()
        {
            _sprites = new Dictionary<string, Sprite>();
            LoadList("sprites");
            LoadList("street_sprites");
            LoadList("scene_sprites");
            LoadList("player_sprites");
        }

        static void LoadList(string file)
        {
            var list = Resources.Load<TextAsset>("Sprites/" + file);
            if (!list) { Debug.LogError($"Missing Resources/Sprites/{file}.txt"); return; }
            foreach (var line in list.text.Split('\n'))
            {
                var c = line.Trim().Split(',');
                if (c.Length == 2 && c[0] == "ppu") { PPU = Num(c[1]); continue; }
                if (c.Length < 7) continue;
                // The manifest id is the folder under Resources/Sprites plus the sprite name, e.g. "character/body_female".
                // Code asks for the bare name ("body_female").
                string id = c[0].Trim();
                string name = id.Substring(id.LastIndexOf('/') + 1);
                var tex = Resources.Load<Texture2D>("Sprites/" + id);
                if (!tex) { Debug.LogWarning("Missing sprite " + id); continue; }
                tex.wrapMode = TextureWrapMode.Clamp;
                var sp = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(Num(c[1]), Num(c[2])), PPU, 0,
                    SpriteMeshType.FullRect, new Vector4(Num(c[3]), Num(c[4]), Num(c[5]), Num(c[6])));
                sp.name = name;
                _sprites[name] = sp;
            }
        }

        static float Num(string s) => float.Parse(s, CultureInfo.InvariantCulture);

        public static Sprite Get(string name)
        {
            if (_sprites == null) Load();
            return name != null && _sprites.TryGetValue(name, out var s) ? s : null;
        }

        public static bool Has(string name) => Get(name) != null;
    }
}
