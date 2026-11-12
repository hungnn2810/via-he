// Central depth sorting for the whole scene and character layer order.
// World contract: DepthOrder(y) = 1000 - round(y * 100)
// Higher on screen (larger y) = further away = drawn first (lower sortingOrder).
// See docs/client/world.md.
using UnityEngine;

namespace ViaHeOnline
{
    public static class Depth
    {
        /// Compute sorting order from y position in Unity units.
        public static int Of(float y) => 1000 - Mathf.RoundToInt(y * 100f);

        // Fixed flat backdrops (strictly behind all ground objects):
        public const int Sky = -1000;
        public const int RiverCity = -990;
        public const int Land = -972;
        public const int Sidewalk = -960;
        public const int Curb = -950;
        public const int Road = -940;

        // Overlays & effects (strictly in front of ground objects):
        public const int Rain = 1800;
        public const int SkyTint = 1750;    // time-of-day and weather light over the whole street
        public const int Traffic = 1700;
        public const int FloatMoney = 2000;
        public const int FloatMoneyText = 2001;
        public const int Bubble = 2000;
        public const int BubbleText = 2001;

        // Character layer order relative to body (inside Character's SortingGroup):
        public const int LayerShadow = -3;
        public const int LayerVehicle = -2;
        public const int LayerHairBack = -1;
        public const int LayerBody = 0;
        public const int LayerEarrings = 1;
        public const int LayerCheeks = 2;
        public const int LayerBrows = 3;
        public const int LayerLips = 4;
        public const int LayerHair = 5;
        public const int LayerPants = 6;
        public const int LayerShirt = 7;
        public const int LayerHat = 9;
        public const int LayerAccessory = 10;
        public const int LayerName = 20;
    }
}
