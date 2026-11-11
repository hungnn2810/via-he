# Where a sprite lives under Assets/Resources/Sprites, from the prefix rules in sprite-folders.json.
# Shared by cut_street.py and import_scene.py (the JS exporter uses sprite-paths.mjs).
import json
from pathlib import Path

_RULES = json.loads((Path(__file__).resolve().parent / 'sprite-folders.json').read_text(encoding='utf-8'))['rules']


def sprite_folder(name):
    """Folder for a sprite id ('' = Sprites root)."""
    for prefix, folder in _RULES:
        if name.startswith(prefix):
            return folder
    return ''


def sprite_id(name):
    """Manifest id for a sprite: 'character/body_female'."""
    folder = sprite_folder(name)
    return f'{folder}/{name}' if folder else name


def png_path(out_dir, name):
    """Full path of a sprite PNG; makes its folder."""
    path = out_dir / sprite_folder(name) / f'{name}.png'
    path.parent.mkdir(parents=True, exist_ok=True)
    return path
