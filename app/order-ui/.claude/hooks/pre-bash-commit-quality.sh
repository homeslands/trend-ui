#!/bin/bash
# Hook: pre-bash-commit-quality
# Before any `git commit`, checks that staged TS/TSX files
# do not contain console.log statements (eslint-disable comments are OK).

input=$(cat)
command=$(echo "$input" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('command', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")

# Only apply to git commit commands
if ! echo "$command" | grep -qE 'git\s+commit'; then
  exit 0
fi

# Get staged TS/TSX files
staged_files=$(git diff --cached --name-only 2>/dev/null | grep -E '\.(ts|tsx)$')

if [ -z "$staged_files" ]; then
  exit 0
fi

# Check for console.log not guarded by eslint-disable
found=""
while IFS= read -r file; do
  if grep -qE '^[^/]*console\.log' "$file" 2>/dev/null; then
    found="$found\n  - $file"
  fi
done <<< "$staged_files"

if [ -n "$found" ]; then
  echo "Blocked: console.log found in staged files:"
  echo -e "$found"
  echo ""
  echo "Remove all console.log statements before committing."
  echo "If intentional, wrap with: // eslint-disable-next-line no-console"
  exit 2
fi

exit 0
