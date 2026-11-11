# Cuts the walking bystanders and passing riders out of client/Tools/street_source.jpg and street_source_2.png into PNGs
# under Assets/Resources/Sprites (each into the folder sprite-folders.json gives it; manifest rows start with that folder). The street backdrop and scenery now come from client/Tools/import_scene.py.
# Run: python client/Tools/cut_street.py   (needs numpy, pillow, opencv-python-headless)
# Writes street_sprites.txt and street_wheels.txt next to the PNGs. It is a separate manifest because exportSprites() rewrites sprites.txt.
# All coordinates are source image pixels; output is upscaled by SCALE so it fits the 200 px = 1 unit sprite set.
from pathlib import Path

import cv2
import numpy as np

from sprite_paths import png_path, sprite_id

HERE = Path(__file__).resolve().parent
SOURCE = HERE / 'street_source.jpg'
SOURCE_HOME = HERE / 'street_source_2.png'
OUT_DIR = HERE.parent / 'Assets' / 'Resources' / 'Sprites'
SCALE = 3

src = cv2.imread(str(SOURCE))
manifest = []
wheels = []
cut = {}
cut_origin = {}


def upscale(img, k=SCALE):
    return cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_LANCZOS4)


# Bikes cut only to build the traffic riders from; they are not exported on their own.
PARTS = {'bike_sport', 'bike_cub', 'bike_scooter'}


def save(name, img, pivot=(0.5, 0)):
    cut[name] = img
    if name in PARTS:
        return
    cv2.imwrite(str(png_path(OUT_DIR, name)), img)
    manifest.append(f'{sprite_id(name)},{pivot[0]},{pivot[1]},0,0,0,0')


def cut_out(name, outline, sure=(), never=(), pivot=(0.5, 0), flip=False):
    """GrabCut inside `outline`. `sure` are polygons kept for certain, `never` are polygons removed for certain.
    `flip` mirrors the result, for people who face left: the game expects everyone to face right."""
    pts = np.array(outline)
    x0, y0 = pts.min(axis=0) - 4
    x1, y1 = pts.max(axis=0) + 4
    x0, y0 = max(x0, 0), max(y0, 0)
    img = upscale(src[y0:y1, x0:x1])

    def scaled(poly):
        return [((np.array(poly) - (x0, y0)) * SCALE).astype(np.int32)]

    mask = np.full(img.shape[:2], cv2.GC_BGD, np.uint8)
    cv2.fillPoly(mask, scaled(outline), cv2.GC_PR_FGD)
    for poly in sure:
        cv2.fillPoly(mask, scaled(poly), cv2.GC_FGD)
    for poly in never:
        cv2.fillPoly(mask, scaled(poly), cv2.GC_BGD)
    cv2.grabCut(img, mask, None, np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_MASK)
    solid = np.isin(mask, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8) * 255

    # Keep the largest blob, fill pinholes, then soften the edge
    count, labels, stats, _ = cv2.connectedComponentsWithStats(solid)
    if count > 1:
        solid = np.where(labels == 1 + stats[1:, cv2.CC_STAT_AREA].argmax(), 255, 0).astype(np.uint8)
    solid = cv2.morphologyEx(solid, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    alpha = cv2.GaussianBlur(cv2.erode(solid, np.ones((3, 3), np.uint8)), (0, 0), 1.0)

    ys, xs = np.where(alpha > 8)
    box = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
    result = np.dstack([img, alpha])[box]
    save(name, cv2.flip(result, 1) if flip else result, pivot)


def trace(name, outline, holes=(), smooth=0, pivot=(0.5, 0)):
    """Cuts along a hand-drawn outline. `smooth` rounds its corners, which suits people better than machines."""
    pts = np.array(outline)
    x0, y0 = pts.min(axis=0) - 2
    x1, y1 = pts.max(axis=0) + 2
    img = upscale(src[y0:y1, x0:x1])

    def scaled(poly):
        return [((np.array(poly) - (x0, y0)) * SCALE).astype(np.int32)]

    alpha = np.zeros(img.shape[:2], np.uint8)
    cv2.fillPoly(alpha, scaled(outline), 255)
    for hole in holes:
        cv2.fillPoly(alpha, scaled(hole), 0)
    if smooth:
        alpha = (cv2.GaussianBlur(alpha, (0, 0), smooth) > 127).astype(np.uint8) * 255
    alpha = cv2.GaussianBlur(alpha, (0, 0), 1.2)
    cut_origin[name] = (x0, y0)
    feet = np.where(alpha > 128)[0].max() + 2   # the pivot is the bottom edge, so nothing may hang below the feet
    save(name, np.dstack([img, alpha])[:feet], pivot)


# ---------- PEOPLE AND BIKES ----------
def cutouts():
    cut_out('npc_farmer', [(234, 274), (310, 274), (310, 358), (234, 358)])

    # These overlap other objects or sit on busy backgrounds, so they are traced by hand
    trace('npc_worker', [(176, 398), (176, 385), (180, 376), (186, 371), (196, 368), (206, 369), (213, 373), (219, 380), (222, 388), (226, 392),
                         (230, 386), (236, 385), (240, 388), (241, 398), (240, 408), (236, 412), (229, 412), (226, 417), (224, 423), (221, 433),
                         (225, 433), (225, 437), (222, 440), (220, 439), (217, 460), (214, 461), (218, 441), (213, 441), (211, 452), (212, 459),
                         (212, 462), (205, 463), (203, 461), (199, 461), (190, 463), (188, 460), (191, 452), (193, 446), (190, 440), (189, 433),
                         (192, 428), (195, 425), (191, 421), (188, 418), (186, 412), (182, 412), (178, 408), (177, 400)],
          holes=[[(219, 411), (223, 413), (222, 420), (219, 429), (214, 429), (213, 424), (218, 420)]], smooth=2)
    trace('npc_broker', [(51, 240), (52, 230), (58, 225), (65, 227), (72, 227), (82, 225), (92, 228), (100, 233), (106, 238), (105, 247), (104, 256),
                         (103, 262), (98, 263), (96, 268), (90, 272), (92, 276), (92, 280), (97, 282), (97, 286), (92, 288), (90, 292), (90, 300),
                         (89, 309), (92, 313), (88, 315), (84, 312), (83, 304), (82, 304), (82, 312), (80, 315), (76, 313), (78, 304), (76, 296),
                         (74, 288), (73, 281), (75, 274), (78, 271), (72, 268), (70, 262), (66, 262), (62, 258), (61, 252), (64, 250), (63, 247),
                         (56, 250), (52, 246)], smooth=2)
    trace('npc_tattooed_man', [(388, 331), (398, 333), (405, 340), (408, 350), (408, 362), (412, 361), (418, 362), (421, 370), (418, 378), (412, 382),
                               (410, 386), (404, 389), (399, 388), (399, 395), (397, 400), (395, 402), (394, 408), (397, 412), (396, 414), (388, 414),
                               (388, 408), (385, 410), (383, 414), (375, 414), (374, 411), (378, 408), (380, 402), (377, 400), (374, 396), (372, 395),
                               (370, 392), (364, 392), (366, 380), (369, 373), (366, 368), (367, 360), (369, 358), (369, 345), (372, 338), (380, 332)], smooth=2)
    trace('npc_firefighter', [(597, 328), (608, 320), (610, 312), (616, 304), (626, 298), (636, 297), (645, 300), (652, 308), (656, 318), (655, 324),
                              (656, 330), (654, 336), (652, 342), (648, 347), (642, 349), (640, 351), (640, 358), (637, 365), (633, 369), (631, 378),
                              (633, 383), (633, 387), (627, 388), (626, 384), (624, 388), (618, 388), (616, 384), (618, 376), (619, 362), (620, 352),
                              (622, 347), (616, 343), (612, 338), (611, 331), (604, 331), (598, 331)], smooth=2)
    trace('bike_sport', [(240, 447), (247, 439), (256, 436), (266, 436), (271, 442), (273, 451), (269, 457), (262, 459), (268, 463),
                         (280, 465), (283, 460), (290, 457), (298, 460), (300, 462), (301, 452), (303, 452), (307, 456), (310, 454),
                         (314, 458), (320, 466), (318, 469), (324, 472), (330, 478), (334, 487), (331, 496), (322, 501), (314, 501),
                         (308, 494), (302, 492), (301, 499), (298, 499), (296, 492), (290, 495), (275, 495), (270, 498), (258, 501),
                         (247, 497), (243, 488), (245, 476), (251, 472), (245, 471), (251, 461), (250, 458), (245, 455)])
    trace('bike_cub', [(546, 297), (549, 294), (556, 294), (557, 300), (556, 306), (561, 306), (562, 312), (563, 312), (567, 302), (570, 300),
                       (570, 302), (567, 305), (563, 316), (566, 320), (570, 326), (575, 328), (580, 326), (582, 320), (576, 319), (585, 309),
                       (594, 308), (598, 306), (604, 306), (605, 311), (600, 313), (604, 316), (606, 320), (598, 323), (599, 330), (607, 331),
                       (606, 340), (598, 345), (590, 343), (584, 345), (580, 341), (572, 342), (570, 341), (565, 340), (563, 338), (562, 345),
                       (553, 349), (545, 346), (542, 338), (545, 332), (544, 328), (550, 324), (550, 318), (545, 320), (543, 316), (543, 309),
                       (547, 306), (553, 306), (551, 300), (546, 299)])
    trace('bike_scooter', [(443, 290), (444, 283), (452, 279), (461, 281), (462, 286), (460, 288), (467, 292), (466, 295), (460, 293), (459, 296),
                           (462, 299), (468, 298), (474, 295), (490, 290), (503, 288), (512, 286), (516, 289), (511, 294), (513, 300), (517, 316),
                           (514, 331), (508, 338), (497, 342), (487, 340), (470, 340), (466, 342), (456, 342), (445, 340), (440, 336), (438, 328),
                           (431, 317), (431, 313), (440, 306), (440, 297)])


# ---------- TRAFFIC ----------
def over(canvas, img, x, y):
    h, w = img.shape[:2]
    area = canvas[y:y + h, x:x + w].astype(np.float32)
    a = img[..., 3:].astype(np.float32) / 255
    area[..., :3] = img[..., :3] * a + area[..., :3] * (1 - a)
    area[..., 3:] = 255 * a + area[..., 3:] * (1 - a)
    canvas[y:y + h, x:x + w] = area.astype(np.uint8)


def ride(name, bike, rider, waist, size, seat, shoulder, grip, sleeve, hubs, flip=False):
    """Puts the top of `rider` (down to `waist`, a fraction of its height) on `bike`, with one arm reaching `grip`.
    `seat`, `shoulder` and `grip` are pixels in the bike sprite after flipping; `hubs` are the wheels (x, y, radius)
    in source pixels. The result faces right."""
    bike_img = cv2.flip(cut[bike], 1) if flip else cut[bike]
    body = cut[rider][:int(cut[rider].shape[0] * waist)]
    body = cv2.resize(body, None, fx=size, fy=size, interpolation=cv2.INTER_AREA)
    top = max(body.shape[0] - seat[1], 0)
    left = max(body.shape[1] // 2 - seat[0], 0)
    h, w = bike_img.shape[:2]
    canvas = np.zeros((h + top, max(w + left, seat[0] + left + body.shape[1]), 4), np.uint8)
    over(canvas, body, left + seat[0] - body.shape[1] // 2, top + seat[1] - body.shape[0])
    over(canvas, bike_img, left, top)

    shoulder = (left + shoulder[0], top + shoulder[1])
    hand = (left + grip[0], top + grip[1])
    layer = np.zeros_like(canvas)
    cv2.line(layer, shoulder, hand, (30, 40, 50, 255), 13, cv2.LINE_AA)
    cv2.line(layer, shoulder, hand, (*sleeve, 255), 8, cv2.LINE_AA)
    over(canvas, layer, 0, 0)
    save(name, canvas)

    # Wheel centers relative to the sprite's bottom-center pivot, in sprite pixels
    row = [name]
    for x, y, radius in hubs:
        px, py = (x - cut_origin[bike][0]) * SCALE, (y - cut_origin[bike][1]) * SCALE
        row += [left + (w - px if flip else px) - canvas.shape[1] / 2, canvas.shape[0] - (top + py), radius * SCALE]
    wheels.append(','.join(str(v) for v in row))


def traffic():
    ride('traffic_sport', 'bike_sport', 'npc_firefighter', 0.8, 0.8, (108, 80), (118, 46), (196, 70), (110, 50, 30), [(257, 486, 14), (320, 487, 14)])
    ride('traffic_cub', 'bike_cub', 'npc_farmer', 0.85, 0.75, (68, 56), (84, 42), (172, 22), (170, 200, 240), [(554, 338, 11), (596, 335, 10)], flip=True)
    ride('traffic_scooter', 'bike_scooter', 'npc_tattooed_man', 0.8, 0.75, (108, 44), (118, 16), (196, 30), (140, 190, 235), [(447, 328, 12), (497, 330, 11)], flip=True)


# ---------- HOME ROW (second source image) ----------
def home_row():
    cut_out('npc_cap_man', [(158, 402), (216, 402), (216, 494), (158, 494)])
    cut_out('npc_girl', [(620, 372), (682, 372), (682, 462), (620, 462)], flip=True)


# ---------- ANIMATION ----------
# Legs of each person, in sprite pixels: top row of the legs, measured up from the feet, then their left and right edge
LEGS = {
    'npc_worker': (61, 45, 115), 'npc_farmer': (41, 51, 95), 'npc_firefighter': (66, 63, 115), 'npc_tattooed_man': (46, 41, 106),
    'npc_broker': (43, 83, 128), 'npc_cap_man': (46, 31, 91), 'npc_girl': (41, 51, 111),
}
STRIDE, FOOT_LIFT = 15, 10


def leg(sprite, x0, x1, hip, shear, lift):
    """One leg on a canvas of the sprite's size: pivots at the hip, swings by `shear` and shortens by `lift`."""
    h, w = sprite.shape[:2]
    part = np.zeros_like(sprite)
    part[hip:, x0:x1] = sprite[hip:, x0:x1]
    length = h - hip
    squash = (length - lift) / length
    matrix = np.float32([[1, shear / length, -shear * hip / length], [0, squash, hip * (1 - squash)]])
    return cv2.warpAffine(part, matrix, (w, h), flags=cv2.INTER_LINEAR)


def walk_frames():
    """The art has one pose, so the two steps are made by opening the legs like scissors and lifting one foot."""
    for name, (height, x0, x1) in LEGS.items():
        sprite = cut[name]
        hip = sprite.shape[0] - height
        middle = (x0 + x1) // 2
        for step, (lift_left, lift_right) in enumerate(((FOOT_LIFT, 0), (0, FOOT_LIFT)), 1):
            frame = sprite.copy()
            frame[hip:, x0:x1] = 0
            over(frame, leg(sprite, x0, middle, hip, -STRIDE, lift_left), 0, 0)
            over(frame, leg(sprite, middle, x1, hip, STRIDE, lift_right), 0, 0)
            save(f'{name}_step{step}', frame)


def wheel_spin():
    """A see-through set of spokes that turns on top of any wheel."""
    size = 128
    img = np.zeros((size, size, 4), np.uint8)
    for angle, color in ((0, (235, 235, 235, 150)), (90, (30, 30, 30, 130)), (180, (235, 235, 235, 150)), (270, (30, 30, 30, 130))):
        cv2.ellipse(img, (size // 2, size // 2), (50, 50), angle, 0, 52, color, 9, cv2.LINE_AA)
        cv2.ellipse(img, (size // 2, size // 2), (28, 28), angle + 20, 0, 60, color, 6, cv2.LINE_AA)
    save('wheel_spin', img, (0.5, 0.5))


cutouts()
traffic()
src = cv2.imread(str(SOURCE_HOME))
home_row()
walk_frames()
wheel_spin()
(OUT_DIR / 'street_wheels.txt').write_text('\n'.join(wheels) + '\n')
(OUT_DIR / 'street_sprites.txt').write_text('\n'.join(manifest) + '\n')
print(f'{len(manifest)} sprites written to {OUT_DIR}')
