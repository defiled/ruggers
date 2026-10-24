# Brand assets

Frederick RFC has no official mascot (not the Steamrollers). The crest for now is the church-steeples logo, "Frederick RFC · Founded 1990".

- `frederick-rfc-steeples-logo.svg`: the logo as supplied. It is an SVG wrapper around a 1254×1254 PNG, so treat it as a raster source.
- `og-card.html`: the 1200×630 share-card layout rendered to `public/og.png`.

## Regenerate (macOS)

```bash
# 1. Pull the PNG out of the SVG
python3 -c "import re,base64;s=open('brand/frederick-rfc-steeples-logo.svg').read();open('/tmp/logo.png','wb').write(base64.b64decode(re.search(r'base64,([^\"]+)',s).group(1)))"

# 2. Icon sizes (favicon.ico was supplied separately and is copied as-is)
sips -Z 512 /tmp/logo.png --out public/icon-512.png
sips -Z 192 /tmp/logo.png --out public/icon-192.png
sips -Z 180 /tmp/logo.png --out public/apple-touch-icon.png
cwebp -q 85 -alpha_q 100 public/icon-512.png -o public/logo.webp   # brew install webp

# 3. Share card
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1200,630 --screenshot="$PWD/public/og.png" "file://$PWD/brand/og-card.html"
```

Optionally shrink the PNGs with pngcrush (ships with Xcode): `xcrun pngcrush -reduce -brute in.png out.png`.

## Typeface

The UI is set in Inter (SIL Open Font License), self-hosted as the latin and latin-ext variable subsets in `public/fonts/`. They were saved from the Google Fonts CSS2 endpoint; the full family is at github.com/rsms/inter if a wider subset is ever needed.
