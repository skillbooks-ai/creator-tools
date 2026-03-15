#!/usr/bin/env bash
# account.sh — Show Skillbooks account status
# Usage: skillbook account [--key <api-key>]
#
# Shows:
#   - Credit balance
#   - Account type (buyer / publisher / both)
#   - Publisher earnings summary (if applicable)
#
# Requires a Skillbooks API key. Set SKILLBOOK_KEY env var or pass --key.

set -euo pipefail

API_KEY="${SKILLBOOK_KEY:-}"
API_BASE="${SKILLBOOK_API:-https://skillbooks.ai/api}"

for arg in "$@"; do
  case "$arg" in
    --key)   shift; API_KEY="${1:-}"; shift ;;
    --help|-h)
      echo "Usage: skillbook account [--key <api-key>]"
      echo ""
      echo "Show your Skillbooks credit balance, account type, and publisher status."
      echo ""
      echo "Set SKILLBOOK_KEY env var or pass --key."
      exit 0
      ;;
  esac
done

echo ""
echo "═══════════════════════════════════════════"
echo "  Skillbooks Account"
echo "═══════════════════════════════════════════"
echo ""

if [[ -z "$API_KEY" ]]; then
  echo "  ⚠️  No API key provided."
  echo ""
  echo "  Add your key to .env.local:"
  echo "    SKILLBOOK_KEY=sk_..."
  echo ""
  echo "  Or pass it directly:"
  echo "    skillbook account --key sk_..."
  echo ""
  echo "  Don't have an account yet?"
  echo "    Run: skillbook signup"
  echo ""
  exit 1
fi

# Query the account endpoint
response=$(curl -sf -H "X-Skillbook-Key: $API_KEY" "$API_BASE/account" 2>/dev/null) || {
  echo "  ❌ Could not reach Skillbooks API."
  echo "     Check your API key and network connection."
  echo ""
  echo "     API: $API_BASE/account"
  echo ""
  exit 1
}

# Parse response (expects JSON with balance, type, publisher fields)
python3 << 'PYEOF' "$response"
import sys, json

try:
    data = json.loads(sys.argv[1])
except (json.JSONDecodeError, IndexError):
    print("  ❌ Invalid response from API")
    sys.exit(1)

balance = data.get('balance', 0)
balance_dollars = balance / 1000  # microdollars → dollars
account_type = data.get('type', 'buyer')
email = data.get('email', 'unknown')

print(f"  📧 {email}")
print(f"  💰 Balance: ${balance_dollars:.2f} ({balance:,} microdollars)")
print(f"  🏷️  Type: {account_type}")
print()

if account_type in ('publisher', 'both'):
    books = data.get('books_published', 0)
    earnings = data.get('total_earnings', 0)
    earnings_dollars = earnings / 1000
    print(f"  📚 Books published: {books}")
    print(f"  💵 Total earnings: ${earnings_dollars:.2f}")
    print()
elif account_type == 'buyer':
    print("  📝 Want to publish? Your skillbooks earn 80% revenue.")
    print("     Run: skillbook signup → choose 'Start publishing'")
    print()
PYEOF

echo "═══════════════════════════════════════════"
echo ""
