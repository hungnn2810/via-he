// Layout-side copy of client/Tools/theme.js. The art generator draws from that file, the UI
// code positions from this one, and the two must be changed together.
// See docs/client/art-direction.md.
using UnityEngine;

namespace ViaHeOnline
{
    public static class Theme
    {
        public static Color Hex(string hex) => ColorUtility.TryParseHtmlString(hex, out var c) ? c : Color.magenta;

        // The outline on everything
        public static readonly Color Ink = Hex("#2b1d12");

        // Display text
        public static readonly Color Gold = Hex("#ffcc3d");
        public static readonly Color GoldDeep = Hex("#e0a01c");
        public static readonly Color TextDark = Hex("#3a2a18");
        public static readonly Color TextMuted = Hex("#8c7a63");
        public static readonly Color TextOnDark = Hex("#fff6e2");

        // Semantic figures inside body copy: a gain reads blue, a cost reads red
        public static readonly Color FigureGain = Hex("#2f7fd6");
        public static readonly Color FigureCost = Hex("#d33b3b");

        // Boards
        public static readonly Color Cream = Hex("#fdf3dc");
        public static readonly Color CreamLine = Hex("#e8d4a8");

        // Dock, header and HUD chips
        public static readonly Color Navy = Hex("#1d2c4a");
        public static readonly Color NavyDeep = Hex("#111c31");

        // The scrim behind a modal window or sheet
        public static readonly Color Dim = new Color(0.07f, 0.05f, 0.03f, 0.62f);

        /// A window skin names the sprites a window is built from.
        /// Amber carries lists and logs, blue carries forms and feature windows.
        public enum Skin { Amber, Blue }

        public static string PanelSprite(Skin skin) => skin == Skin.Amber ? "panel_amber" : "panel_blue";
        public static string BoardSprite(Skin skin) => skin == Skin.Amber ? "board_cream" : "board_blue";
        public static Color TitleColor(Skin skin) => Gold;

        /// Button roles. Each has drawn _normal / _pressed / _disabled art rather than a runtime tint.
        public enum Btn { Green, Blue, Red, Gold, Gray }

        public static string ButtonSprite(Btn role, bool pressed = false, bool disabled = false)
        {
            var name = role switch
            {
                Btn.Green => "btn_green",
                Btn.Blue => "btn_blue",
                Btn.Red => "btn_red",
                Btn.Gold => "btn_gold",
                _ => "btn_gray",
            };
            if (disabled) return name + "_disabled";
            return name + (pressed ? "_pressed" : "_normal");
        }

        // ---- Sprite lookups for the rest of the widget kit. Layout code asks here, never spells a name. ----

        public static string TitlePlateSprite() => "title_plate";
        public static string CloseSprite() => "btn_close";
        public static string SlotSprite() => "slot_item";
        public static string RowSprite(bool selected = false) => selected ? "row_selected" : "row_card";
        public static string ChipSprite() => "chip_navy";
        public static string BarSprite() => "bar_navy";
        public static string TabSprite(bool on) => on ? "tab_on" : "tab_off";
        public static string TooltipSprite() => "tooltip_body";
        public static string TooltipTailSprite() => "tooltip_tail";
        public static string ScrollThumbSprite() => "scroll_thumb";
        public static string DividerSprite() => "divider";
        public static string ProgressTrackSprite() => "progress_track";
        public static string AvatarFrameSprite() => "ui_avatar_frame";
        public static string RibbonSprite() => "ui_ribbon";

        public enum ProgressTone { Green, Blue, Gold, Red }

        public static string ProgressFillSprite(ProgressTone tone) => tone switch
        {
            ProgressTone.Blue => "progress_fill_blue",
            ProgressTone.Gold => "progress_fill_gold",
            ProgressTone.Red => "progress_fill_red",
            _ => "progress_fill",
        };

        public enum BadgeTone { Red, Green, Blue }

        public static string BadgeSprite(BadgeTone tone) => tone switch
        {
            BadgeTone.Green => "badge_green",
            BadgeTone.Blue => "badge_blue",
            _ => "badge_red",
        };

        public enum ToastTone { Info, Success, Warning, Error }

        public static string ToastSprite(ToastTone tone) => tone switch
        {
            ToastTone.Success => "toast_success",
            ToastTone.Warning => "toast_warning",
            ToastTone.Error => "toast_error",
            _ => "toast_info",
        };

        /// Light plates carry dark text; the saturated green and red plates carry light text with an outline.
        public static Color ToastTextColor(ToastTone tone) =>
            tone == ToastTone.Success || tone == ToastTone.Error ? TextOnDark : TextDark;

        public static bool ToastTextOutlined(ToastTone tone) =>
            tone == ToastTone.Success || tone == ToastTone.Error;

        public static Icon ToastIcon(ToastTone tone) => tone switch
        {
            ToastTone.Success => Icon.Check,
            ToastTone.Warning => Icon.Warning,
            ToastTone.Error => Icon.Warning,
            _ => Icon.Info,
        };

        /// Small 96 px icons. Bare glyphs (Check, Plus, Minus, ArrowLeft, Close) are white with an ink
        /// outline and sit on a coloured button; the others are coloured objects.
        public enum Icon
        {
            Coin, Gem, Energy, Fame, LevelStar, Time, Heart, Lock,
            Check, Plus, Minus, ArrowLeft, Close, Warning, Info,
            Stall, Staff, Wardrobe, Shop, Log, Bus, Home, More, Banana, Store
        }

        public static string IconSprite(Icon icon) => icon switch
        {
            Icon.Coin => "icon_coin",
            Icon.Gem => "icon_gem",
            Icon.Energy => "icon_energy",
            Icon.Fame => "icon_fame",
            Icon.LevelStar => "icon_level_star",
            Icon.Time => "icon_time",
            Icon.Heart => "icon_heart",
            Icon.Lock => "icon_lock",
            Icon.Check => "icon_check",
            Icon.Plus => "icon_plus",
            Icon.Minus => "icon_minus",
            Icon.ArrowLeft => "icon_arrow_left",
            Icon.Close => "icon_close",
            Icon.Warning => "icon_warning",
            Icon.Stall => "icon_stall",
            Icon.Staff => "icon_staff",
            Icon.Wardrobe => "icon_wardrobe",
            Icon.Shop => "icon_shop",
            Icon.Log => "icon_log",
            Icon.Bus => "icon_bus",
            Icon.Home => "icon_home",
            Icon.More => "icon_more",
            Icon.Banana => "icon_banana",
            Icon.Store => "icon_store",
            _ => "icon_info",
        };

        // Corner radii, in reference-space units
        public const float RadiusSm = 6f;
        public const float RadiusMd = 12f;
        public const float RadiusLg = 18f;

        // Spacing scale. Use these, not loose numbers.
        public const float Space1 = 4f;
        public const float Space2 = 8f;
        public const float Space3 = 12f;
        public const float Space4 = 16f;
        public const float Space5 = 24f;
        public const float Space6 = 32f;

        // Type scale
        public const int TextXs = 14;
        public const int TextSm = 17;
        public const int TextMd = 20;
        public const int TextLg = 24;
        public const int TextXl = 30;

        // The reference canvas the UI scales from
        public static readonly Vector2 ReferenceResolution = new Vector2(1280, 720);

        // Standard window footprint, centred
        public static readonly Vector2 WindowSize = new Vector2(640, 480);
        public const float WindowPadding = 24f;
        public const float TitleOverhang = 22f;   // how far the title plate rises above the frame
        public const float RowHeight = 64f;
        public const float SlotSize = 48f;

        // Control sizes, in reference units
        public const float ButtonHeight = 48f;
        public const float IconButtonSize = 48f;
        public const float CloseButtonSize = 40f;
        public const float ChipHeight = 36f;
        public const float TabHeight = 44f;
        public const float BadgeHeight = 20f;
        public const float HeaderHeight = 56f;
        public const float ToastHeight = 44f;
        public const float ProgressHeight = 18f;

        // Sliced sprites are authored at 200 px per unit. The canvas reference is set to the same 200 (see
        // UiRoot), so one sprite pixel is one canvas unit before the multiplier. Dividing by this makes one
        // canvas unit span 1.6 sprite pixels: a 30 px frame band is ~19 units and a 4.5 px outline ~2.8.
        public const float PixelsPerUnitMultiplier = 1.6f;
        public const float SpritePixelsPerUnit = 200f;

        // Window frame band on screen, as (left, bottom, right, top), from the 9-slice border [30,30,30,38].
        // Content must sit inside this, plus padding.
        public static readonly Vector4 PanelInset = new Vector4(30f, 30f, 30f, 38f) / PixelsPerUnitMultiplier;
    }
}
