# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server on port 5173
npm run build        # lint + tsc -b + vite build
npm run lint         # ESLint check only
npm run lint-fix     # ESLint with auto-fix
npm run test         # Vitest (all tests)
npm run test:cov     # Vitest with coverage
npx vitest run src/path/to/file.test.tsx   # single test file
npx vitest -t "test name"                  # single test by name
```

Dev server proxies `/api/v1/*` → `VITE_BASE_API_URL` (strips the prefix). Set `VITE_BASE_API_URL` in `.env`.

`postinstall` runs `patch-package` automatically — patches in `patches/` must be preserved.

## Architecture

### App startup sequence

`src/main.tsx` → `src/app/App.tsx`. The `App` component gates the entire UI behind `isAuthInitialized`. On mount it:
1. Runs `useGlobalTokenValidator` to clean expired tokens from Zustand/localStorage.
2. Initializes `deepLinkHandler` (Capacitor deep links) asynchronously.
3. Validates auth state synchronously — if `token` exists but `isAuthenticated()` returns false, it calls `setLogout()` and clears user info.
4. Sets `isAuthInitialized = true` (always in `finally`).

**Never remove or move this gate.** Race conditions on auth state (stale localStorage, corrupted tokens) were the reason it exists.

### Two app areas

- `src/app/system/` — Staff-facing pages (order management, chef area, products, reports, config, etc.)
- `src/app/client/` — Customer-facing pages (menu, cart, payment, order history, gift cards, etc.)
- `src/app/auth/` — Login, register, forgot-password flows

Routes are defined in `src/constants/route.ts` and wired in `src/router/index.tsx`. All pages are lazy-loaded via `React.lazy` wrappers in `src/router/loadable.tsx`.

### HTTP client

**Use `src/utils/http.unified.ts`**, not `src/utils/http.ts` (that file is commented-out legacy code). The unified client:
- Attaches the Bearer token from `useAuthStore` automatically.
- Auto-refreshes the access token when expired (queues concurrent requests, calls `POST /auth/refresh`).
- Shows NProgress loading bar unless the request opts out with `doNotShowLoading: true`.
- On 401 after a failed refresh, clears auth state and redirects to login, preserving the current URL in `useCurrentUrlStore` for post-login redirect.

### Data fetching pattern

All TanStack Query hooks live in `src/hooks/use-*.ts`. Each hook file wraps the raw API calls from `src/api/*.ts`. Query keys are centralized in `src/constants/query.ts` (`QUERYKEY`).

Global error handling: `QueryCache` and `MutationCache` in `App.tsx` call `showErrorToast` for all errors unless `meta: { ignoreGlobalError: true }` is set on the query/mutation.

### State management

Zustand stores in `src/stores/`, most persisted to `localStorage` via `persist` middleware. Key stores:
- `auth.store.ts` — token, refreshToken, expiry; `isAuthenticated()` checks both token and refresh expiry.
- `user.store.ts` — user profile, language preference.
- `cart.store.ts` — cart items for the current session.
- `order.store.ts`, `current-order.store.ts`, `selected-order.store.ts` — order flow state.
- `notification.store.ts` — unread notification count.
- `payment.store.ts`, `payment-method.store.ts` — payment flow.

### Notifications (Firebase + Capacitor)

`src/components/app/notification-provider.tsx` is mounted inside the system layout. It:
- Registers FCM tokens via `src/services/fcm-token-manager.ts`.
- Listens to incoming push messages via `useFirebaseNotification` (web) and `useNotificationListener` (native Capacitor).
- Plays a notification sound and invalidates relevant TanStack Query caches on receipt.
- Intercepts `ORDER_BILL_FAILED_PRINTING`, `ORDER_CHEF_ORDER_FAILED_PRINTING`, `ORDER_LABEL_TICKET_FAILED_PRINTING` codes and opens `PrinterFailDialog` instead of the generic toast.

### Forms

All forms use `react-hook-form` + Zod schemas from `src/schemas/`. Always wire the `zodResolver` from `@hookform/resolvers/zod`. Schema files export both the Zod schema and the inferred TypeScript type (e.g. `TCreatePrinterForChefAreaSchema`).

### Printing

Two separate subsystems:

1. **Browser print (invoices):** `src/utils/printer.ts` — `exportOrderInvoices()` renders an EJS template (`public/templates/invoice-template.html`) with order data, opens a popup window, calls `window.print()`, and auto-closes via multiple fallback mechanisms (`onafterprint`, media query, focus, 5s timeout).

2. **Network printers (chef orders, labels, invoices):** Managed per Chef Area via `src/api/chef-area.ts`. Printers connect over IP/Port using TSPL/ZPL or ESC/POS. Print jobs have statuses `pending → printing → printed | failed`. Failed jobs surface via push notification → `PrinterFailDialog` → re-print API calls.

### i18n

`src/i18n.ts` initializes i18next with `BrowserLanguageDetector` and HTTP backend loading from `public/locales/`. Namespace files are per-feature (e.g. `chefArea`, `notification`, `toast`). Language preference from `userStore.userInfo.language` overrides browser detection and is applied in `App.tsx` during initialization.

### Capacitor (native)

`capacitor.config.ts` controls the native build. Native plugins are wrapped in `src/plugins/`. Deep linking is handled by `src/services/deep-link-handler.ts` which must be initialized before the router (done in `App.tsx`). See `DEEP_LINKING_GUIDE.md` and `ANDROID_SETUP.md` at the project root.
