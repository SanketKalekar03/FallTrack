import os
import glob
from collections import deque
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

source_path = 'mobile/assets/FallTrack new logo.png'
im = Image.open(source_path).convert('RGBA')
w, h = im.size
rgb = np.array(im.convert('RGB'))

# Flood-fill from borders/corners to find external white background
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

# Make a clean square logo
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

# Save favicons
fav_icon = create_canvas_icon(512, 460)
fav_icon.save('mobile/assets/favicon.png', 'PNG')
fav_icon.save('public/favicon.png', 'PNG')
print('Updated mobile/assets/favicon.png and public/favicon.png')

if os.path.exists('dist'):
    fav_icon.save('dist/favicon.png', 'PNG')
    print('Updated dist/favicon.png')

# Save main app icon
app_icon = create_canvas_icon(512, 460)
app_icon.save('mobile/assets/icon.png', 'PNG')
print('Updated mobile/assets/icon.png')

# Save android adaptive foreground
fg_icon = create_canvas_icon(512, 338)
fg_icon.save('mobile/assets/android-icon-foreground.png', 'PNG')
print('Updated mobile/assets/android-icon-foreground.png')

# Update android mipmap resources
densities = {
    'mipmap-mdpi': (48, 108),
    'mipmap-hdpi': (72, 162),
    'mipmap-xhdpi': (96, 216),
    'mipmap-xxhdpi': (144, 324),
    'mipmap-xxxhdpi': (192, 432),
}

for folder, (launcher_size, fg_size) in densities.items():
    dir_path = os.path.join('mobile', 'android', 'app', 'src', 'main', 'res', folder)
    if not os.path.exists(dir_path):
        continue
    
    fg_logo_size = int(fg_size * (338 / 512))
    fg = create_canvas_icon(fg_size, fg_logo_size)
    fg.save(os.path.join(dir_path, 'ic_launcher_foreground.webp'), 'WEBP')
    
    bg_file = os.path.join(dir_path, 'ic_launcher_background.webp')
    if os.path.exists(bg_file):
        bg = Image.open(bg_file).convert('RGBA').resize((launcher_size, launcher_size), Image.Resampling.LANCZOS)
    else:
        bg = Image.new('RGBA', (launcher_size, launcher_size), (230, 244, 254, 255))
    
    comp_fg = fg.resize((launcher_size, launcher_size), Image.Resampling.LANCZOS)
    comp = Image.alpha_composite(bg, comp_fg)
    
    # Round mask
    mask_round = Image.new('L', (launcher_size * 4, launcher_size * 4), 0)
    draw = ImageDraw.Draw(mask_round)
    draw.ellipse((0, 0, launcher_size * 4, launcher_size * 4), fill=255)
    mask_round = mask_round.resize((launcher_size, launcher_size), Image.Resampling.LANCZOS)
    
    round_icon = comp.copy()
    round_icon.putalpha(mask_round)
    round_icon.save(os.path.join(dir_path, 'ic_launcher_round.webp'), 'WEBP')
    
    # Standard launcher squircle mask
    corner_r = int(launcher_size * 0.22)
    mask_sq = Image.new('L', (launcher_size * 4, launcher_size * 4), 0)
    draw_sq = ImageDraw.Draw(mask_sq)
    draw_sq.rounded_rectangle((0, 0, launcher_size * 4, launcher_size * 4), radius=corner_r * 4, fill=255)
    mask_sq = mask_sq.resize((launcher_size, launcher_size), Image.Resampling.LANCZOS)
    
    std_icon = comp.copy()
    std_icon.putalpha(mask_sq)
    std_icon.save(os.path.join(dir_path, 'ic_launcher.webp'), 'WEBP')
    print(f'Updated Android {folder}')

print('All icons generated successfully!')
