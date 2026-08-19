---
name: file-structure
description: Trigger when creating new files, adding features, creating components/hooks/services, moving files, or refactoring structure. Always place files in the correct directory following this structure.
---

# File & Folder Structure — order-ui

## Project Root Structure

```
src/
├── api/                          # API service functions (one file per domain)
│   ├── index.ts                  # Re-exports all services
│   ├── auth.ts
│   ├── order.ts
│   ├── chef-area.ts
│   ├── printer.ts                # Printer connector + invoice area APIs
│   └── ...
├── app/                          # Page-level components (mirrors route structure)
│   ├── App.tsx                   # App root — auth gate, QueryClient, providers
│   ├── auth/                     # Login, register, forgot-password flows
│   ├── system/                   # Staff-facing pages
│   │   ├── chef-area/
│   │   ├── chef-order/
│   │   ├── order/
│   │   ├── config/
│   │   └── ...
│   └── client/                   # Customer-facing pages
│       ├── menu/
│       ├── cart/
│       ├── payment/
│       └── ...
├── components/                   # Shared reusable components
│   ├── ui/                       # Atomic Radix-based UI components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── data-table.tsx
│   │   ├── form.tsx
│   │   └── ...
│   ├── app/                      # App-level components (notifications, dialogs)
│   │   ├── notification-provider.tsx
│   │   ├── printer-fail-dialog.tsx
│   │   └── ...
│   └── [feature]/                # Feature-specific shared components
│       └── [component-name].tsx
├── constants/                    # Centralized constants
│   ├── query.ts                  # QUERYKEY — all TanStack Query keys
│   ├── route.ts                  # Route paths
│   └── ...
├── hooks/                        # Custom React Query hooks (use-*.ts)
│   ├── index.ts
│   ├── use-auth.ts
│   ├── use-order.ts
│   ├── use-chef-area.ts
│   ├── use-printer.ts            # Printer hooks (new)
│   └── ...
├── i18n.ts                       # i18next initialization
├── plugins/                      # Capacitor plugin wrappers
├── router/
│   ├── index.tsx                 # Route definitions
│   └── loadable.tsx              # React.lazy wrappers (ALL pages registered here)
├── schemas/                      # Zod validation schemas
│   ├── auth.schema.ts
│   ├── chef-area.schema.ts
│   └── ...
├── services/                     # Business logic services (non-API)
│   ├── fcm-token-manager.ts
│   └── deep-link-handler.ts
├── stores/                       # Zustand stores
│   ├── index.ts
│   ├── auth.store.ts
│   ├── cart.store.ts
│   ├── current-order.store.ts
│   ├── payment.store.ts
│   └── ...
├── types/                        # TypeScript type definitions
│   ├── index.ts                  # Re-exports all types
│   ├── auth.type.ts
│   ├── order.type.ts
│   ├── printer.type.ts           # Printer types (new)
│   └── ...
└── utils/                        # Utility functions
    ├── http.unified.ts           # THE HTTP client — always use this
    ├── http.ts                   # Legacy — DO NOT USE
    ├── printer.ts                # Browser print utility (invoices)
    └── ...

public/
├── locales/                      # i18n translation files
│   ├── en/
│   └── vi/
└── templates/
    └── invoice-template.html     # EJS invoice template for browser print
```

## Rules for New Files

### New API endpoint

1. Add function to `src/api/[domain].ts`
2. Export from `src/api/index.ts`
3. Add query key to `src/constants/query.ts` if new data type
4. Create hook in `src/hooks/use-[domain].ts`
5. Export from `src/hooks/index.ts`

### New page (system area)

1. Create `src/app/system/[feature]/index.tsx`
2. Register lazy import in `src/router/loadable.tsx`
3. Add route in `src/router/index.tsx`
4. Add route constant in `src/constants/route.ts`

### New shared component

1. Create `src/components/[category]/[component-name].tsx`
2. Export from `src/components/[category]/index.ts` if barrel exists

### New type

1. Add to `src/types/[domain].type.ts`
2. Export from `src/types/index.ts`

### New Zod schema

1. Create `src/schemas/[feature].schema.ts`
2. Export both schema and inferred type:
   ```ts
   export const CreatePrinterSchema = z.object({...})
   export type TCreatePrinterSchema = z.infer<typeof CreatePrinterSchema>
   ```

### New store

1. Create `src/stores/[domain].store.ts`
2. Define state interface in `src/types/[domain].type.ts` first
3. Export from `src/stores/index.ts`

## Printing Subsystems (Two separate systems)

### 1. Browser print (invoices)
- Utility: `src/utils/printer.ts`
- Function: `exportOrderInvoices()` → renders EJS template → `window.print()`
- Template: `public/templates/invoice-template.html`

### 2. Network printers (chef orders, labels, invoices)
- API: `src/api/chef-area.ts` and `src/api/printer.ts`
- Printers connect via IP/Port (TSPL/ZPL or ESC/POS)
- Print jobs: `pending → printing → printed | failed`
- Failed jobs → push notification → `PrinterFailDialog` → re-print API calls
