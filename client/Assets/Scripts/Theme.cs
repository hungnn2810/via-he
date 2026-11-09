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

        // Sliced sprites are authored at 200 px per unit; this keeps their borders crisp on screen.
        public const float PixelsPerUnitMultiplier = 1.6f;
    }
}
