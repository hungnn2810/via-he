// Editor tool to create the TextMeshPro SDF font asset for Charm Bold with full Vietnamese character set,
// and ensure TMP Essential Resources are imported.
using System.IO;
using TMPro;
using UnityEditor;
using UnityEngine;
using UnityEngine.TextCore.LowLevel;

namespace ViaHeOnline.EditorTools
{
    [InitializeOnLoad]
    public static class FontAssetCreator
    {
        const string FontPath = "Assets/Resources/Fonts/Charm-Bold.ttf";
        const string OutputDir = "Assets/Resources/Fonts";
        const string OutputPath = "Assets/Resources/Fonts/Charm SDF.asset";

        // Full Vietnamese character set + punctuation + ASCII + numerals
        const string CharacterSet =
            "0123456789" +
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ" +
            "àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ" +
            "ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ" +
            " .,:;!?()[]{}'\"/\\+-*=%$#@&^_|~<>`•·→…đĐ";

        [InitializeOnLoadMethod]
        public static void AutoSetup()
        {
            EnsureTmpEssentials();
            if (!File.Exists(OutputPath))
            {
                CreateCharmSdf();
            }
        }

        [MenuItem("Via He/Import TMP Essentials")]
        public static void EnsureTmpEssentials()
        {
            if (File.Exists("Assets/TextMesh Pro/Resources/TMP Settings.asset")) return;

            string[] matches = Directory.GetFiles("Library/PackageCache", "TMP Essential Resources.unitypackage", SearchOption.AllDirectories);
            if (matches.Length > 0)
            {
                Debug.Log("Importing TMP Essential Resources from " + matches[0]);
                UnityEditor.AssetPackage.Package.Import(matches[0], false);
            }
            else
            {
                Debug.LogWarning("Could not find TMP Essential Resources.unitypackage in Library/PackageCache");
            }
        }

        [MenuItem("Via He/Set Up TextMeshPro Font")]
        public static void CreateCharmSdf()
        {
            EnsureTmpEssentials();

            var font = AssetDatabase.LoadAssetAtPath<Font>(FontPath);
            if (!font)
            {
                Debug.LogError($"Source font not found at {FontPath}");
                return;
            }

            if (!Directory.Exists(OutputDir))
            {
                Directory.CreateDirectory(OutputDir);
            }

            if (File.Exists(OutputPath))
            {
                AssetDatabase.DeleteAsset(OutputPath);
            }

            var fontAsset = TMP_FontAsset.CreateFontAsset(
                font,
                samplingPointSize: UiFont.SamplingSize,
                atlasPadding: UiFont.AtlasPadding,
                renderMode: GlyphRenderMode.SDFAA,
                atlasWidth: UiFont.AtlasSize,
                atlasHeight: UiFont.AtlasSize);

            if (!fontAsset)
            {
                Debug.LogError("Failed to create TMP_FontAsset!");
                return;
            }

            AssetDatabase.CreateAsset(fontAsset, OutputPath);

            string assetName = Path.GetFileNameWithoutExtension(OutputPath);

            if (fontAsset.atlasTextures != null)
            {
                for (int i = 0; i < fontAsset.atlasTextures.Length; i++)
                {
                    var tex = fontAsset.atlasTextures[i];
                    if (tex != null)
                    {
                        tex.name = assetName + " Atlas" + (i > 0 ? " " + i : "");
                        AssetDatabase.AddObjectToAsset(tex, fontAsset);
                    }
                }
            }

            if (fontAsset.material != null)
            {
                fontAsset.material.name = assetName + " Material";
                AssetDatabase.AddObjectToAsset(fontAsset.material, fontAsset);
            }

            // Generate characters
            fontAsset.TryAddCharacters(CharacterSet);

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            Debug.Log($"Successfully created TextMeshPro font asset at {OutputPath}");
        }
    }
}
