---
name: coding-convention
description: Trigger when writing any code — components, hooks, stores, API services, utilities, types. Guides structure, naming, formatting, imports, and patterns to maintain consistency with the existing codebase.
---

# Coding Conventions — order-ui

## General Format Rules

- **TypeScript strict mode** — no implicit `any`
- **Prettier** auto-formats on save (see `.prettierrc`)
- **ESLint** must pass before commit — run `npm run lint`
- No `console.log` in committed code (use `// eslint-disable-next-line no-console` if absolutely needed)

## Naming Conventions

| Type | File name | Export name | Example |
| --- | --- | --- | --- |
| Component | kebab-case | PascalCase | `order-card.tsx` → `export const OrderCard` |
| Hook | kebab-case | camelCase | `use-printer.ts` → `export function usePrinter` |
| API service | kebab-case | camelCase | `printer.ts` → `export async function createPrinterConnectors` |
| Zustand store | kebab-case + `.store` | camelCase | `auth.store.ts` → `export const useAuthStore` |
| Type/Interface file | kebab-case + `.type` | PascalCase | `printer.type.ts` → `export interface IPrinter` |
| Schema file | kebab-case + `.schema` | PascalCase + `Schema` | `printer.schema.ts` → `export const CreatePrinterSchema` |
| Constant file | kebab-case | UPPER_SNAKE | `query.ts` → `export const QUERYKEY` |

## Component Patterns

```tsx
// src/components/printer/printer-card.tsx
import { type FC } from 'react'
import { IPrinter } from '@/types'

interface PrinterCardProps {
  printer: IPrinter
  onDelete?: (slug: string) => void
}

export const PrinterCard: FC<PrinterCardProps> = ({ printer, onDelete }) => {
  return (
    <div>
      {/* component JSX */}
    </div>
  )
}
```

**Key rules:**
- Use `FC<Props>` or explicit `(props: Props) => JSX.Element` — not `React.FC` (deprecated pattern)
- Props interface always defined — never inline object type in function signature
- Use `type` for union/intersection, `interface` for object shapes
- All interfaces prefixed with `I` (e.g., `IPrinter`, `IOrder`)

## Hook Patterns

```ts
// src/hooks/use-printer.ts
import { usePrinterStore } from '@/stores'

export function usePrinter() {
  // ✅ Select only what's needed — never spread entire store
  const printers = usePrinterStore(s => s.printers)
  const setPrinters = usePrinterStore(s => s.setPrinters)

  return { printers, setPrinters }
}
```

**Rules:**
- Hooks always start with `use` prefix
- **Never** `return { ...useStore() }` — subscribe to specific slices via selectors
- Wrap expensive callbacks with `useCallback` when passed as props
- Use `useMemo` for derived data computed from large arrays

## Zustand Store Patterns

```ts
// src/stores/printer.store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { IPrinterStore } from '@/types'

export const usePrinterStore = create<IPrinterStore>()(
  persist(
    (set) => ({
      printers: [],
      setPrinters: (printers) => set({ printers }),
      clearPrinters: () => set({ printers: [] }),
    }),
    { name: 'printer-store' },
  ),
)
```

**Rules:**
- Store state interface defined in `src/types/[domain].type.ts`, not inline
- Persisted stores use `persist` middleware with a unique `name`
- Non-persisted stores omit `persist`
- Never import `useAuthStore` or other stores inside another store — pass values via actions

## Form Patterns

```tsx
// Always: react-hook-form + Zod
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreatePrinterSchema, type TCreatePrinterSchema } from '@/schemas'

const form = useForm<TCreatePrinterSchema>({
  resolver: zodResolver(CreatePrinterSchema),
  defaultValues: { name: '', ip: '', port: 9100 },
})
```

Schema files (`src/schemas/`) export:
- The Zod schema: `export const CreatePrinterSchema = z.object({...})`
- The inferred type: `export type TCreatePrinterSchema = z.infer<typeof CreatePrinterSchema>`

## i18n

```tsx
import { useTranslation } from 'react-i18next'

// Always use translation keys — never hardcode UI strings
const { t } = useTranslation(['chefArea', 'common'])

// Usage
<Button>{t('chefArea:addPrinter')}</Button>
```

Translation files live in `public/locales/[lang]/[namespace].json`.

## Import Order (ESLint enforces)

1. React imports
2. Third-party packages
3. Internal `@/` imports (aliased)
4. Relative imports

```ts
import { useState } from 'react'

import { useMutation } from '@tanstack/react-query'

import { createPrinterConnectors } from '@/api'
import { QUERYKEY } from '@/constants'
import { IPrinterConnector } from '@/types'

import { PrinterCard } from './printer-card'
```

## Error Handling

```ts
// ✅ In React Query mutations — let global handler take over
const mutation = useMutation({
  mutationFn: createPrinterConnectors,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: [QUERYKEY.chefAreaPrinters] })
  },
  // onError fires automatically if meta.ignoreGlobalError is not set
})

// ✅ Manual try/catch — always stop execution after catch
try {
  await createPrinterConnectors(payload)
} catch (error) {
  // Global error toast fires automatically via MutationCache
  return // stop — do NOT continue after error
}
```

## Two App Areas — Don't Mix

- `src/app/system/` — staff-facing pages. Uses auth guard, staff navigation.
- `src/app/client/` — customer-facing pages. Different layout, no staff auth required.
- `src/app/auth/` — shared auth flows.

Components used in both areas live in `src/components/`. Components specific to one area live alongside the page in `src/app/[area]/[feature]/components/`.
