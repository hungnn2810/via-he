// Street scenery the player can tap: shows its name and a speech bubble, and may open a game window.
// Living characters (npc_*) breathe and chat on their own.
// See docs/client/world.md.
using System;
using System.Collections.Generic;
using UnityEngine;

namespace ViaHeOnline
{
    public enum StreetAction { None, Staff, Shop, Wardrobe, Bus }

    public class StreetObject : MonoBehaviour
    {
        const float BubbleSeconds = 3f;
        const float BubbleMaxY = 3f;
        const float BounceSeconds = 0.3f;
        public static Func<string> GetActiveEvent;

        class Info
        {
            public string Name;
            public string[] Lines;
            public Dictionary<string, string[]> EventLines;
            public StreetAction Action;
            public bool Building;
        }

        static Info Person(string name, params string[] lines) => new Info { Name = name, Lines = lines };
        static Info PersonWithEvents(string name, string[] lines, Dictionary<string, string[]> eventLines) =>
            new Info { Name = name, Lines = lines, EventLines = eventLines };
        static Info Building(string name, StreetAction action, params string[] lines) =>
            new Info { Name = name, Lines = lines, Action = action, Building = true };

        static readonly Dictionary<string, Info> Catalog = new Dictionary<string, Info>
        {
            ["npc_cap_man"] = PersonWithEvents("Anh Tư",
                new[] { "Hôm nay phố đông ghê!", "Bán đắt hàng nha bà con!", "Cà phê sáng chưa anh em?", "Đang đợi nổ đơn đây...", "Phố mình dạo này làm ăn xôm tụ hẳn!" },
                new Dictionary<string, string[]>
                {
                    ["rain"] = new[] { "Mưa ngập hết đường rồi, chạy xe cẩn thận nhé!", "Mưa gió ế ẩm quá bác chủ ơi...", "Tạt vào trú mưa làm ấm trà đá đã!" },
                    ["hot_sun"] = new[] { "Nắng chảy mỡ thế này, cho cốc trà đá giải nhiệt nào!", "Đội mũ vào em ơi, nắng rát hết cả mặt!" },
                    ["rush_hour"] = new[] { "Giờ tan tầm kẹt xe từ đầu ngõ tới đây!", "Tranh thủ bán đi, người ta đi làm về đông lắm!" }
                }),
            ["npc_firefighter"] = Person("Lính cứu hỏa", "Dọn hàng nhớ tắt bếp than nha!", "Phố này an toàn là trên hết!", "Bình chữa cháy để ngay ngắn nhé các bác!", "Vỉa hè gọn gàng thế này xe dễ vào!"),
            ["npc_worker"] = PersonWithEvents("Chú thợ hồ",
                new[] { "Đường này đào hoài chưa xong!", "Nghỉ tay chút đã.", "Làm từ sáng tới giờ đói mờ mắt.", "Bác chủ quầy xới cho bát xôi đầy đặn tí nhé!", "Lao động là vinh quang, mà mệt quá anh em ơi!" },
                new Dictionary<string, string[]>
                {
                    ["hot_sun"] = new[] { "Nắng chang chang thế này xây trát mệt đứt hơi.", "Cho ca trà đá to nhiều đá em ơi!" },
                    ["rain"] = new[] { "Mưa to thế này thợ hồ được nghỉ sớm rồi!" }
                }),
            ["npc_old_vendor"] = PersonWithEvents("Ông Sáu",
                new[] { "Ngày xưa phố này vắng lắm, toàn đầm chuối...", "Ông còn miếng đất, chăm chỉ gom tiền mà mua!", "Người trẻ bây giờ buôn bán chịu khó ghê.", "Sáng nào ông cũng phải làm ấm trà ngắm phố xá." },
                new Dictionary<string, string[]>
                {
                    ["tet"] = new[] { "Tết đến nơi rồi, hoa đào hoa mai nở rực cả xóm!" },
                    ["rain"] = new[] { "Trời mưa lại nhớ ngày xưa ngập đường lội nước..." }
                }),
            // Hand-cut street scene (client/Tools/import_scene.py)
            ["scene_teal_shop"] = Building("Nhà", StreetAction.Wardrobe, "Thay đồ rồi ra phố nào!"),
            ["scene_barber_shop"] = Building("Tiệm cắt tóc", StreetAction.None, "Hớt tóc, cạo râu, gội đầu đủ cả!"),
            ["prop_land_sale_sign"] = Building("Đất bán", StreetAction.None, "Miếng đất này đang rao bán."),
            ["prop_parked_bikes"] = Building("Bãi giữ xe", StreetAction.None, "Giữ xe năm nghìn."),
            ["prop_bus_sign"] = Building("Trạm xe buýt", StreetAction.Bus, "Đi phố khác nào!"),
            ["prop_clearance_boxes"] = Person("Hàng thanh lý", "Toàn đồ cũ, ai cần thì lấy."),
            ["prop_cafe_board"] = Person("Biển cà phê", "Quán sáng nay chưa mở."),
            ["prop_delivery_bike"] = Person("Xe giao hàng", "Thùng đầy hàng rồi!"),
            ["npc_barber"] = Person("Chú Tư hớt tóc",
                "Hớt tóc không em? Vô đây chú tỉa cho gọn!", "Tiệm chú mở ở đây ba chục năm rồi.",
                "Cắt xong gội đầu miễn phí nha!", "Tóc dài quá rồi đó, ghé chú đi!"),
            ["npc_black_jacket"] = Person("Anh Hai",
                "Đứng đây hóng gió chút thôi.", "Ai cần chở hàng thì kêu anh nha!",
                "Phố này giờ đông vui quá ha.", "Mới ăn ổ bánh mì xong, no căng!"),
        };

        Info _info;
        SpriteRenderer _sprite;
        Vector3 _scale;
        GameObject _bubble;
        float _phase, _bubbleUntil, _bounceUntil, _nextChat;
        bool _living;

        public int Order => _sprite ? _sprite.sortingOrder : 0;

        public static void TryAttach(SpriteRenderer sprite)
        {
            if (!sprite || !Catalog.TryGetValue(sprite.name, out var info)) return;
            var o = sprite.gameObject.AddComponent<StreetObject>();
            o._info = info;
            o._sprite = sprite;
            o._scale = sprite.transform.localScale;
            o._phase = UnityEngine.Random.Range(0f, 6f);
            o._living = sprite.name.StartsWith("npc_");
            o._nextChat = Time.time + UnityEngine.Random.Range(8f, 25f);
            var box = sprite.gameObject.AddComponent<BoxCollider2D>();
            if (sprite.sprite)
            {
                box.size = sprite.sprite.bounds.size;
                box.offset = sprite.sprite.bounds.center;
            }
        }

        public StreetAction Interact(Vector2 tapped)
        {
            Speak(_info.Building ? tapped.x : transform.position.x);
            if (!_info.Building) _bounceUntil = Time.time + BounceSeconds;
            return _info.Action;
        }

        void Speak(float x)
        {
            if (_bubble) Destroy(_bubble);
            var line = PickLine();
            _bubble = new GameObject("Bubble");
            var t = _bubble.transform;
            t.SetParent(transform.parent, false);
            float topY = _sprite ? _sprite.bounds.max.y : transform.position.y;
            t.position = new Vector3(x, Mathf.Min(topY, BubbleMaxY), 0f);

            Draw.Sized(t, "ui_speech_bubble", Vector2.zero,
                new Vector2(Mathf.Clamp(line.Length * 0.095f + 0.35f, 0.7f, 5f), 0.62f), Depth.Bubble, SpriteDrawMode.Sliced);
            Draw.Text(t, line, new Vector2(0f, 0.28f), 0.17f, Theme.TextDark, Depth.BubbleText);
            Draw.Outlined(t, _info.Name, new Vector2(0f, 0.72f), 0.17f, Theme.Gold, Depth.BubbleText);
            _bubbleUntil = Time.time + BubbleSeconds;
        }

        string PickLine()
        {
            string active = GetActiveEvent?.Invoke() ?? "";
            if (!string.IsNullOrEmpty(active) && _info.EventLines != null && UnityEngine.Random.value < 0.65f)
            {
                foreach (var ev in active.Split(','))
                {
                    var key = ev.Trim();
                    if (_info.EventLines.TryGetValue(key, out var pool) && pool.Length > 0)
                        return pool[UnityEngine.Random.Range(0, pool.Length)];
                }
            }
            return _info.Lines[UnityEngine.Random.Range(0, _info.Lines.Length)];
        }

        void Update()
        {
            if (_bubble && Time.time > _bubbleUntil) Destroy(_bubble);
            if (_info.Building) return;

            float stretch = _living ? Mathf.Sin(Time.time * 2f + _phase) * 0.012f : 0f;
            if (Time.time < _bounceUntil) stretch += Mathf.Sin((_bounceUntil - Time.time) / BounceSeconds * Mathf.PI) * 0.12f;
            transform.localScale = new Vector3(_scale.x * (1f - stretch * 0.5f), _scale.y * (1f + stretch), 1f);

            if (_living && Time.time > _nextChat)
            {
                _nextChat = Time.time + UnityEngine.Random.Range(15f, 40f);
                Speak(transform.position.x);
            }
        }
    }
}
