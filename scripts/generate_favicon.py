# -*- coding: utf-8 -*-
"""
Gera os favicons do LevelUp Study em SVG, ICO e PNG em alta resolução.
"""
import os
from PIL import Image, ImageDraw, ImageFont

def generate_svg():
    svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1f143d"/>
      <stop offset="100%" stop-color="#0a0614"/>
    </linearGradient>
    <linearGradient id="gold_purple" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="45%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#c084fc"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#f59e0b" flood-opacity="0.35"/>
    </filter>
  </defs>
  <!-- Squircle Base -->
  <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#bg)" stroke="#8b5cf6" stroke-width="2.5"/>
  <!-- Monograma LU LevelUp Study -->
  <g filter="url(#glow)">
    <!-- L -->
    <path d="M16 17 H23 V40 H34 V47 H16 Z" fill="url(#gold_purple)"/>
    <!-- U -->
    <path d="M36 17 H43 V38 C43 40.5 41.5 42.5 38.5 42.5 C35.5 42.5 34 40.5 34 38 V28 H27 V38 C27 45 32 47 38.5 47 C45 47 50 44 50 38 V17 Z" fill="url(#gold_purple)"/>
    <!-- Spark / Estrela Heroica -->
    <polygon points="50,12 51.5,15.5 55,17 51.5,18.5 50,22 48.5,18.5 45,17 48.5,15.5" fill="#fef08a"/>
  </g>
</svg>'''
    return svg_content

def generate_raster_favicons(target_dirs):
    # Renderiza imagem raster para .ico e .png usando Pillow
    sizes = [16, 32, 48, 64, 128, 192, 512]
    base_size = 512
    img = Image.new("RGBA", (base_size, base_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Cores
    bg_color = (25, 16, 48, 255)
    border_color = (139, 92, 246, 255)

    # Desenha retângulo arredondado (Squircle)
    margin = 16
    draw.rounded_rectangle(
        [margin, margin, base_size - margin, base_size - margin],
        radius=120,
        fill=bg_color,
        outline=border_color,
        width=16
    )

    # Desenha L e U estilizados
    # L
    draw.polygon([(128, 136), (184, 136), (184, 320), (280, 320), (280, 376), (128, 376)], fill=(245, 158, 11, 255))
    # U
    draw.polygon([(296, 136), (352, 136), (352, 320), (384, 320), (384, 136), (440, 136), (440, 330), (410, 376), (326, 376), (296, 330)], fill=(251, 191, 36, 255))
    # Estrela / Spark
    star_points = [
        (400, 100), (412, 128), (440, 140), (412, 152),
        (400, 180), (388, 152), (360, 140), (388, 128)
    ]
    draw.polygon(star_points, fill=(254, 240, 138, 255))

    for directory in target_dirs:
        os.makedirs(directory, exist_ok=True)
        # Salva PNG 192 e 512
        img.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(directory, "favicon-192.png"))
        img.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(directory, "favicon-512.png"))
        img.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(directory, "favicon-32x32.png"))

        # Salva multi-size .ico
        icon_sizes = [(16, 16), (32, 32), (48, 48)]
        ico_images = [img.resize(s, Image.Resampling.LANCZOS) for s in icon_sizes]
        ico_images[0].save(
            os.path.join(directory, "favicon.ico"),
            format="ICO",
            sizes=icon_sizes,
            append_images=ico_images[1:]
        )
        print(f"[OK] Favicons raster gerados em: {directory}")

if __name__ == "__main__":
    svg = generate_svg()
    targets = [
        os.path.abspath("front_end"),
        os.path.abspath("front_end/assets"),
        os.path.abspath("../levelup-study-prod/front_end"),
        os.path.abspath("../levelup-study-prod/front_end/assets"),
    ]
    for d in targets:
        os.makedirs(d, exist_ok=True)
        svg_path = os.path.join(d, "favicon.svg")
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(svg)
        print(f"[OK] favicon.svg salvo em: {svg_path}")

    generate_raster_favicons(targets)
    print("SUCCESS: Todos os favicons foram gerados com sucesso!")
