// The game's TextMeshPro font. Charm Bold covers every Vietnamese letter the screens use
// (checked against docs/client/screens.md), so there is no fallback chain.
//
// The font asset is generated once by the editor tool and stored in Resources/Fonts.
// Loading it from Resources also pulls the TMP shader into player builds.
using System;
using TMPro;
using UnityEngine;
using UnityEngine.TextCore.LowLevel;

namespace ViaHeOnline
{
    public static class UiFont
    {
        public const string AssetResource = "Fonts/Charm SDF";
        public const string SourceResource = "Fonts/Charm-Bold";

        // SDF generation settings, shared with the editor tool so both produce the same atlas
        public const int SamplingSize = 48;
        public const int AtlasPadding = 5;
        public const int AtlasSize = 1024;

        static TMP_FontAsset _asset;
        static Material _thin, _thick;

        public static TMP_FontAsset Asset
        {
            get
            {
                if (!_asset) Load();
                return _asset;
            }
        }

        /// One shared material per edge style. Sharing is what keeps outlined text from multiplying draw calls.
        public static Material EdgeMaterial(Ui.Edge edge)
        {
            var font = Asset;
            if (!font) return null;
            switch (edge)
            {
                case Ui.Edge.Thin: return _thin != null ? _thin : font.material;
                case Ui.Edge.Thick: return _thick != null ? _thick : font.material;
                default: return font.material;
            }
        }

        static void Load()
        {
            try
            {
                _asset = Resources.Load<TMP_FontAsset>(AssetResource);
                var settings = Resources.Load<TMP_Settings>("TMP Settings");

                if (!_asset)
                {
                    var source = Resources.Load<Font>(SourceResource);
                    if (source && settings != null)
                    {
                        _asset = TMP_FontAsset.CreateFontAsset(source, SamplingSize, AtlasPadding, GlyphRenderMode.SDFAA, AtlasSize, AtlasSize);
                    }
                }

                if (!_asset && settings != null)
                {
                    _asset = TMP_Settings.defaultFontAsset;
                }

                if (_asset != null && _asset.material != null)
                {
                    _thin = MakeEdge("Charm Edge Thin", 0.16f);
                    _thick = MakeEdge("Charm Edge Thick", 0.24f);
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning("UiFont.Load non-fatal warning: " + ex.Message);
            }
        }

        static Material MakeEdge(string name, float width)
        {
            if (_asset == null || _asset.material == null) return null;
            var m = new Material(_asset.material) { name = name };
            m.EnableKeyword(ShaderUtilities.Keyword_Outline);
            m.SetFloat(ShaderUtilities.ID_OutlineWidth, width);
            m.SetColor(ShaderUtilities.ID_OutlineColor, Theme.Ink);
            return m;
        }
    }
}
