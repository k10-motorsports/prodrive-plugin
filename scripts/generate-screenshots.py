#!/usr/bin/env python3
"""Generate placeholder screenshot PNGs for marketing page."""

from PIL import Image, ImageDraw, ImageFont
import os

# Output directory
OUTPUT_DIR = 'web/public/screenshots'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Dark background color
BG_COLOR = '#0a0a14'
TEXT_COLOR = '#ffffff'

# Module screenshots
MODULES = [
    ('tacho', 'Tachometer', (800, 400)),
    ('pedals', 'Driver Inputs', (800, 400)),
    ('fuel', 'Race Strategy', (800, 400)),
    ('maps', 'Track Map', (800, 400)),
    ('position', 'Race Position', (800, 400)),
    ('leaderboard', 'Leaderboard', (800, 400)),
    ('commentary', 'AI Commentary', (800, 400)),
    ('datastream', 'Datastream', (800, 400)),
    ('pitbox', 'Pit Box', (800, 400)),
    ('incidents', 'Incidents', (800, 400)),
    ('race-control', 'Race Control', (800, 400)),
    ('formation', 'Formation', (800, 400)),
]

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_screenshot(filename, width, height, text):
    """Create a simple placeholder screenshot."""
    bg_rgb = hex_to_rgb(BG_COLOR)
    text_rgb = hex_to_rgb(TEXT_COLOR)

    img = Image.new('RGB', (width, height), bg_rgb)
    draw = ImageDraw.Draw(img)

    # Try to use a default font, fall back to default if not available
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32)
    except:
        font = ImageFont.load_default()

    # Get text bounding box to center it
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (width - text_width) // 2
    y = (height - text_height) // 2

    draw.text((x, y), text, fill=text_rgb, font=font)

    img.save(filename)
    print(f"Created {filename}")

# Generate all module screenshots
for module_id, module_name, size in MODULES:
    filename = os.path.join(OUTPUT_DIR, f'{module_id}.png')
    create_screenshot(filename, size[0], size[1], module_name)

# Generate full dashboard screenshot
filename = os.path.join(OUTPUT_DIR, 'dashboard-full.png')
create_screenshot(filename, 1200, 330, 'RaceCor.io Dashboard')

# Generate OG image
filename = os.path.join(OUTPUT_DIR, 'og-image.png')
create_screenshot(filename, 1200, 630, 'RaceCor.io - Broadcast-Grade Sim Racing HUD')

print(f"\nAll screenshots generated in {OUTPUT_DIR}")
