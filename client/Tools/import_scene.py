# Imports the hand-cut street scene art (one transparent image per prop, building or bystander) into Assets/Resources/Sprites.
# Run: python client/Tools/import_scene.py <folder with the source images>   (needs pillow)
# Each image is trimmed to its visible pixels, capped in size and saved under an English sprite name.
# PNGs go into the folder sprite-folders.json gives each name; scene_sprites.txt is written at the Sprites root, its rows start with that folder; SpriteLibrary loads it after sprites.txt and street_sprites.txt.
# The scene is laid out in StreetScene.cs. Sizes there are world heights, so the pixel size chosen here only sets sharpness.
import sys
import unicodedata
from pathlib import Path

from PIL import Image

from sprite_paths import png_path, sprite_id

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE.parent / 'Assets' / 'Resources' / 'Sprites'
ALPHA_CUTOFF = 16

# bg_road is cut from the road art (2048x1152): the curb, a band of asphalt, then the dark gutter and the yellow line.
# Its top edge is the curb, so StreetScene hangs it from the curb row of bg_street. The asphalt is plain texture,
# so its middle is left out to keep the road short enough that the city above stays on screen.
ROAD_CURB_TOP = 292
ROAD_CURB_HEIGHT = 46
ROAD_ASPHALT = 160
ROAD_GUTTER_TOP = 1050

# (words that appear in the source file name, sprite name, longest edge in px, pivot)
# Source names are Vietnamese, so they are matched after stripping diacritics.
SPRITES = [
    ('16-background', 'bg_street', 2048, (0.5, 0)),
    ('04-mat-duong', 'bg_road', 2048, (0.5, 1)),
    ('01-shop', 'scene_teal_shop', 900, (0.5, 0)),
    ('06-nha-ben-trai', 'scene_side_house', 900, (0.5, 0)),
    ('11-tiem-cat-toc', 'scene_barber_shop', 900, (0.5, 0)),
    ('20-cot-khu-pho-1', 'scene_district_pole', 2048, (0.5, 0)),
    ('03-bien-keo-xanh', 'prop_scissors_sign', 256, (0.5, 0.5)),
    ('10-thung-hang-thanh-ly', 'prop_clearance_boxes', 512, (0.5, 0)),
    ('15-2-xe-may-dau', 'prop_parked_bikes', 600, (0.5, 0)),
    ('19-bien-cafe', 'prop_cafe_board', 600, (0.5, 0)),
    ('bien ban dat', 'prop_land_sale_sign', 400, (0.5, 0.5)),
    ('xe giao hang', 'prop_delivery_bike', 600, (0.5, 0)),
    ('nut xe buyt', 'prop_bus_sign', 300, (0.5, 0)),
    ('05-nguoi-ao-den', 'npc_black_jacket', 600, (0.5, 0)),
    ('07-ong-cat-toc', 'npc_barber', 600, (0.5, 0)),
    ('08-ong-gia-ban-rong', 'npc_old_vendor', 600, (0.5, 0)),
    ('be gai mu xanh', 'npc_green_cap_girl', 600, (0.5, 0)),
]


def plain(text):
    text = unicodedata.normalize('NFD', text.lower().replace('đ', 'd'))
    return ''.join(c for c in text if unicodedata.category(c) != 'Mn')


def trim(img):
    alpha = img.getchannel('A').point(lambda a: 255 if a > ALPHA_CUTOFF else 0)
    box = alpha.getbbox()
    return img.crop(box) if box else img


def road_strip(img):
    curb_and_asphalt = img.crop((0, ROAD_CURB_TOP, img.width, ROAD_CURB_TOP + ROAD_CURB_HEIGHT + ROAD_ASPHALT))
    gutter = img.crop((0, ROAD_GUTTER_TOP, img.width, img.height))
    out = Image.new('RGBA', (img.width, curb_and_asphalt.height + gutter.height))
    out.paste(curb_and_asphalt, (0, 0))
    out.paste(gutter, (0, curb_and_asphalt.height))
    return out


def main():
    if len(sys.argv) != 2:
        sys.exit('usage: python import_scene.py <source folder>')
    files = [f for f in Path(sys.argv[1]).iterdir() if f.is_file()]
    manifest = []
    for words, name, longest, pivot in SPRITES:
        match = [f for f in files if words in plain(f.name)]
        if len(match) != 1:
            sys.exit(f'{name}: expected one source file matching "{words}", found {len(match)}')
        img = Image.open(match[0]).convert('RGBA')
        if name == 'bg_road':
            img = road_strip(img)
        elif name != 'bg_street':
            img = trim(img)
        img.thumbnail((longest, longest), Image.LANCZOS)
        img.save(png_path(OUT_DIR, name), optimize=True)
        manifest.append(f'{sprite_id(name)},{pivot[0]},{pivot[1]},0,0,0,0')
        print(f'{name}: {img.size[0]}x{img.size[1]}')
    (OUT_DIR / 'scene_sprites.txt').write_text('\n'.join(manifest) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
