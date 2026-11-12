# Imports the player character art (one whole-body image per pose, no layers) into Assets/Resources/Sprites.
# Run: python client/Tools/import_player.py <folder with the source images>   (needs pillow)
#
# The male set ("nv-nam") is drawn in 3/4 view facing left. Street sprites face right and Character flips them
# by walking direction, so every pose is mirrored here. Each pose is trimmed to its visible pixels, scaled so a
# standing figure is TARGET_HEIGHT px tall, and centred on the head so the head stays still between walk frames.
# Source files come in families drawn at different scales; one scale per family keeps walk frames consistent.
# PNGs go into the folder sprite-folders.json gives each name (player_ -> player/); player_sprites.txt is written
# at the Sprites root and SpriteLibrary loads it after the other manifests. See docs/client/player-character.md.
import sys
from pathlib import Path

from PIL import Image

from sprite_paths import png_path, sprite_id

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE.parent / 'Assets' / 'Resources' / 'Sprites'
TARGET_HEIGHT = 310      # px of a standing figure; NPCs are about 290 px at PPU 200
HEAD_ROWS = 0.35         # top share of the figure used to find the head centre
ALPHA_CUTOFF = 16

# sprite name -> (source file, family). A family shares one scale, taken from its tallest pose.
POSES = {
    'player_male':                ('34-trai-dung-thang.png', 'pose34'),
    'player_male_wave':           ('34-trai-vay-tay.png', 'pose34'),
    'player_male_arms_crossed':   ('34-trai-khoanh-tay.png', 'pose34'),
    'player_male_step1':          ('di34-01.png', 'walk34'),
    'player_male_step2':          ('di34-02.png', 'walk34'),
    'player_male_step3':          ('di34-03.png', 'walk34'),
    'player_male_step4':          ('di34-04.png', 'walk34'),
    'player_male_happy':          ('cx-01-vui-cuoi-lon-34.png', 'mood34'),
    'player_male_sad':            ('cx-02-buon-khoc-34.png', 'mood34'),
    'player_male_angry':          ('cx-03-gian-34.png', 'mood34'),
    'player_male_surprised':      ('cx-04-ngac-nhien-34.png', 'mood34'),
    'player_male_tired':          ('cx-05-met-moi-34.png', 'mood34'),
}


def trimmed(path):
    img = Image.open(path).convert('RGBA').transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    alpha = img.getchannel('A').point(lambda a: 255 if a > ALPHA_CUTOFF else 0)
    return img.crop(alpha.getbbox())


def head_centre(img):
    """x of the middle of the visible pixels in the top rows (the head)."""
    rows = max(1, int(img.height * HEAD_ROWS))
    box = img.crop((0, 0, img.width, rows)).getchannel('A').point(lambda a: 255 if a > ALPHA_CUTOFF else 0).getbbox()
    return (box[0] + box[2]) / 2 if box else img.width / 2


def main(src):
    images = {name: trimmed(src / file) for name, (file, _) in POSES.items()}
    family_height = {}
    for name, (_, family) in POSES.items():
        family_height[family] = max(family_height.get(family, 0), images[name].height)

    manifest = []
    for name, (_, family) in POSES.items():
        img = images[name]
        k = TARGET_HEIGHT / family_height[family]
        img = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.Resampling.LANCZOS)
        cx = head_centre(img)
        half = int(max(cx, img.width - cx)) + 2
        canvas = Image.new('RGBA', (half * 2, img.height))
        canvas.alpha_composite(img, (int(round(half - cx)), 0))
        canvas.save(png_path(OUT_DIR, name))
        manifest.append(f'{sprite_id(name)},0.5,0,0,0,0,0')
        print(f'{name}: {canvas.width}x{canvas.height}')

    (OUT_DIR / 'player_sprites.txt').write_text('\n'.join(manifest) + '\n', encoding='utf-8')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('usage: python import_player.py <folder with the source images>')
    main(Path(sys.argv[1]))
