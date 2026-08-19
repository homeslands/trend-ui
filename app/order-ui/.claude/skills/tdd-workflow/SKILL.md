---
name: tdd-workflow
description: Trigger when writing tests, adding test files, or when the user asks how to test a component, hook, store, or API service. Provides the testing stack, file conventions, and patterns specific to this codebase.
---

# TDD Workflow — order-ui

## Testing Stack

| Tool | Purpose |
| --- | --- |
| **Vitest** | Test runner (configured in `vite.config.ts`) |
| **@testing-library/react** | Component rendering + interaction |
| **@testing-library/user-event** | Realistic user interactions |
| **vi.mock** | Module/API mocking |
| **Zod** | Validates test fixture shapes match real types |

## Commands

```bash
npm run test              # Run all tests
npm run test:cov          # Run with coverage
npx vitest run src/path/to/file.test.tsx   # Single file
npx vitest -t "test name"                  # Single test by name
```

## File Conventions

```
# Co-locate tests next to the file they test
src/api/printer.ts
src/api/__tests__/printer.test.ts

src/hooks/use-printer.ts
src/hooks/__tests__/use-printer.test.ts

src/stores/cart.store.ts
src/stores/__tests__/cart.store.test.ts

src/components/ui/button.tsx
src/components/ui/__tests__/button.test.tsx
```

**Rules:**
- Test files live in `__tests__/` inside the same folder as the file under test
- Filename: `<source-file>.test.ts` or `<source-file>.test.tsx`

## Arrange / Act / Assert Pattern

Every test block follows this structure:

```ts
it('should add item to cart when quantity is valid', () => {
  // Arrange — set up the precondition
  const { result } = renderHook(() => useCartStore())
  const item: ICartItem = { id: '1', name: 'Latte', price: 45000, quantity: 1 }

  // Act — perform the operation
  act(() => {
    result.current.addItem(item)
  })

  // Assert — verify the outcome
  expect(result.current.items).toHaveLength(1)
  expect(result.current.items[0].id).toBe('1')
})
```

## API Service Tests

```ts
// src/api/__tests__/printer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPrinterConnectors, getPrinterConnectorsByBranch } from '../printer'
import { http } from '@/utils'

vi.mock('@/utils', () => ({
  http: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('printer API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a printer connector', async () => {
    // Arrange
    const mockResponse = {
      data: { success: true, data: { slug: 'connector-1', url: 'http://192.168.1.1' } },
    }
    vi.mocked(http.post).mockResolvedValue(mockResponse)

    // Act
    const result = await createPrinterConnectors({
      branchSlug: 'branch-1',
      url: 'http://192.168.1.1',
      apiKey: 'key123',
    })

    // Assert
    expect(http.post).toHaveBeenCalledWith('/printer-connector', expect.any(Object))
    expect(result.data.slug).toBe('connector-1')
  })
})
```

## Hook Tests (React Query)

```tsx
// src/hooks/__tests__/use-printer.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { useGetPrinterConnectorsByBranch } from '../use-printer'
import * as printerApi from '@/api'

vi.mock('@/api')

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

it('should fetch printer connectors for a branch', async () => {
  const mockData = { success: true, data: { slug: 'c1', url: 'http://...' } }
  vi.mocked(printerApi.getPrinterConnectorsByBranch).mockResolvedValue(mockData)

  const { result } = renderHook(
    () => useGetPrinterConnectorsByBranch('branch-1'),
    { wrapper: createWrapper() },
  )

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.data.slug).toBe('c1')
})
```

## Store Tests (Zustand)

```ts
// src/stores/__tests__/cart.store.test.ts
import { renderHook, act } from '@testing-library/react'
import { useCartStore } from '../cart.store'

beforeEach(() => {
  useCartStore.getState().clearCart?.()
})

it('should add item to cart', () => {
  const { result } = renderHook(() => useCartStore())

  act(() => {
    result.current.addItem({ id: '1', name: 'Latte', price: 45000, quantity: 1 })
  })

  expect(result.current.items).toHaveLength(1)
})
```

## Component Tests

```tsx
// src/components/__tests__/printer-card.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrinterCard } from '../printer-card'

const mockPrinter = {
  slug: 'printer-1',
  name: 'Kitchen Printer',
  ip: '192.168.1.100',
  port: 9100,
}

it('should call onDelete with printer slug when delete button is clicked', async () => {
  const handleDelete = vi.fn()
  render(<PrinterCard printer={mockPrinter} onDelete={handleDelete} />)

  await userEvent.click(screen.getByRole('button', { name: /delete/i }))

  expect(handleDelete).toHaveBeenCalledWith('printer-1')
})
```

## What to Test

**Test these:**
- API service functions (mock `http`, verify calls and return values)
- Custom hooks with React Query (use `QueryClientProvider` wrapper)
- Zustand store actions (use `renderHook`)
- Critical UI interactions (form submit, button click)
- Validation schemas (Zod — test valid + invalid inputs)

**Skip these:**
- Pure Radix UI / shadcn components (they are tested by the library)
- Type-only files
- Trivial getters/setters

## Zod Schema Tests

```ts
import { CreatePrinterSchema } from '@/schemas'

describe('CreatePrinterSchema', () => {
  it('should accept valid printer data', () => {
    const result = CreatePrinterSchema.safeParse({
      name: 'Kitchen Printer',
      ip: '192.168.1.100',
      port: 9100,
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid IP', () => {
    const result = CreatePrinterSchema.safeParse({
      name: 'Kitchen Printer',
      ip: 'not-an-ip',
      port: 9100,
    })
    expect(result.success).toBe(false)
  })
})
```
