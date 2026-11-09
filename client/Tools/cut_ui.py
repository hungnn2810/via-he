# Cuts interface components out of original-client reference screenshots so each one can be
# studied and then REDRAWN in sprites.js. The crops are reference material only - they are
# never shipped as game art. See docs/client/art-direction.md.
#
# Run: python client/Tools/cut_ui.py            (needs pillow)
#      python client/Tools/cut_ui.py --scale 4  (bigger crops)
#
# Coordinates are source-image pixels on the named screenshot. The seed rectangles below were
# read off street_source_2.png (800x606) by eye and are meant to be refined: run the script,
# look at the crop, adjust the numbers, run again.
import argparse
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
REF_DIR = HERE / 'ui_ref'
OUT_DIR = REF_DIR / 'cut'

# source file -> { component name: (left, top, right, bottom) }
# A source is looked up in Tools/ui_ref/ first, then in Tools/ itself.
RECTS = {
    'street_source_2.png': {
        # top-left player block
        'hud_level_badge': (10, 6, 70, 60),
        'hud_xp_bar': (58, 4, 196, 24),
        'hud_name': (60, 20, 176, 46),
        'hud_money': (14, 44, 184, 74),
        'hud_stat_coin': (8, 70, 124, 96),
        'hud_stat_heart': (8, 94, 124, 122),
        'hud_stat_clover': (8, 118, 134, 150),
        # top-centre
        'hud_icon_quest': (188, 2, 228, 42),
        'hud_icon_hand': (238, 2, 278, 42),
        # top-right cluster, then each icon on its own
        'hud_icon_cluster': (338, 0, 660, 48),
        'hud_icon_map': (340, 2, 380, 42),
        'hud_icon_wholesale': (382, 2, 422, 42),
        'hud_icon_shop': (424, 2, 464, 42),
        'hud_icon_pack': (466, 2, 506, 42),
        'hud_icon_camera': (508, 2, 548, 42),
        'hud_icon_pet': (550, 2, 590, 42),
        'hud_icon_food': (592, 2, 632, 42),
        'hud_timer': (596, 24, 652, 46),
        # floating
        'banner_buff': (138, 78, 364, 136),
        'tooltip_small': (6, 518, 104, 562),
        'sign_district': (700, 208, 792, 238),
        'sign_for_sale': (88, 310, 136, 336),
        'btn_bus': (712, 484, 798, 572),
        'marker_arrow': (726, 436, 768, 486),
        # bottom dock
        'dock_bar': (0, 556, 800, 606),
        'dock_icon_lock': (40, 560, 80, 600),
        'dock_icon_shop': (84, 560, 128, 600),
        'tab_street_strip': (150, 558, 660, 606),
        'tab_street_1': (116, 560, 170, 598),
        'tab_street_3': (222, 560, 272, 598),
        'btn_arrow_left': (176, 564, 212, 598),
        'btn_arrow_right': (664, 564, 700, 598),
        'btn_chat': (744, 572, 800, 606),
    },
    'street_source.jpg': {
        'speech_bubble': (636, 148, 806, 252),
        'hud_icon_row': (0, 0, 300, 60),
        'banner_event': (396, 20, 640, 62),
        'sign_small': (116, 238, 170, 268),
    },
    # Frames pulled from the original-client recording, cropped to the game canvas (700x595).
    # Only the log window has been measured in detail so far; the rest are whole-window rects
    # kept deliberately generous, to be tightened the same way: run, look, adjust.
    'ref_window_list_log.png': {
        'win_list_panel': (75, 110, 615, 530),
        'win_list_title': (255, 83, 445, 113),
        'win_close_x': (608, 93, 637, 123),
        'win_list_rowcard': (97, 153, 597, 265),
        'win_list_itemslot': (113, 180, 160, 230),
        'btn_green_small': (508, 218, 588, 250),
        'win_pagination': (320, 523, 405, 550),
        'hud_left_column': (0, 60, 90, 260),
        'rail_icon_right': (620, 105, 700, 525),
    },
    'ref_confirm_dialog.png': {
        'win_confirm_panel': (140, 160, 560, 345),
    },
    'ref_window_grid_barber.png': {
        'win_grid_panel': (55, 100, 640, 420),
    },
    'ref_popup_reward.png': {
        'popup_reward': (200, 110, 530, 440),
    },
    'ref_panel_scroll.png': {
        'panel_scroll': (230, 105, 560, 520),
    },
    'ref_window_gacha_grid.png': {
        'win_gacha_panel': (185, 95, 525, 525),
    },
    'ref_window_chest_grid.png': {
        'win_chest_panel': (190, 110, 520, 450),
    },
    'ref_screen_character.png': {
        'screen_character': (0, 60, 700, 560),
    },
    'ref_street_dock.png': {
        'dock_strip': (0, 520, 700, 595),
    },
}


def find_source(name: str) -> Path | None:
    for candidate in (REF_DIR / name, HERE / name):
        if candidate.is_file():
            return candidate
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scale', type=int, default=3, help='upscale factor for the crops')
    parser.add_argument('--only', help='cut just this source file')
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total = 0
    for source_name, rects in RECTS.items():
        if args.only and args.only != source_name:
            continue
        source = find_source(source_name)
        if source is None:
            print(f'skip {source_name}: not found in {REF_DIR} or {HERE}')
            continue
        image = Image.open(source).convert('RGBA')
        width, height = image.size
        print(f'{source_name} ({width}x{height})')
        for name, box in rects.items():
            left, top, right, bottom = box
            if not (0 <= left < right <= width and 0 <= top < bottom <= height):
                print(f'  !! {name}: {box} is outside the image, skipped')
                continue
            crop = image.crop(box)
            if args.scale != 1:
                crop = crop.resize((crop.width * args.scale, crop.height * args.scale), Image.LANCZOS)
            out = OUT_DIR / f'{name}.png'
            crop.save(out)
            print(f'  {name:22s} {right - left:3d}x{bottom - top:3d} -> {out.relative_to(HERE)}')
            total += 1
    print(f'\n{total} crops written to {OUT_DIR}')
    print('These are reference only. Redraw each component in sprites.js; do not ship the crops.')


if __name__ == '__main__':
    main()
