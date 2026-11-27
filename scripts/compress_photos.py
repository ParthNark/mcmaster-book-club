"""Shrink uploaded photos so the Past Events and Our Team pages stay fast.

Any JPEG/PNG/WebP under the given folders that is wider or taller than
MAX_SIDE, or larger than MAX_BYTES, is resized to fit MAX_SIDE and saved as a
JPEG (quality 80, EXIF rotation applied, metadata stripped). JPEGs keep their
name; a PNG/WebP becomes <name>.jpg and its path is updated in data/*.json.
Photos already small enough are left untouched, so running it twice is safe.

Usage: python scripts/compress_photos.py [images/events images/ourteam ...]
"""
import glob
import io
import os
import sys

from PIL import Image, ImageOps

MAX_SIDE = 1600
MAX_BYTES = 600 * 1024
EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}


def compress(path):
    """Return the new path if the photo was rewritten, else None."""
    size = os.path.getsize(path)
    with Image.open(path) as im:
        too_big = max(im.size) > MAX_SIDE
        if not too_big and size <= MAX_BYTES:
            return None
        im = ImageOps.exif_transpose(im)
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        buf = io.BytesIO()
        im.convert('RGB').save(buf, 'JPEG', quality=80, optimize=True, progressive=True)
    data = buf.getvalue()
    if not too_big and len(data) >= size:
        return None  # re-saving wouldn't make it smaller

    base, ext = os.path.splitext(path)
    new_path = path if ext.lower() in ('.jpg', '.jpeg') else base + '.jpg'
    if new_path != path and os.path.exists(new_path):
        new_path = base + '-photo.jpg'
    with open(new_path, 'wb') as f:
        f.write(data)
    if new_path != path:
        os.remove(path)
    print(f'{path}: {size // 1024} KB -> {new_path} {len(data) // 1024} KB')
    return new_path


def main(roots, data_files):
    renamed = {}
    changed = 0
    for root in roots:
        for dirpath, _, files in os.walk(root):
            for name in sorted(files):
                if os.path.splitext(name)[1].lower() not in EXTENSIONS:
                    continue
                path = os.path.join(dirpath, name)
                new_path = compress(path)
                if new_path:
                    changed += 1
                    if new_path != path:
                        renamed['/' + path.replace(os.sep, '/')] = '/' + new_path.replace(os.sep, '/')

    for data_file in data_files if renamed else []:
        with open(data_file, encoding='utf-8') as f:
            text = f.read()
        updated = text
        for old, new in renamed.items():
            updated = updated.replace('"' + old + '"', '"' + new + '"')
        if updated != text:
            with open(data_file, 'w', encoding='utf-8') as f:
                f.write(updated)
            print(f'Updated photo paths in {data_file}')
    print(f'{changed} photo(s) compressed')


if __name__ == '__main__':
    main(sys.argv[1:] or ['images/events', 'images/ourteam', 'images/covers'], sorted(glob.glob('data/*.json')))
