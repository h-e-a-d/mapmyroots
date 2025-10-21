#!/bin/bash
# Download Google Fonts locally for self-hosting
# This improves performance by ~300-500ms and enhances privacy

FONT_DIR="assets/fonts"
cd "$(dirname "$0")/.." || exit

mkdir -p "$FONT_DIR"

echo "╔════════════════════════════════════════╗"
echo "║   Downloading Google Fonts Locally     ║"
echo "╚════════════════════════════════════════╝"
echo ""

echo "Target directory: $FONT_DIR"
echo ""

# Function to download with progress
download_font() {
  local name=$1
  local filename=$2
  local url=$3

  echo "📥 Downloading $name..."
  if curl -# -o "$FONT_DIR/$filename" "$url"; then
    size=$(ls -lh "$FONT_DIR/$filename" | awk '{print $5}')
    echo "   ✓ Saved: $filename ($size)"
  else
    echo "   ✗ Failed to download $name"
    return 1
  fi
}

# Inter Font Family
download_font "Inter 400 (Regular)" "inter-v12-latin-400.woff2" \
  "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"

download_font "Inter 600 (SemiBold)" "inter-v12-latin-600.woff2" \
  "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2"

download_font "Inter 700 (Bold)" "inter-v12-latin-700.woff2" \
  "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiA.woff2"

# Playfair Display Font Family
download_font "Playfair Display 600" "playfair-display-v30-latin-600.woff2" \
  "https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDZaJg.woff2"

download_font "Playfair Display 700" "playfair-display-v30-latin-700.woff2" \
  "https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKe3vXDZaJg.woff2"

# Roboto Font Family
download_font "Roboto 400" "roboto-v30-latin-400.woff2" \
  "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2"

download_font "Roboto 500" "roboto-v30-latin-500.woff2" \
  "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9fBBc4AMP6lQ.woff2"

echo ""
echo "═══════════════════════════════════════"
echo "📊 Download Summary"
echo "═══════════════════════════════════════"

total_size=$(du -sh "$FONT_DIR" | awk '{print $1}')
file_count=$(ls -1 "$FONT_DIR"/*.woff2 2>/dev/null | wc -l | tr -d ' ')

echo "  Files downloaded: $file_count"
echo "  Total size: $total_size"
echo "  Location: $FONT_DIR/"
echo ""

echo "✅ Font download complete!"
echo ""
echo "Next steps:"
echo "  1. Check fonts.css is configured correctly"
echo "  2. Update index.html to use assets/fonts/fonts.css"
echo "  3. Update builder.html to use assets/fonts/fonts.css"
echo "  4. Remove Google Fonts CDN links from HTML"
echo "  5. Update CSP headers to remove googleapis.com"
echo ""
echo "See docs/FONT_SELF_HOSTING_GUIDE.md for detailed instructions"
