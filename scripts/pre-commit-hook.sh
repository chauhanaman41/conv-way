#!/usr/bin/env bash
# Conv-way Pre-Commit Hook: Secret Leak Prevention
# Blocks commits if staged files contain API key patterns

echo "[Security] Checking staged files for exposed API keys..."

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

FAILED=0

for FILE in $STAGED_FILES; do
  # Skip checking rules-enforcement test itself or binary files
  if [[ "$FILE" == *"rules-enforcement.test.ts"* ]] || [[ "$FILE" == *".png"* ]] || [[ "$FILE" == *".jpg"* ]] || [[ "$FILE" == *".jpeg"* ]]; then
    continue
  fi

  # Check for Google API Key (AIza...)
  if git diff --cached "$FILE" | grep -E "^\+.*AIza[0-9A-Za-z\-_]{35}" > /dev/null 2>&1; then
    echo "ERROR: Staged file $FILE contains a Google API Key pattern (AIza...)."
    FAILED=1
  fi

  # Check for Tavily Key (tvly-...)
  if git diff --cached "$FILE" | grep -E "^\+.*tvly-[0-9A-Za-z\-_]{15,}" > /dev/null 2>&1; then
    echo "ERROR: Staged file $FILE contains a Tavily API Key pattern (tvly-...)."
    FAILED=1
  fi

  # Check for Exa Key next to key name
  if git diff --cached "$FILE" | grep -Ei "^\+.*(exaApiKey|EXA_API_KEY|exaKey)\s*[:=]\s*['\"]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" > /dev/null 2>&1; then
    echo "ERROR: Staged file $FILE contains an Exa API Key pattern."
    FAILED=1
  fi
done

if [ $FAILED -ne 0 ]; then
  echo ""
  echo "Commit rejected: Exposed secrets detected in staged files."
  echo "Please remove secrets, store them in .dev.vars or use environment variables, and try again."
  exit 1
fi

echo "[Security] Pre-commit secret check passed."
exit 0

