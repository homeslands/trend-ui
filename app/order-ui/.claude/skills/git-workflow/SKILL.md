---
name: git-workflow
description: Trigger when creating commits, writing commit messages, naming branches, preparing PRs, or resolving merge conflicts. Enforces consistent Git conventions so history stays readable and CI stays green.
---

# Git Workflow — order-ui

## Branch Naming

Branches follow the Jira ticket format:

```
feature/TRE-XXX-FE-<description>       feature/TRE-398-FE-Setup-Printer-System
bugfix/TRE-XXX-FE-<description>        bugfix/TRE-412-FE-Fix-payment-callback
hotfix/<version>-<description>         hotfix/2.1.1-printer-crash
```

**Rules:**
- Lowercase, hyphens only — no underscores
- Always include the ticket ID: `TRE-XXX`
- FE prefix for frontend changes, BE for backend (when working in this repo it's always FE)
- Base feature and bugfix branches off `main`

## 1. New Feature

```bash
git checkout main
git pull origin main
git checkout -b feature/TRE-XXX-FE-<description>

# Commit often with conventional format
git add src/api/printer.ts src/types/printer.type.ts
git commit -m "feat(printer): add printer connector API and types"

# Push and open PR → main
git push origin feature/TRE-XXX-FE-<description>
```

## 2. Bug Fix

```bash
git checkout main
git pull origin main
git checkout -b bugfix/TRE-XXX-FE-<description>

git commit -m "fix(payment): prevent navigation after failed order creation"
git push origin bugfix/TRE-XXX-FE-<description>
```

## Commit Message Format

Follows **Conventional Commits**:

```
<type>(<scope>): <short summary>

[optional body]
```

### Types

| Type | When |
| --- | --- |
| `feat` | New functionality visible to users |
| `fix` | Bug fix |
| `perf` | Performance improvement |
| `refactor` | Restructure without behavior change |
| `style` | Formatting only (no logic change) |
| `chore` | Dependencies, build config, tooling |
| `test` | Add or fix tests |
| `docs` | CLAUDE.md, README, comments only |
| `revert` | Revert a previous commit |

### Scopes (use project domain names)

`auth`, `order`, `cart`, `payment`, `menu`, `chef-area`, `chef-order`, `printer`, `notification`, `gift-card`, `banner`, `config`, `router`, `i18n`, `deps`

### Summary line rules

- Imperative mood: "add", "fix", "remove" — not "added", "fixes"
- Max 72 characters
- No period at end

```
✅ feat(printer): add printer connector API and network printer hooks
✅ fix(payment): prevent QR polling after payment success
✅ refactor(order): extract order status badge to shared component

❌ feat(printer): Added printer connector.   ← past tense + period
❌ fix: fixed the bug                        ← no scope, vague
```

### Body (when to add)

Add a body when the **why** isn't obvious:

```
fix(auth): prevent double token refresh on concurrent 401 responses

Multiple requests firing simultaneously all triggered a refresh,
causing race conditions and invalidated tokens. Added a queue
mechanism in http.unified.ts to serialize refresh calls.
```

## Pre-commit Checklist

Before every commit:

```bash
npm run lint        # ESLint — must pass clean (0 warnings)
npx tsc -b          # TypeScript — must exit 0
npm run test        # Vitest — must pass
```

**Never commit with:**
- `console.log` in TS/TSX files (hook will block it)
- `--no-verify` flag (hook will block it)
- TypeScript errors
- ESLint errors or warnings

## PR Conventions

### Title

Same format as commit: `feat(printer): add printer connector management UI`

### PR body template

```markdown
## What

Brief description of the change.

## Why

Motivation — ticket reference, bug report, feature request.
Ticket: TRE-XXX

## How

Key implementation decisions (especially non-obvious ones).

## Test plan

- [ ] Tested in browser (Chrome)
- [ ] Tested on iOS (Capacitor)
- [ ] No TypeScript errors (`npx tsc -b`)
- [ ] No lint errors (`npm run lint`)
- [ ] Tests pass (`npm run test`)

## Screenshots (if UI change)

| Before | After |
| --- | --- |
| screenshot | screenshot |
```

### PR rules

- **One concern per PR** — feature + refactor = split into two PRs
- Keep PRs under 400 lines changed when possible
- Self-review the diff before requesting review
- PR target: always `main`
- Never force-push to `main`

## Merge Strategy

- **Squash merge** for feature/bugfix branches
- Delete branch after merge

## Conflict Resolution

```bash
# Rebase onto main before merging (preferred)
git fetch origin
git rebase origin/main

# Resolve conflicts, then:
git add <resolved-files>
git rebase --continue
```

**Never resolve conflicts by blindly accepting one side** — read both versions.

## Rules

- Never push directly to `main`
- Never cherry-pick instead of merging (prefer rebase)
- Tag production releases on `main`
- Always back-merge hotfixes to any active feature branches
