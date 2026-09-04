import os
import base64
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

source_path = 'mobile/assets/FallTrack new logo.png'
im = Image.open(source_path).convert('RGBA')
w, h = im.size
rgb = np.array(im.convert('RGB'))

# Flood-fill from borders to remove off-white background
visited = np.zeros((h, w), dtype=bool)
queue = deque([(0, 0), (w-1, 0), (0, h-1), (w-1, h-1),
               (w//2, 0), (0, h//2), (w-1, h//2), (w//2, h-1)])
for x, y in queue:
    visited[y, x] = True

while queue:
    x, y = queue.popleft()
    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        nx, ny = x + dx, y + dy
        if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx]:
            p = rgb[ny, nx]
            if p[0] > 225 and p[1] > 225 and p[2] > 225:
                visited[ny, nx] = True
                queue.append((nx, ny))

alpha = np.where(visited, 0, 255).astype(np.uint8)
alpha_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(radius=1.2))
im.putalpha(alpha_img)

# Crop to squircle bbox
bbox = im.getbbox()
cropped_logo = im.crop(bbox)
lw, lh = cropped_logo.size
max_dim = max(lw, lh)
square_logo = Image.new('RGBA', (max_dim, max_dim), (0, 0, 0, 0))
square_logo.paste(cropped_logo, ((max_dim - lw) // 2, (max_dim - lh) // 2))

def create_canvas_icon(canvas_size, logo_size):
    resized = square_logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    offset = (canvas_size - logo_size) // 2
    canvas.paste(resized, (offset, offset), resized)
    return canvas

# 1. Update public/logo.png and dist/logo.png
fav_icon = create_canvas_icon(512, 460)
fav_icon.save('public/logo.png', 'PNG')
fav_icon.save('public/favicon.png', 'PNG')
fav_icon.save('mobile/assets/favicon.png', 'PNG')
fav_icon.save('mobile/assets/icon.png', 'PNG')

if os.path.exists('dist'):
    fav_icon.save('dist/logo.png', 'PNG')
    fav_icon.save('dist/favicon.png', 'PNG')

print('Saved public/logo.png, public/favicon.png, mobile/assets/icon.png, etc.')

# 2. Update public/favicon.svg embedding new logo
with open('public/favicon.png', 'rb') as f:
    b64_png = base64.b64encode(f.read()).decode('ascii')

svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <image href="data:image/png;base64,{b64_png}" width="512" height="512"/>
</svg>'''

with open('public/favicon.svg', 'w', encoding='utf-8') as f:
    f.write(svg_content)
if os.path.exists('dist/favicon.svg'):
    with open('dist/favicon.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)

print('Updated public/favicon.svg')

# 3. Create monochrome icons
# For Android themed icons: grayscale / white silhouette of the squircle logo
def create_monochrome_icon(canvas_size, logo_size):
    base = create_canvas_icon(canvas_size, logo_size)
    arr = np.array(base)
    # Convert RGB to grayscale
    gray = (0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]).astype(np.uint8)
    arr[:, :, 0] = gray
    arr[:, :, 1] = gray
    arr[:, :, 2] = gray
    return Image.fromarray(arr)

mono_512 = create_monochrome_icon(512, 338)
mono_512.save('mobile/assets/android-icon-monochrome.png', 'PNG')
print('Updated mobile/assets/android-icon-monochrome.png')

densities = {
    'mipmap-mdpi': 108,
    'mipmap-hdpi': 162,
    'mipmap-xhdpi': 216,
    'mipmap-xxhdpi': 324,
    'mipmap-xxxhdpi': 432,
}

for folder, fg_size in densities.items():
    dir_path = os.path.join('mobile', 'android', 'app', 'src', 'main', 'res', folder)
    if not os.path.exists(dir_path):
        continue
    logo_size = int(fg_size * (338 / 512))
    mono = create_monochrome_icon(fg_size, logo_size)
    mono.save(os.path.join(dir_path, 'ic_launcher_monochrome.webp'), 'WEBP')
    print(f'Updated {folder}/ic_launcher_monochrome.webp')

print('All system assets generated successfully!')
