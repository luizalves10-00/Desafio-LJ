import re

with open('slides/pitch-deck-5min.html', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'<section class="slide[^"]*"\s+data-chapter="([^"]*)"\s+data-title="([^"]*)".*?<aside class="notes">(.*?)</aside>'
matches = re.findall(pattern, content, re.DOTALL)

for i, (chap, title, notes) in enumerate(matches, 1):
    print(f"### SLIDE {i:02d} [{chap}] - {title}")
    clean_notes = notes.strip()
    print(clean_notes)
    print("\n" + "="*70 + "\n")
