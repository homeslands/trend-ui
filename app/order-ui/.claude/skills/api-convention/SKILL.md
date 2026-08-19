---
name: api-convention
description: Trigger when creating API services, handling requests/responses, adding query keys, or writing React Query hooks. Ensures consistent API integration patterns for this project.
---

# API & Service Layer Convention

This project uses **Axios** via `src/utils/http.unified.ts` and **TanStack Query** for server state.

## HTTP Client

**Always import via `@/utils`** — the `http` client is exported from `src/utils/http.ts`.
Note: `src/utils/http.unified.ts` is the commented-out legacy file — do **not** use it.

The client:
- Attaches Bearer token from `useAuthStore` automatically
- Auto-refreshes access token when expired (queues concurrent requests)
- Shows NProgress loading bar unless `doNotShowLoading: true` is set
- On 401 after failed refresh: clears auth state → redirects to login

```ts
import { http } from '@/utils'

// Suppress loading bar for background/polling requests
const response = await http.get('/orders/public', {
  // @ts-expect-error doNotShowLoading is not in AxiosRequestConfig
  doNotShowLoading: true,
})
```

## API Response Format

```ts
// All API functions return IApiResponse<T>
export interface IApiResponse<T> {
  success: boolean
  data: T
  message?: string
  statusCode: number
}
```

## API Service File Structure

Each domain has one file: `src/api/[domain].ts`

```
src/api/
├── index.ts          # Re-exports all services
├── auth.ts
├── order.ts
├── menu.ts
├── chef-area.ts
├── printer.ts        # Printer connector + invoice area
└── ...
```

### Service Pattern

```ts
// src/api/order.ts
import { http } from '@/utils'
import { IApiResponse, IOrder, ICreateOrderRequest } from '@/types'

export async function getOrderBySlug(slug: string): Promise<IApiResponse<IOrder>> {
  const response = await http.get<IApiResponse<IOrder>>(`/orders/${slug}`)
  return response.data
}

export async function createOrder(
  payload: ICreateOrderRequest,
): Promise<IApiResponse<IOrder>> {
  const response = await http.post<IApiResponse<IOrder>>('/orders', payload)
  return response.data
}

export async function updateOrderType(
  slug: string,
  payload: IUpdateOrderTypeRequest,
): Promise<IApiResponse<IOrder>> {
  const response = await http.patch<IApiResponse<IOrder>>(
    `/orders/${slug}/type`,
    payload,
  )
  return response.data
}
```

**Key rules:**
- One function per endpoint — no overloading
- Name matches HTTP verb: `get*`, `create*`, `update*`, `delete*`, `toggle*`
- Always type response: `Promise<IApiResponse<T>>`
- Always type request body: `http.post<IApiResponse<T>>(...)`
- Return `response.data` — unwrap Axios wrapper
- No try/catch in API layer — let React Query handle errors
- Use `http.patch` for partial updates, `http.put` for full replacement

## React Query Integration

### Query Keys

Centralized in `src/constants/query.ts`:

```ts
export const QUERYKEY = {
  orders: ['orders'],
  chefAreas: ['chefAreas'],
  printerEvents: ['printerEvents'],
  // ... add new keys here
} as const
```

**Always use `QUERYKEY.*`** — never inline string arrays.

### Query Hook Pattern

```ts
// src/hooks/use-chef-area.ts
import { useQuery } from '@tanstack/react-query'
import { getChefAreas } from '@/api'
import { QUERYKEY } from '@/constants'

export const useGetChefAreas = () => {
  return useQuery({
    queryKey: [QUERYKEY.chefAreas],
    queryFn: getChefAreas,
  })
}

export const useGetChefArea = (slug: string) => {
  return useQuery({
    queryKey: [QUERYKEY.chefAreas, slug],
    queryFn: () => getChefAreaBySlug(slug),
    enabled: !!slug,
  })
}
```

### Mutation Hook Pattern

```ts
// src/hooks/use-order.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createOrder } from '@/api'
import { QUERYKEY } from '@/constants'
import { ICreateOrderRequest } from '@/types'

export const useCreateOrder = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ICreateOrderRequest) => createOrder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.orders] })
    },
  })
}
```

**Notes on error handling:**
- Global `QueryCache` and `MutationCache` in `App.tsx` call `showErrorToast` on all errors automatically
- To suppress global toast: add `meta: { ignoreGlobalError: true }` on the query/mutation
- Only add `onError` in hooks when you need specific error handling beyond the global toast

### Pagination Pattern

```ts
export const useGetAllOrders = (params: IOrdersQuery) => {
  return useQuery({
    queryKey: [QUERYKEY.orders, params],
    queryFn: () => getAllOrders(params),
    placeholderData: keepPreviousData, // prevents loading flash on page change
    // @ts-expect-error doNotShowLoading not in standard options
    doNotShowLoading: true,
  })
}
```

## Polling / Real-time

For polling (e.g., kitchen orders, printer events):

```ts
export const useGetChefOrders = () => {
  return useQuery({
    queryKey: [QUERYKEY.chefOrders],
    queryFn: getAllOrdersPublic, // uses doNotShowLoading: true internally
    refetchInterval: 5000,
    staleTime: 0,
  })
}
```

## Common Mistakes

| ❌ Don't | ✅ Do |
| --- | --- |
| Import `useAuthStore` in `src/api/` | Token is injected by `http.unified.ts` automatically |
| Add `Authorization` header manually | The interceptor handles it |
| Call API functions directly in components | Always use a React Query hook from `src/hooks/` |
| Create new axios instances | Use the exported `http` from `@/utils` |
| Return `response` directly | Return `response.data` |
| Define query keys inline as strings | Use `QUERYKEY.*` from `src/constants/query.ts` |
| Use `http.unified.ts` (legacy, commented-out) | Use `http` from `@/utils` (exports `src/utils/http.ts`) |
