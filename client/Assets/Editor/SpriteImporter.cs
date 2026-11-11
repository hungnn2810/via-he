// Import settings for the sprite set: Sprite, no mipmaps, uncompressed, original size (no power-of-two scaling).
using UnityEditor;

namespace ViaHeOnline.EditorTools
{
    public class SpriteImporter : AssetPostprocessor
    {
        void OnPreprocessTexture()
        {
            var path = assetPath.Replace('\\', '/');
            if (path.Contains("/Art/Outfits/")) { ImportOutfit((TextureImporter)assetImporter); return; }
            if (!path.Contains("/Resources/Sprites/")) return;
            var t = (TextureImporter)assetImporter;
            t.textureType = TextureImporterType.Sprite;
            t.spriteImportMode = SpriteImportMode.Single;
            t.mipmapEnabled = false;
            t.alphaIsTransparency = true;
            t.npotScale = TextureImporterNPOTScale.None;
            t.textureCompression = TextureImporterCompression.Uncompressed;
            t.isReadable = false;
        }

        // Outfit source art (Assets/Art/Outfits, ~1800x1300 each): not in any build until a wearable is wired up,
        // so keep it as a plain sprite and let Unity compress it. See docs/client/outfits.md.
        static void ImportOutfit(TextureImporter t)
        {
            t.textureType = TextureImporterType.Sprite;
            t.spriteImportMode = SpriteImportMode.Single;
            t.mipmapEnabled = false;
            t.alphaIsTransparency = true;
            t.npotScale = TextureImporterNPOTScale.None;
            t.maxTextureSize = 2048;
            t.textureCompression = TextureImporterCompression.Compressed;
            t.isReadable = false;
        }

        [MenuItem("Via He/Reimport Sprites")]
        static void Reimport()
        {
            AssetDatabase.ImportAsset("Assets/Resources/Sprites", ImportAssetOptions.ImportRecursive | ImportAssetOptions.ForceUpdate);
            AssetDatabase.ImportAsset("Assets/Art/Outfits", ImportAssetOptions.ImportRecursive | ImportAssetOptions.ForceUpdate);
        }
    }
}
