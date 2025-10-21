#!/bin/bash
# Script to find and report all innerHTML usages that need sanitization
# This helps identify security vulnerabilities

echo "==================================="
echo "innerHTML Security Audit"
echo "==================================="
echo ""

echo "Scanning for innerHTML usages in src directory..."
echo ""

# Find all .innerHTML = usages
echo "Files with .innerHTML assignments:"
grep -rn "\.innerHTML\s*=" src/ --include="*.js" | grep -v "\.innerHTML = ''" | grep -v "\.innerHTML = \"\"" | while read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  linenum=$(echo "$line" | cut -d: -f2)
  content=$(echo "$line" | cut -d: -f3-)

  # Check if it's using SecurityUtils.safeSetInnerHTML
  if echo "$content" | grep -q "SecurityUtils.safeSetInnerHTML\|SecurityUtils.sanitizeHTML"; then
    echo "  ✓ $file:$linenum - SAFE (using SecurityUtils)"
  else
    echo "  ⚠️  $file:$linenum - NEEDS FIX"
    echo "      $content"
  fi
done

echo ""
echo "==================================="
echo "Recommended Actions:"
echo "==================================="
echo "1. Replace direct innerHTML assignments with SecurityUtils.safeSetInnerHTML()"
echo "2. Example:"
echo "   OLD: element.innerHTML = '<div>content</div>';"
echo "   NEW: SecurityUtils.safeSetInnerHTML(element, '<div>content</div>');"
echo ""
echo "3. For user input, always use SecurityUtils.sanitizeText() first"
echo ""
