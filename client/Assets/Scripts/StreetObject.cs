// Street scenery the player can tap: shows its name and a line, and may open a game window.
// People breathe and chat on their own. This is client-side decoration only; the game rules stay on the server.
using System.Collections.Generic;
using UnityEngine;

namespace ViaHeOnline
{
    public enum StreetAction { None, Staff, Shop, Wardrobe, Bus }

    public class StreetObject : MonoBehaviour
    {
        const float BubbleSeconds = 3f, BubbleMaxY = 3f, BounceSeconds = 0.3f;

        class Info
        {
            public string Name;
            public string[] Lines;
            public StreetAction Action;
            public bool Building;   // too large to bounce; the bubble appears where it was tapped
        }

        static Info Person(string name, params string[] lines) => new Info { Name = name, Lines = lines };
        static Info Building(string name, StreetAction action, params string[] lines) => new Info { Name = name, Lines = lines, Action = action, Building = true };

        // Keyed by sprite name
        static readonly Dictionary<string, Info> Catalog = new Dictionary<string, Info>
        {
            ["npc_cap_man"] = Person("Anh Tư", "Hôm nay phố đông ghê!", "Bán đắt hàng nha!"),
            ["npc_girl"] = Person("Bé Na", "Nóng quá, thèm ly trà đá!", "Có gì ngon không anh chị ơi?"),
            ["npc_firefighter"] = Person("Lính cứu hỏa", "Dọn hàng nhớ tắt bếp nha!", "Phố này an toàn lắm!"),
            ["npc_worker"] = Person("Chú thợ hồ", "Đường này đào hoài chưa xong!", "Nghỉ tay chút đã."),
            ["npc_old_man"] = Person("Ông Sáu", "Ngày xưa phố này vắng lắm...", "Ông còn miếng đất, mua không?"),
            ["bike_delivery"] = Person("Xe giao hàng", "Thùng đầy hàng rồi!"),
            ["bike_sport"] = Person("Xe thể thao", "Xe đẹp đó, đừng đụng trầy nha!"),
            ["bike_cub"] = Person("Xe cub", "Xe cũ mà chạy còn êm."),
            ["prop_boxes"] = Person("Hàng thanh lý", "Toàn đồ cũ, ai cần thì lấy."),
            ["prop_cafe_sign"] = Person("Biển cà phê", "Quán sáng nay chưa mở."),
            ["bus_stop"] = Building("Trạm xe buýt", StreetAction.Bus, "Đi phố khác nào!"),
            ["shop_job_office"] = Building("Môi giới việc làm", StreetAction.Staff, "Tìm người bán hàng ở đây!"),
            ["shop_market"] = Building("Chợ đầu mối", StreetAction.Shop, "Quần áo, mũ nón đủ cả!"),
            ["shop_motorbike"] = Building("Tiệm xe máy", StreetAction.None, "Xe mới sắp về, chờ nha!"),
            ["house_teal"] = Building("Nhà", StreetAction.Wardrobe, "Thay đồ rồi ra phố nào!"),
            ["lot_barber"] = Building("Tiệm cắt tóc", StreetAction.None, "Hôm nay thợ nghỉ."),
            ["lot_parking"] = Building("Bãi giữ xe", StreetAction.None, "Giữ xe năm nghìn."),
            ["lot_fence"] = Building("Đất bán", StreetAction.None, "Miếng đất này đang rao bán."),
        };

        Info _info;
        SpriteRenderer _sprite;
        Vector3 _scale;
        GameObject _bubble;
        float _phase, _bubbleUntil, _bounceUntil, _nextChat;
        bool _living;

        public int Order => _sprite.sortingOrder;

        public static void TryAttach(SpriteRenderer sprite)
        {
            if (!Catalog.TryGetValue(sprite.name, out var info)) return;
            var o = sprite.gameObject.AddComponent<StreetObject>();
            o._info = info;
            o._sprite = sprite;
            o._scale = sprite.transform.localScale;
            o._phase = Random.Range(0f, 6f);
            o._living = sprite.name.StartsWith("npc_");
            o._nextChat = Time.time + Random.Range(8f, 25f);
            var box = sprite.gameObject.AddComponent<BoxCollider2D>();
            box.size = sprite.sprite.bounds.size;
            box.offset = sprite.sprite.bounds.center;
        }

        // Reacts to a tap and returns the window it wants opened
        public StreetAction Interact(Vector2 tapped)
        {
            Speak(_info.Building ? tapped.x : transform.position.x);
            if (!_info.Building) _bounceUntil = Time.time + BounceSeconds;
            return _info.Action;
        }

        void Speak(float x)
        {
            if (_bubble) Destroy(_bubble);
            var line = _info.Lines[Random.Range(0, _info.Lines.Length)];
            _bubble = new GameObject("Bubble");
            var t = _bubble.transform;
            t.SetParent(transform.parent, false);
            t.position = new Vector3(x, Mathf.Min(_sprite.bounds.max.y, BubbleMaxY), 0);
            Draw.Sized(t, "ui_speech_bubble", Vector2.zero, new Vector2(Mathf.Clamp(line.Length * 0.095f + 0.35f, 0.7f, 5f), 0.62f), 2000, SpriteDrawMode.Sliced);
            Draw.Text(t, line, new Vector2(0, 0.28f), 0.17f, Draw.Hex("#3b2414"), 2001);
            Draw.Outlined(t, _info.Name, new Vector2(0, 0.72f), 0.17f, Draw.Hex("#ffe066"), 2001);
            _bubbleUntil = Time.time + BubbleSeconds;
        }

        void Update()
        {
            if (_bubble && Time.time > _bubbleUntil) Destroy(_bubble);
            if (_info.Building) return;

            float stretch = _living ? Mathf.Sin(Time.time * 2f + _phase) * 0.012f : 0;
            if (Time.time < _bounceUntil) stretch += Mathf.Sin((_bounceUntil - Time.time) / BounceSeconds * Mathf.PI) * 0.12f;
            transform.localScale = new Vector3(_scale.x * (1 - stretch * 0.5f), _scale.y * (1 + stretch), 1);

            if (_living && Time.time > _nextChat)
            {
                _nextChat = Time.time + Random.Range(15f, 40f);
                Speak(transform.position.x);
            }
        }
    }
}
