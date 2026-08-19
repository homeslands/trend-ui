---
name: security-review
description: Trigger when writing auth flows, payment screens, API interceptors, token handling, form validation, or any code that touches user credentials, financial data, or external input. Ensures secure patterns for this web + Capacitor app.
---

# Security Review — order-ui

This project handles **financial transactions** (payments, orders) and **user PII** (email, phone, address). Security is non-negotiable in these areas.

## 1. Token & Credential Storage

### Rules

```ts
// ✅ Tokens stored in Zustand + localStorage via persist middleware
// This is the established pattern — auth.store.ts uses persist()
// Token is cleared on logout via setLogout()

// ❌ NEVER hardcode tokens or secrets in source code
const token = 'eyJhbGciOiJIUzI1NiIs...' // never

// ❌ NEVER log tokens
console.log('token:', token)            // never
console.log('auth state:', authStore)   // never — contains tokens
```

### What to check

- `token`, `refreshToken` only exist in `auth.store.ts` — never in other stores or component state
- No credentials hardcoded (use `.env` — `VITE_BASE_API_URL` is public, backend secrets must not go in `VITE_*`)
- Logout path: always call `setLogout()` from `useAuthStore` — clears token AND localStorage

## 2. API Security

### Authentication is handled by `http.unified.ts`

```ts
// ✅ Token injected by interceptor automatically
// DO NOT add Authorization header manually in components or API functions

// ❌ Never do this
const response = await http.get('/orders', {
  headers: { Authorization: `Bearer ${token}` },
})
```

### Sensitive data in URLs

```ts
// ❌ Sensitive data as query params (logged by servers)
http.get(`/payments?cardLast4=${cardLast4}`)

// ✅ Sensitive data in request body
http.post('/payments/search', { cardLast4 })
```

### What to check

- No `console.log` of API responses containing user data or tokens
- All payment endpoints use `POST`/`PATCH`, not `GET` with sensitive params
- Error messages from API mapped to user-friendly strings — never show raw server errors

## 3. Input Validation

### Always validate with Zod at form boundaries

```ts
// ✅ Zod schema validates before sending to API
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// ❌ Raw user input sent directly
mutation.mutate({ email: emailInput, password: passwordInput })
```

### XSS Prevention

```tsx
// ✅ React escapes by default — trust JSX rendering
<p>{userContent}</p>

// ❌ Never use dangerouslySetInnerHTML with user content
<p dangerouslySetInnerHTML={{ __html: userContent }} />

// Exception: EJS invoice template (public/templates/invoice-template.html)
// Only rendered in a popup window with controlled data — not with raw user input
```

## 4. Auth Flow Security

### Token refresh race condition

`http.unified.ts` handles concurrent 401s via a queue — **do not add another refresh mechanism**. Multiple refresh calls cause token invalidation.

### Auth guard

`src/app/App.tsx` gates all UI behind `isAuthInitialized`. **Never remove or bypass this gate.** It was added specifically to prevent stale token race conditions on app start.

### Post-login redirect

The current URL is saved to `useCurrentUrlStore` before redirect to login. Restored after login. Don't bypass this — it's the intended UX for deep links.

## 5. Deep Links (Capacitor)

```ts
// Deep link URLs are parsed by deep-link-handler.ts
// NEVER navigate to a deep link URL without validation

// ✅ Validate path against known routes before navigating
const knownRoutes = ['/payment', '/order', '/cart']
if (knownRoutes.some(r => parsedPath.startsWith(r))) {
  router.push(parsedPath)
}

// ❌ Blind navigation
router.push(deepLinkUrl) // could navigate to /admin or external paths
```

## 6. Push Notifications

Firebase push notifications contain a `code` field. The `notification-provider.tsx` filters codes against a known list before acting:

```ts
// Known printer failure codes → render PrinterFailDialog
// All other codes → generic toast

// ❌ Never execute arbitrary actions from notification payload without whitelisting
```

## 7. Printer API Keys

Printer connectors use `apiKey` fields. These are:
- Never logged
- Never exposed in URL params
- Always sent in request body
- Stored server-side — never in localStorage

## Common Security Mistakes

| ❌ Don't | ✅ Do |
| --- | --- |
| Log token or auth state | Keep tokens out of logs entirely |
| Send sensitive params in URL | Use request body |
| Show raw API error to user | Map to user-friendly messages |
| `dangerouslySetInnerHTML` with user data | Use React JSX rendering |
| Hardcode API keys in source | Use `.env` (never commit `.env`) |
| Navigate to unvalidated deep link URLs | Whitelist known routes |
| Bypass `isAuthInitialized` gate | Keep the gate in `App.tsx` |
| Add manual token refresh logic | Trust `http.unified.ts` interceptor |
