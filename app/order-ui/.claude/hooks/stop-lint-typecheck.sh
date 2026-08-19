#!/bin/bash
# Hook: stop-lint-typecheck
# Runs once when Claude finishes a response.
# If any TS/TSX files were edited this session, runs lint + typecheck.
# Uses the temp file written by post-edit-track.sh.

TEMP_FILE="/tmp/.claude-ts-edited-$(basename "$PWD")"

# Nothing to check if no TS files were edited
if [ ! -f "$TEMP_FILE" ]; then
  exit 0
fi

# Get unique edited files
edited_files=$(sort -u "$TEMP_FILE")
file_count=$(echo "$edited_files" | wc -l | tr -d ' ')

echo "Running lint + typecheck ($file_count file(s) edited this session)..."

# Run ESLint on edited files only (fast)
lint_output=$(echo "$edited_files" | xargs npx eslint --max-warnings=0 2>&1)
lint_exit=$?

if [ $lint_exit -ne 0 ]; then
  echo "ESLint errors:"
  echo "$lint_output" | head -30
  echo ""
  echo "Run 'npm run lint' for full output."
  rm -f "$TEMP_FILE"
  exit 1
fi

# Run TypeScript check (full project — catches cross-file errors)
ts_output=$(npx tsc -b --noEmit 2>&1)
ts_exit=$?

# Clean up temp file
rm -f "$TEMP_FILE"

if [ $ts_exit -ne 0 ]; then
  echo "TypeScript errors:"
  echo "$ts_output" | grep -E 'error TS|\.tsx?.*error' | head -25
  echo ""
  echo "Run 'npx tsc -b' for full output."
  exit 1
fi

echo "Lint + TypeScript OK"
exit 0
