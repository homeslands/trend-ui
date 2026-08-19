# Printer Management — Plan B Implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Printer Connector CRUD in Config page, Invoice Area management pages, and add `printerId` field to Chef Area printer forms — following existing patterns exactly.

**Architecture:** Four sequential tasks sharing a common foundation. Task 1 fixes bugs and builds the data layer (types, schemas, query keys, hooks). Tasks 2–4 build UI on top. Printer Connector is the physical device registry; Chef Area and Invoice Area printers reference connectors via `printerId`. No structural changes to existing Chef Area printer UI — only `printerId` field is added to existing forms.

**Tech Stack:** React 18, TanStack Query v5, react-hook-form, Zod, Radix UI/shadcn, Tailwind CSS, Vitest

---

## Key patterns to follow

- `IApiResponse<T>` → access data via `response.data.result`, not `.data.data`
- `IBase` has `slug: string` and `createdAt: string` only
- API functions return `response.data` (the `IApiResponse<T>`) — no try/catch in API layer
- Query keys from `QUERYKEY.*` in `src/constants/query.ts`
- Sheets → confirm dialog before mutation (same pattern as `create-printer-sheet.tsx`)
- Hooks use `const { mutate } = useMutation(...)` pattern
- `port` stored as `string` in forms/schemas (matches existing chef-area schema)

---

## Task 1: Foundation — Fix API bugs, types, query keys, schemas, hooks

**Files:**
- Modify: `src/api/printer.ts` — fix 3 bugs
- Modify: `src/types/area.type.ts` — add `printerId` to chef area printer request types
- Modify: `src/constants/query.ts` — add `printerConnectors`, `invoiceAreas` keys
- Create: `src/schemas/printer.schema.ts` — Zod schemas for all printer entities
- Modify: `src/schemas/chef-area.schema.ts` — add `printerId` to printer schemas
- Modify: `src/hooks/use-printer.ts` — implement all hooks
- Modify: `src/hooks/index.ts` — export use-printer hooks
- Test: `src/hooks/__tests__/use-printer.test.ts`

---

- [ ] **Step 1.1 — Fix API bugs in `src/api/printer.ts`**

Three bugs: `createPrinterConnectors` and `updatePrinterConnector` wrap params in an extra object `{ params }` instead of passing `params` directly. `getPrinterConnectorsByBranch` has wrong return type (single item vs array).

```ts
// src/api/printer.ts  — full corrected file
import { IApiResponse, ICreatePrinterConnectorRequest, IUpdatePrinterConnectorRequest, IPrinterConnector, IPrinter, IUpdateInvoiceAreaRequest, IUpdatePrinterForInvoiceAreaRequest } from '@/types'
import { ICreateInvoiceAreaRequest, IInvoiceArea, ICreatePrinterForInvoiceAreaRequest } from '@/types'
import { http } from '@/utils'

// PRINTER CONNECTOR API
export async function createPrinterConnectors(params: ICreatePrinterConnectorRequest): Promise<IApiResponse<IPrinterConnector>> {
  const response = await http.post<IApiResponse<IPrinterConnector>>('/printer-connector', params)
  return response.data
}

export async function getPrinterConnectorsByBranch(branchSlug: string): Promise<IApiResponse<IPrinterConnector[]>> {
  const response = await http.get<IApiResponse<IPrinterConnector[]>>(`/printer-connector/branch/${branchSlug}`)
  return response.data
}

export async function updatePrinterConnector(slug: string, params: IUpdatePrinterConnectorRequest): Promise<IApiResponse<IPrinterConnector>> {
  const response = await http.patch<IApiResponse<IPrinterConnector>>(`/printer-connector/${slug}`, params)
  return response.data
}

export async function deletePrinterConnector(slug: string): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(`/printer-connector/${slug}`)
  return response.data
}

// INVOICE AREA API
export async function createInvoiceArea(params: ICreateInvoiceAreaRequest): Promise<IApiResponse<IInvoiceArea>> {
  const response = await http.post<IApiResponse<IInvoiceArea>>('/invoice-area', params)
  return response.data
}

export async function getInvoiceAreasByBranch(branch: string): Promise<IApiResponse<IInvoiceArea[]>> {
  const response = await http.get<IApiResponse<IInvoiceArea[]>>(`/invoice-area/branch/${branch}`)
  return response.data
}

export async function updateInvoiceArea(params: IUpdateInvoiceAreaRequest): Promise<IApiResponse<IInvoiceArea>> {
  const response = await http.patch<IApiResponse<IInvoiceArea>>(`/invoice-area/${params.slug}`, params)
  return response.data
}

export async function deleteInvoiceArea(slug: string): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(`/invoice-area/${slug}`)
  return response.data
}

// INVOICE AREA PRINTERS API
export async function createPrinterForInvoiceArea(params: ICreatePrinterForInvoiceAreaRequest): Promise<IApiResponse<IPrinter>> {
  const response = await http.post<IApiResponse<IPrinter>>(`/invoice-area/${params.slug}/printer`, params)
  return response.data
}

export async function getPrintersForInvoiceArea(slug: string): Promise<IApiResponse<IPrinter[]>> {
  const response = await http.get<IApiResponse<IPrinter[]>>(`/invoice-area/${slug}/printers`)
  return response.data
}

export async function updatePrinterForInvoiceArea(params: IUpdatePrinterForInvoiceAreaRequest): Promise<IApiResponse<IPrinter>> {
  const response = await http.patch<IApiResponse<IPrinter>>(`/invoice-area/${params.slug}/printer/${params.printerSlug}`, params)
  return response.data
}

export async function deletePrinterForInvoiceArea(slug: string, printerSlug: string): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(`/invoice-area/${slug}/printer/${printerSlug}`)
  return response.data
}

export async function togglePrinterForInvoiceArea(slug: string, printerSlug: string, isActive: boolean): Promise<IApiResponse<IPrinter>> {
  const response = await http.patch<IApiResponse<IPrinter>>(`/invoice-area/${slug}/printer/${printerSlug}/toggle`, { isActive })
  return response.data
}
```

- [ ] **Step 1.2 — Add `printerId` to chef area printer request types in `src/types/area.type.ts`**

```ts
// Modify ICreatePrinterForChefAreaRequest — add printerId
export interface ICreatePrinterForChefAreaRequest {
  slug: string       // slug of the chef area
  name: string
  dataType: PrinterDataType
  ip: string
  port: string
  description?: string
  printerId: string  // slug of the PrinterConnector
}

// Modify IUpdatePrinterForChefAreaRequest — add printerId
export interface IUpdatePrinterForChefAreaRequest {
  slug: string       // slug of the chef area
  printerSlug: string
  name: string
  dataType: PrinterDataType
  ip: string
  port: string
  description?: string
  printerId: string  // slug of the PrinterConnector
}
```

- [ ] **Step 1.3 — Add query keys in `src/constants/query.ts`**

```ts
// Add these two entries to the QUERYKEY object:
printerConnectors: ['printerConnectors'],
invoiceAreas: ['invoiceAreas'],
invoiceAreaPrinters: ['invoiceAreaPrinters'],
```

- [ ] **Step 1.4 — Create `src/schemas/printer.schema.ts`**

```ts
import { z } from 'zod'

// Printer Connector
export const createPrinterConnectorSchema = z.object({
  branchSlug: z.string().min(1),
  url: z.string().url({ message: 'Invalid URL' }),
  apiKey: z.string().min(1),
})

export const updatePrinterConnectorSchema = z.object({
  slug: z.string().min(1),
  url: z.string().url({ message: 'Invalid URL' }),
  apiKey: z.string().min(1),
})

// Invoice Area
export const createInvoiceAreaSchema = z.object({
  branch: z.string().min(1),
  name: z.string().min(1),
  description: z.optional(z.string()),
})

export const updateInvoiceAreaSchema = z.object({
  slug: z.string().min(1),
  branch: z.string().min(1),
  name: z.string().min(1),
  description: z.optional(z.string()),
})

// Printer in Invoice Area
export const createPrinterForInvoiceAreaSchema = z.object({
  slug: z.string().min(1), // invoice area slug
  name: z.string().min(1),
  ip: z.string().min(1),
  port: z.string().min(1),
  dataType: z.literal('tspl-zpl'),
  description: z.optional(z.string()),
  printerId: z.string().min(1),
})

export const updatePrinterForInvoiceAreaSchema = z.object({
  slug: z.string().min(1),        // invoice area slug
  printerSlug: z.string().min(1),
  name: z.string().min(1),
  ip: z.string().min(1),
  port: z.string().min(1),
  dataType: z.literal('tspl-zpl'),
  description: z.optional(z.string()),
  printerId: z.string().min(1),
  isActive: z.boolean(),
})

export type TCreatePrinterConnectorSchema = z.infer<typeof createPrinterConnectorSchema>
export type TUpdatePrinterConnectorSchema = z.infer<typeof updatePrinterConnectorSchema>
export type TCreateInvoiceAreaSchema = z.infer<typeof createInvoiceAreaSchema>
export type TUpdateInvoiceAreaSchema = z.infer<typeof updateInvoiceAreaSchema>
export type TCreatePrinterForInvoiceAreaSchema = z.infer<typeof createPrinterForInvoiceAreaSchema>
export type TUpdatePrinterForInvoiceAreaSchema = z.infer<typeof updatePrinterForInvoiceAreaSchema>
```

- [ ] **Step 1.5 — Add `printerId` to chef area printer schemas in `src/schemas/chef-area.schema.ts`**

```ts
// Add printerId field to createPrinterForChefAreaSchema:
export const createPrinterForChefAreaSchema = z.object({
  name: z.string().min(1),
  ip: z.string().min(1),
  port: z.string().min(1),
  dataType: z.enum([PrinterDataType.TSPL_ZPL, PrinterDataType.ESC_POS]),
  description: z.optional(z.string()),
  slug: z.string(),       // chef area slug
  printerId: z.string().min(1, 'Please select a printer connector'),
})

// Add printerId field to updatePrinterForChefAreaSchema:
export const updatePrinterForChefAreaSchema = z.object({
  slug: z.string(),
  printerSlug: z.string(),
  name: z.string().min(1),
  ip: z.string().min(1),
  port: z.string().min(1),
  dataType: z.enum([PrinterDataType.TSPL_ZPL, PrinterDataType.ESC_POS]),
  description: z.optional(z.string()),
  printerId: z.string().min(1, 'Please select a printer connector'),
})
```

- [ ] **Step 1.6 — Implement hooks in `src/hooks/use-printer.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPrinterConnectors,
  getPrinterConnectorsByBranch,
  updatePrinterConnector,
  deletePrinterConnector,
  createInvoiceArea,
  getInvoiceAreasByBranch,
  updateInvoiceArea,
  deleteInvoiceArea,
  createPrinterForInvoiceArea,
  getPrintersForInvoiceArea,
  updatePrinterForInvoiceArea,
  deletePrinterForInvoiceArea,
  togglePrinterForInvoiceArea,
} from '@/api'
import {
  ICreatePrinterConnectorRequest,
  IUpdatePrinterConnectorRequest,
  ICreateInvoiceAreaRequest,
  IUpdateInvoiceAreaRequest,
  ICreatePrinterForInvoiceAreaRequest,
  IUpdatePrinterForInvoiceAreaRequest,
} from '@/types'
import { QUERYKEY } from '@/constants'

// ── Printer Connector ──────────────────────────────────────────────────────
export const useGetPrinterConnectorsByBranch = (branchSlug: string) => {
  return useQuery({
    queryKey: [QUERYKEY.printerConnectors, branchSlug],
    queryFn: () => getPrinterConnectorsByBranch(branchSlug),
    enabled: !!branchSlug,
  })
}

export const useCreatePrinterConnector = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: ICreatePrinterConnectorRequest) => createPrinterConnectors(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.printerConnectors] })
    },
  })
}

export const useUpdatePrinterConnector = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, params }: { slug: string; params: IUpdatePrinterConnectorRequest }) =>
      updatePrinterConnector(slug, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.printerConnectors] })
    },
  })
}

export const useDeletePrinterConnector = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => deletePrinterConnector(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.printerConnectors] })
    },
  })
}

// ── Invoice Area ───────────────────────────────────────────────────────────
export const useGetInvoiceAreasByBranch = (branch: string) => {
  return useQuery({
    queryKey: [QUERYKEY.invoiceAreas, branch],
    queryFn: () => getInvoiceAreasByBranch(branch),
    enabled: !!branch,
  })
}

export const useCreateInvoiceArea = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: ICreateInvoiceAreaRequest) => createInvoiceArea(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.invoiceAreas] })
    },
  })
}

export const useUpdateInvoiceArea = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: IUpdateInvoiceAreaRequest) => updateInvoiceArea(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.invoiceAreas] })
    },
  })
}

export const useDeleteInvoiceArea = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => deleteInvoiceArea(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.invoiceAreas] })
    },
  })
}

// ── Invoice Area Printers ──────────────────────────────────────────────────
export const useGetPrintersForInvoiceArea = (slug: string) => {
  return useQuery({
    queryKey: [QUERYKEY.invoiceAreaPrinters, slug],
    queryFn: () => getPrintersForInvoiceArea(slug),
    enabled: !!slug,
  })
}

export const useCreatePrinterForInvoiceArea = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: ICreatePrinterForInvoiceAreaRequest) => createPrinterForInvoiceArea(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.invoiceAreaPrinters] })
    },
  })
}

export const useUpdatePrinterForInvoiceArea = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: IUpdatePrinterForInvoiceAreaRequest) => updatePrinterForInvoiceArea(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.invoiceAreaPrinters] })
    },
  })
}

export const useDeletePrinterForInvoiceArea = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, printerSlug }: { slug: string; printerSlug: string }) =>
      deletePrinterForInvoiceArea(slug, printerSlug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.invoiceAreaPrinters] })
    },
  })
}

export const useTogglePrinterForInvoiceArea = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, printerSlug, isActive }: { slug: string; printerSlug: string; isActive: boolean }) =>
      togglePrinterForInvoiceArea(slug, printerSlug, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.invoiceAreaPrinters] })
    },
  })
}
```

- [ ] **Step 1.7 — Export new hooks from `src/hooks/index.ts`**

Add this line to `src/hooks/index.ts`:

```ts
export * from './use-printer'
```

- [ ] **Step 1.8 — Write hook tests**

Create `src/hooks/__tests__/use-printer.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import * as printerApi from '@/api'
import {
  useGetPrinterConnectorsByBranch,
  useCreatePrinterConnector,
  useDeletePrinterConnector,
  useGetInvoiceAreasByBranch,
  useCreateInvoiceArea,
} from '../use-printer'

vi.mock('@/api')

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useGetPrinterConnectorsByBranch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches connectors for a branch', async () => {
    vi.mocked(printerApi.getPrinterConnectorsByBranch).mockResolvedValue({
      code: 200, error: false, message: '', method: 'GET', path: '', timestamp: 0,
      result: [{ slug: 'conn-1', url: 'http://192.168.1.1', apiKey: 'key', createdAt: '' }],
    })

    const { result } = renderHook(
      () => useGetPrinterConnectorsByBranch('branch-1'),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.result).toHaveLength(1)
    expect(result.current.data?.result[0].slug).toBe('conn-1')
  })

  it('does not fetch when branchSlug is empty', () => {
    const { result } = renderHook(
      () => useGetPrinterConnectorsByBranch(''),
      { wrapper: createWrapper() },
    )
    expect(result.current.fetchStatus).toBe('idle')
    expect(printerApi.getPrinterConnectorsByBranch).not.toHaveBeenCalled()
  })
})

describe('useCreatePrinterConnector', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls createPrinterConnectors with correct params', async () => {
    const mockResult = { slug: 'conn-1', url: 'http://192.168.1.1', apiKey: 'key', createdAt: '' }
    vi.mocked(printerApi.createPrinterConnectors).mockResolvedValue({
      code: 200, error: false, message: '', method: 'POST', path: '', timestamp: 0,
      result: mockResult,
    })

    const { result } = renderHook(() => useCreatePrinterConnector(), { wrapper: createWrapper() })

    result.current.mutate({ branchSlug: 'branch-1', url: 'http://192.168.1.1', apiKey: 'key' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(printerApi.createPrinterConnectors).toHaveBeenCalledWith({
      branchSlug: 'branch-1',
      url: 'http://192.168.1.1',
      apiKey: 'key',
    })
  })
})

describe('useGetInvoiceAreasByBranch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches invoice areas for a branch', async () => {
    vi.mocked(printerApi.getInvoiceAreasByBranch).mockResolvedValue({
      code: 200, error: false, message: '', method: 'GET', path: '', timestamp: 0,
      result: [{ slug: 'area-1', name: 'Invoice Area 1', branch: 'branch-1', createdAt: '' }],
    })

    const { result } = renderHook(
      () => useGetInvoiceAreasByBranch('branch-1'),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.result[0].slug).toBe('area-1')
  })
})
```

- [ ] **Step 1.9 — Run tests**

```bash
npx vitest run src/hooks/__tests__/use-printer.test.ts
```

Expected: all tests pass.

- [ ] **Step 1.10 — Commit**

```bash
git add src/api/printer.ts src/types/area.type.ts src/constants/query.ts \
  src/schemas/printer.schema.ts src/schemas/chef-area.schema.ts \
  src/hooks/use-printer.ts src/hooks/index.ts \
  src/hooks/__tests__/use-printer.test.ts
git commit -m "feat(printer): fix API bugs, add types/schemas/query-keys, implement printer hooks"
```

---

## Task 2: PrinterConnectorSelect + Printer Connector UI in Config

**Files:**
- Create: `src/components/app/select/printer-connector-select.tsx`
- Create: `src/components/app/dialog/create-printer-connector-dialog.tsx`
- Create: `src/components/app/dialog/update-printer-connector-dialog.tsx`
- Create: `src/components/app/dialog/delete-printer-connector-dialog.tsx`
- Create: `src/components/app/sheet/create-printer-connector-sheet.tsx`
- Create: `src/components/app/sheet/update-printer-connector-sheet.tsx`
- Modify: `src/components/app/dialog/index.tsx`
- Modify: `src/components/app/sheet/index.tsx`
- Modify: `src/app/system/config/page.tsx`

---

- [ ] **Step 2.1 — Create `PrinterConnectorSelect` component**

Create `src/components/app/select/printer-connector-select.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { useGetPrinterConnectorsByBranch } from '@/hooks'

interface PrinterConnectorSelectProps {
  branchSlug: string
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
}

export default function PrinterConnectorSelect({
  branchSlug,
  value,
  onChange,
  disabled,
}: PrinterConnectorSelectProps) {
  const { t } = useTranslation('chefArea')
  const { data, isLoading } = useGetPrinterConnectorsByBranch(branchSlug)
  const connectors = data?.result ?? []

  return (
    <Select
      onValueChange={onChange}
      value={value}
      disabled={disabled || isLoading || !branchSlug}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t('printer.choosePrinterConnector')} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{t('printer.printerConnector')}</SelectLabel>
          {connectors.map((connector) => (
            <SelectItem key={connector.slug} value={connector.slug}>
              {connector.url}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 2.2 — Create `create-printer-connector-dialog.tsx`**

Create `src/components/app/dialog/create-printer-connector-dialog.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import {
  Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui'
import { ICreatePrinterConnectorRequest } from '@/types'
import { useCreatePrinterConnector } from '@/hooks'
import { showToast } from '@/utils'

interface CreatePrinterConnectorDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCloseSheet: () => void
  data: ICreatePrinterConnectorRequest | null
  onSuccess?: () => void
}

export default function CreatePrinterConnectorDialog({
  isOpen, onOpenChange, onCloseSheet, data, onSuccess,
}: CreatePrinterConnectorDialogProps) {
  const { t } = useTranslation(['chefArea', 'common', 'toast'])
  const { mutate: createConnector, isPending } = useCreatePrinterConnector()

  const handleConfirm = () => {
    if (!data) return
    createConnector(data, {
      onSuccess: () => {
        showToast(t('toast:toast.createPrinterConnectorSuccess'))
        onOpenChange(false)
        onCloseSheet()
        onSuccess?.()
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('chefArea:printerConnector.confirmCreate')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('chefArea:printerConnector.confirmCreateDescription')}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {t('common:common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2.3 — Create `update-printer-connector-dialog.tsx`**

Create `src/components/app/dialog/update-printer-connector-dialog.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import {
  Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui'
import { IUpdatePrinterConnectorRequest } from '@/types'
import { useUpdatePrinterConnector } from '@/hooks'
import { showToast } from '@/utils'

interface UpdatePrinterConnectorDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCloseSheet: () => void
  slug: string
  data: IUpdatePrinterConnectorRequest | null
  onSuccess?: () => void
}

export default function UpdatePrinterConnectorDialog({
  isOpen, onOpenChange, onCloseSheet, slug, data, onSuccess,
}: UpdatePrinterConnectorDialogProps) {
  const { t } = useTranslation(['chefArea', 'common', 'toast'])
  const { mutate: updateConnector, isPending } = useUpdatePrinterConnector()

  const handleConfirm = () => {
    if (!data) return
    updateConnector({ slug, params: data }, {
      onSuccess: () => {
        showToast(t('toast:toast.updatePrinterConnectorSuccess'))
        onOpenChange(false)
        onCloseSheet()
        onSuccess?.()
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('chefArea:printerConnector.confirmUpdate')}</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {t('common:common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2.4 — Create `delete-printer-connector-dialog.tsx`**

Create `src/components/app/dialog/delete-printer-connector-dialog.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import {
  Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui'
import { useDeletePrinterConnector } from '@/hooks'
import { showToast } from '@/utils'

interface DeletePrinterConnectorDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  slug: string
}

export default function DeletePrinterConnectorDialog({
  isOpen, onOpenChange, slug,
}: DeletePrinterConnectorDialogProps) {
  const { t } = useTranslation(['chefArea', 'common', 'toast'])
  const { mutate: deleteConnector, isPending } = useDeletePrinterConnector()

  const handleConfirm = () => {
    deleteConnector(slug, {
      onSuccess: () => {
        showToast(t('toast:toast.deletePrinterConnectorSuccess'))
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('chefArea:printerConnector.confirmDelete')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('chefArea:printerConnector.confirmDeleteDescription')}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:common.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {t('common:common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2.5 — Create `create-printer-connector-sheet.tsx`**

Create `src/components/app/sheet/create-printer-connector-sheet.tsx`:

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PlusCircle } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
  Button, ScrollArea, Input, Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui'
import { CreatePrinterConnectorDialog } from '@/components/app/dialog'
import { createPrinterConnectorSchema, TCreatePrinterConnectorSchema } from '@/schemas'
import { ICreatePrinterConnectorRequest } from '@/types'

interface CreatePrinterConnectorSheetProps {
  branchSlug: string
}

export default function CreatePrinterConnectorSheet({ branchSlug }: CreatePrinterConnectorSheetProps) {
  const { t } = useTranslation(['chefArea', 'common'])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState<ICreatePrinterConnectorRequest | null>(null)

  const form = useForm<TCreatePrinterConnectorSchema>({
    resolver: zodResolver(createPrinterConnectorSchema),
    defaultValues: { branchSlug, url: '', apiKey: '' },
  })

  const handleSubmit = (values: TCreatePrinterConnectorSchema) => {
    setFormData({ ...values, branchSlug })
    setDialogOpen(true)
  }

  const resetForm = () => {
    form.reset({ branchSlug, url: '', apiKey: '' })
  }

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button>
          <PlusCircle size={16} />
          {t('chefArea:printerConnector.create')}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">{t('chefArea:printerConnector.create')}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)] p-4">
            <Form {...form}>
              <form id="connector-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="p-4 bg-white rounded-md border dark:bg-transparent space-y-4">
                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel><span className="text-destructive">*</span> URL</FormLabel>
                        <FormControl>
                          <Input placeholder="http://192.168.1.100" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel><span className="text-destructive">*</span> API Key</FormLabel>
                        <FormControl>
                          <Input placeholder={t('chefArea:printerConnector.enterApiKey')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </form>
            </Form>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button type="submit" form="connector-form">
              {t('chefArea:printerConnector.create')}
            </Button>
          </SheetFooter>
        </div>
        {dialogOpen && (
          <CreatePrinterConnectorDialog
            isOpen={dialogOpen}
            onOpenChange={setDialogOpen}
            onCloseSheet={() => setSheetOpen(false)}
            data={formData}
            onSuccess={resetForm}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2.6 — Create `update-printer-connector-sheet.tsx`**

Create `src/components/app/sheet/update-printer-connector-sheet.tsx`:

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
  Button, ScrollArea, Input, Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui'
import { UpdatePrinterConnectorDialog } from '@/components/app/dialog'
import { updatePrinterConnectorSchema, TUpdatePrinterConnectorSchema } from '@/schemas'
import { IPrinterConnector, IUpdatePrinterConnectorRequest } from '@/types'

interface UpdatePrinterConnectorSheetProps {
  connector: IPrinterConnector
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export default function UpdatePrinterConnectorSheet({
  connector, isOpen, onOpenChange,
}: UpdatePrinterConnectorSheetProps) {
  const { t } = useTranslation(['chefArea', 'common'])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState<IUpdatePrinterConnectorRequest | null>(null)

  const form = useForm<TUpdatePrinterConnectorSchema>({
    resolver: zodResolver(updatePrinterConnectorSchema),
    defaultValues: { slug: connector.slug, url: connector.url, apiKey: connector.apiKey },
  })

  const handleSubmit = (values: TUpdatePrinterConnectorSchema) => {
    setFormData(values)
    setDialogOpen(true)
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">{t('chefArea:printerConnector.update')}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)] p-4">
            <Form {...form}>
              <form id="update-connector-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="p-4 bg-white rounded-md border dark:bg-transparent space-y-4">
                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel><span className="text-destructive">*</span> URL</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel><span className="text-destructive">*</span> API Key</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </form>
            </Form>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button type="submit" form="update-connector-form">
              {t('chefArea:printerConnector.update')}
            </Button>
          </SheetFooter>
        </div>
        {dialogOpen && (
          <UpdatePrinterConnectorDialog
            isOpen={dialogOpen}
            onOpenChange={setDialogOpen}
            onCloseSheet={() => onOpenChange(false)}
            slug={connector.slug}
            data={formData}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2.7 — Export new dialogs and sheets**

In `src/components/app/dialog/index.tsx`, add:
```ts
export { default as CreatePrinterConnectorDialog } from './create-printer-connector-dialog'
export { default as UpdatePrinterConnectorDialog } from './update-printer-connector-dialog'
export { default as DeletePrinterConnectorDialog } from './delete-printer-connector-dialog'
```

In `src/components/app/sheet/index.tsx`, add:
```ts
export { default as CreatePrinterConnectorSheet } from './create-printer-connector-sheet'
export { default as UpdatePrinterConnectorSheet } from './update-printer-connector-sheet'
```

- [ ] **Step 2.8 — Add Printer Connector section to Config page**

Create `src/app/system/config/printer-connector-section.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal } from 'lucide-react'
import moment from 'moment'
import {
  DataTable, Button, DropdownMenu, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuTrigger, DataTableColumnHeader,
} from '@/components/ui'
import { CreatePrinterConnectorSheet, UpdatePrinterConnectorSheet } from '@/components/app/sheet'
import { DeletePrinterConnectorDialog } from '@/components/app/dialog'
import { useGetPrinterConnectorsByBranch } from '@/hooks'
import { IPrinterConnector } from '@/types'
import { useBranchStore } from '@/stores'

export default function PrinterConnectorSection() {
  const { t } = useTranslation(['chefArea', 'common'])
  const branchSlug = useBranchStore((s) => s.currentBranch?.slug ?? '')
  const { data, isLoading } = useGetPrinterConnectorsByBranch(branchSlug)
  const connectors = data?.result ?? []

  const [editTarget, setEditTarget] = useState<IPrinterConnector | null>(null)
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null)

  const columns: ColumnDef<IPrinterConnector>[] = [
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('common:common.createdAt')} />,
      cell: ({ row }) => <span>{moment(row.original.createdAt).format('HH:mm:ss DD/MM/YYYY')}</span>,
    },
    {
      accessorKey: 'url',
      header: ({ column }) => <DataTableColumnHeader column={column} title="URL" />,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreHorizontal size={16} /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('common:common.actions')}</DropdownMenuLabel>
            <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => setEditTarget(row.original)}>
              {t('common:common.edit')}
            </Button>
            <Button variant="ghost" className="w-full justify-start text-sm text-destructive" onClick={() => setDeleteSlug(row.original.slug)}>
              {t('common:common.delete')}
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('chefArea:printerConnector.title')}</h2>
        <CreatePrinterConnectorSheet branchSlug={branchSlug} />
      </div>
      <DataTable columns={columns} data={connectors} isLoading={isLoading} />
      {editTarget && (
        <UpdatePrinterConnectorSheet
          connector={editTarget}
          isOpen={!!editTarget}
          onOpenChange={(open) => { if (!open) setEditTarget(null) }}
        />
      )}
      {deleteSlug && (
        <DeletePrinterConnectorDialog
          isOpen={!!deleteSlug}
          onOpenChange={(open) => { if (!open) setDeleteSlug(null) }}
          slug={deleteSlug}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2.9 — Add `PrinterConnectorSection` to Config page**

Modify `src/app/system/config/page.tsx` — add `PrinterConnectorSection` below `SystemConfigForm`:

```tsx
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { SquareMenu } from 'lucide-react'
import { ScrollArea } from '@/components/ui'
import { SystemConfigForm } from '@/components/app/form'
import PrinterConnectorSection from './printer-connector-section'

export default function MenuManagementPage() {
  const { t } = useTranslation(['config'])
  const { t: tHelmet } = useTranslation('helmet')

  return (
    <div className="flex flex-row h-full gap-2">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.config.title')}</title>
        <meta name="description" content={tHelmet('helmet.config.title')} />
      </Helmet>
      <ScrollArea className="flex-1">
        <div className="transition-all duration-300 ease-in-out">
          <div className="sticky top-0 z-10 flex flex-col items-center gap-6 pb-4">
            <span className="flex items-center justify-start w-full gap-1 text-lg">
              <SquareMenu />
              {t('config.title')}
            </span>
            <SystemConfigForm />
            <PrinterConnectorSection />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
```

- [ ] **Step 2.10 — Commit**

```bash
git add src/components/app/select/printer-connector-select.tsx \
  src/components/app/dialog/create-printer-connector-dialog.tsx \
  src/components/app/dialog/update-printer-connector-dialog.tsx \
  src/components/app/dialog/delete-printer-connector-dialog.tsx \
  src/components/app/sheet/create-printer-connector-sheet.tsx \
  src/components/app/sheet/update-printer-connector-sheet.tsx \
  src/components/app/dialog/index.tsx \
  src/components/app/sheet/index.tsx \
  src/app/system/config/printer-connector-section.tsx \
  src/app/system/config/page.tsx
git commit -m "feat(printer): add Printer Connector CRUD section to Config page"
```

---

## Task 3: Invoice Area pages + routes

**Files:**
- Create: `src/app/system/invoice-area/page.tsx`
- Create: `src/app/system/invoice-area/invoice-area-detail-page.tsx`
- Create: `src/app/system/invoice-area/index.tsx`
- Create: `src/app/system/invoice-area/DataTable/columns/invoice-printers-columns.tsx`
- Create: `src/app/system/invoice-area/DataTable/actions/invoice-printer-action-options.tsx`
- Create: `src/components/app/dialog/create-invoice-area-dialog.tsx`
- Create: `src/components/app/dialog/update-invoice-area-dialog.tsx`
- Create: `src/components/app/dialog/delete-invoice-area-dialog.tsx`
- Create: `src/components/app/dialog/create-invoice-printer-dialog.tsx`
- Create: `src/components/app/dialog/update-invoice-printer-dialog.tsx`
- Create: `src/components/app/dialog/delete-invoice-printer-dialog.tsx`
- Create: `src/components/app/dialog/toggle-invoice-printer-dialog.tsx`
- Create: `src/components/app/sheet/create-invoice-area-sheet.tsx`
- Create: `src/components/app/sheet/create-invoice-printer-sheet.tsx`
- Create: `src/components/app/sheet/update-invoice-printer-sheet.tsx`
- Modify: `src/components/app/dialog/index.tsx`
- Modify: `src/components/app/sheet/index.tsx`
- Modify: `src/router/loadable.tsx`
- Modify: `src/router/index.tsx`
- Modify: `src/constants/route.ts`

---

- [ ] **Step 3.1 — Create Invoice Area CRUD dialogs**

Create `src/components/app/dialog/create-invoice-area-dialog.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui'
import { ICreateInvoiceAreaRequest } from '@/types'
import { useCreateInvoiceArea } from '@/hooks'
import { showToast } from '@/utils'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCloseSheet: () => void
  data: ICreateInvoiceAreaRequest | null
  onSuccess?: () => void
}

export default function CreateInvoiceAreaDialog({ isOpen, onOpenChange, onCloseSheet, data, onSuccess }: Props) {
  const { t } = useTranslation(['chefArea', 'common', 'toast'])
  const { mutate, isPending } = useCreateInvoiceArea()

  const handleConfirm = () => {
    if (!data) return
    mutate(data, {
      onSuccess: () => {
        showToast(t('toast:toast.createInvoiceAreaSuccess'))
        onOpenChange(false)
        onCloseSheet()
        onSuccess?.()
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('chefArea:invoiceArea.confirmCreate')}</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:common.cancel')}</Button>
          <Button onClick={handleConfirm} disabled={isPending}>{t('common:common.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Create `src/components/app/dialog/update-invoice-area-dialog.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui'
import { IUpdateInvoiceAreaRequest } from '@/types'
import { useUpdateInvoiceArea } from '@/hooks'
import { showToast } from '@/utils'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCloseSheet: () => void
  data: IUpdateInvoiceAreaRequest | null
  onSuccess?: () => void
}

export default function UpdateInvoiceAreaDialog({ isOpen, onOpenChange, onCloseSheet, data, onSuccess }: Props) {
  const { t } = useTranslation(['chefArea', 'common', 'toast'])
  const { mutate, isPending } = useUpdateInvoiceArea()

  const handleConfirm = () => {
    if (!data) return
    mutate(data, {
      onSuccess: () => {
        showToast(t('toast:toast.updateInvoiceAreaSuccess'))
        onOpenChange(false)
        onCloseSheet()
        onSuccess?.()
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('chefArea:invoiceArea.confirmUpdate')}</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:common.cancel')}</Button>
          <Button onClick={handleConfirm} disabled={isPending}>{t('common:common.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Create `src/components/app/dialog/delete-invoice-area-dialog.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui'
import { useDeleteInvoiceArea } from '@/hooks'
import { showToast } from '@/utils'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  slug: string
}

export default function DeleteInvoiceAreaDialog({ isOpen, onOpenChange, slug }: Props) {
  const { t } = useTranslation(['chefArea', 'common', 'toast'])
  const { mutate, isPending } = useDeleteInvoiceArea()

  const handleConfirm = () => {
    mutate(slug, {
      onSuccess: () => {
        showToast(t('toast:toast.deleteInvoiceAreaSuccess'))
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('chefArea:invoiceArea.confirmDelete')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('chefArea:invoiceArea.confirmDeleteDescription')}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:common.cancel')}</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>{t('common:common.delete')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3.2 — Create Invoice Printer CRUD dialogs**

Create `src/components/app/dialog/create-invoice-printer-dialog.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui'
import { ICreatePrinterForInvoiceAreaRequest } from '@/types'
import { useCreatePrinterForInvoiceArea } from '@/hooks'
import { showToast } from '@/utils'
import { QUERYKEY } from '@/constants'
import { useQueryClient } from '@tanstack/react-query'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCloseSheet: () => void
  data: ICreatePrinterForInvoiceAreaRequest | null
  invoiceAreaSlug: string
  onSuccess?: () => void
}

export default function CreateInvoicePrinterDialog({ isOpen, onOpenChange, onCloseSheet, data, invoiceAreaSlug, onSuccess }: Props) {
  const { t } = useTranslation(['chefArea', 'common', 'toast'])
  const queryClient = useQueryClient()
  const { mutate, isPending } = useCreatePrinterForInvoiceArea()

  const handleConfirm = () => {
    if (!data) return
    mutate(data, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [QUERYKEY.invoiceAreaPrinters, invoiceAreaSlug] })
        showToast(t('toast:toast.createInvoicePrinterSuccess'))
        onOpenChange(false)
        onCloseSheet()
        onSuccess?.()
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('chefArea:invoiceArea.confirmCreatePrinter')}</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:common.cancel')}</Button>
          <Button onClick={handleConfirm} disabled={isPending}>{t('common:common.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Create `src/components/app/dialog/delete-invoice-printer-dialog.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui'
import { useDeletePrinterForInvoiceArea } from '@/hooks'
import { showToast } from '@/utils'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  invoiceAreaSlug: string
  printerSlug: string
}

export default function DeleteInvoicePrinterDialog({ isOpen, onOpenChange, invoiceAreaSlug, printerSlug }: Props) {
  const { t } = useTranslation(['chefArea', 'common', 'toast'])
  const { mutate, isPending } = useDeletePrinterForInvoiceArea()

  const handleConfirm = () => {
    mutate({ slug: invoiceAreaSlug, printerSlug }, {
      onSuccess: () => {
        showToast(t('toast:toast.deleteInvoicePrinterSuccess'))
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('chefArea:invoiceArea.confirmDeletePrinter')}</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:common.cancel')}</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>{t('common:common.delete')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3.3 — Create Invoice Area sheet (Create only; Update follows same pattern)**

Create `src/components/app/sheet/create-invoice-area-sheet.tsx`:

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PlusCircle } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
  Button, ScrollArea, Input, Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui'
import { CreateInvoiceAreaDialog } from '@/components/app/dialog'
import { createInvoiceAreaSchema, TCreateInvoiceAreaSchema } from '@/schemas'
import { ICreateInvoiceAreaRequest } from '@/types'

interface CreateInvoiceAreaSheetProps {
  branchSlug: string
}

export default function CreateInvoiceAreaSheet({ branchSlug }: CreateInvoiceAreaSheetProps) {
  const { t } = useTranslation(['chefArea', 'common'])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState<ICreateInvoiceAreaRequest | null>(null)

  const form = useForm<TCreateInvoiceAreaSchema>({
    resolver: zodResolver(createInvoiceAreaSchema),
    defaultValues: { branch: branchSlug, name: '', description: '' },
  })

  const handleSubmit = (values: TCreateInvoiceAreaSchema) => {
    setFormData({ ...values, branch: branchSlug })
    setDialogOpen(true)
  }

  const resetForm = () => form.reset({ branch: branchSlug, name: '', description: '' })

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button>
          <PlusCircle size={16} />
          {t('chefArea:invoiceArea.create')}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">{t('chefArea:invoiceArea.create')}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)] p-4">
            <Form {...form}>
              <form id="invoice-area-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="p-4 bg-white rounded-md border dark:bg-transparent space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel><span className="text-destructive">*</span> {t('chefArea:invoiceArea.name')}</FormLabel>
                        <FormControl><Input placeholder={t('chefArea:invoiceArea.enterName')} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('chefArea:invoiceArea.description')}</FormLabel>
                        <FormControl><Input placeholder={t('chefArea:invoiceArea.enterDescription')} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </form>
            </Form>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button type="submit" form="invoice-area-form">{t('chefArea:invoiceArea.create')}</Button>
          </SheetFooter>
        </div>
        {dialogOpen && (
          <CreateInvoiceAreaDialog
            isOpen={dialogOpen}
            onOpenChange={setDialogOpen}
            onCloseSheet={() => setSheetOpen(false)}
            data={formData}
            onSuccess={resetForm}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3.4 — Create Invoice Printer sheet**

Create `src/components/app/sheet/create-invoice-printer-sheet.tsx`:

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PlusCircle } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
  Button, ScrollArea, Input, Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui'
import { CreateInvoicePrinterDialog } from '@/components/app/dialog'
import { PrinterDataTypeSelect } from '@/components/app/select'
import PrinterConnectorSelect from '@/components/app/select/printer-connector-select'
import { createPrinterForInvoiceAreaSchema, TCreatePrinterForInvoiceAreaSchema } from '@/schemas'
import { ICreatePrinterForInvoiceAreaRequest } from '@/types'

interface CreateInvoicePrinterSheetProps {
  invoiceAreaSlug: string
  branchSlug: string
}

export default function CreateInvoicePrinterSheet({ invoiceAreaSlug, branchSlug }: CreateInvoicePrinterSheetProps) {
  const { t } = useTranslation(['chefArea', 'common'])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState<ICreatePrinterForInvoiceAreaRequest | null>(null)

  const form = useForm<TCreatePrinterForInvoiceAreaSchema>({
    resolver: zodResolver(createPrinterForInvoiceAreaSchema),
    defaultValues: { slug: invoiceAreaSlug, name: '', ip: '', port: '', dataType: 'tspl-zpl', description: '', printerId: '' },
  })

  const handleSubmit = (values: TCreatePrinterForInvoiceAreaSchema) => {
    setFormData({ ...values, slug: invoiceAreaSlug })
    setDialogOpen(true)
  }

  const resetForm = () => form.reset({ slug: invoiceAreaSlug, name: '', ip: '', port: '', dataType: 'tspl-zpl', description: '', printerId: '' })

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button>
          <PlusCircle size={16} />
          {t('chefArea:printer.create')}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">{t('chefArea:printer.create')}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)] p-4">
            <Form {...form}>
              <form id="invoice-printer-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="p-4 bg-white rounded-md border dark:bg-transparent space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel><span className="text-destructive">*</span> {t('chefArea:printer.name')}</FormLabel>
                      <FormControl><Input placeholder={t('chefArea:printer.enterPrinterName')} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('chefArea:printer.description')}</FormLabel>
                      <FormControl><Input placeholder={t('chefArea:printer.enterPrinterDescription')} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-2 p-4 bg-white rounded-md border dark:bg-transparent">
                  <FormField control={form.control} name="ip" render={({ field }) => (
                    <FormItem>
                      <FormLabel><span className="text-destructive">*</span> {t('chefArea:printer.ip')}</FormLabel>
                      <FormControl><Input placeholder={t('chefArea:printer.enterPrinterIp')} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="port" render={({ field }) => (
                    <FormItem>
                      <FormLabel><span className="text-destructive">*</span> {t('chefArea:printer.port')}</FormLabel>
                      <FormControl><Input type="number" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)} placeholder={t('chefArea:printer.enterPrinterPort')} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="p-4 bg-white rounded-md border dark:bg-transparent space-y-4">
                  <FormField control={form.control} name="dataType" render={({ field }) => (
                    <FormItem>
                      <FormLabel><span className="text-destructive">*</span> {t('chefArea:printer.dataType')}</FormLabel>
                      <FormControl>
                        <PrinterDataTypeSelect value={field.value as any} onChange={field.onChange as any} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="printerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel><span className="text-destructive">*</span> {t('chefArea:printer.printerConnector')}</FormLabel>
                      <FormControl>
                        <PrinterConnectorSelect branchSlug={branchSlug} value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </form>
            </Form>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button type="submit" form="invoice-printer-form">{t('chefArea:printer.create')}</Button>
          </SheetFooter>
        </div>
        {dialogOpen && (
          <CreateInvoicePrinterDialog
            isOpen={dialogOpen}
            onOpenChange={setDialogOpen}
            onCloseSheet={() => setSheetOpen(false)}
            data={formData}
            invoiceAreaSlug={invoiceAreaSlug}
            onSuccess={resetForm}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3.5 — Create Invoice Area DataTable columns**

Create `src/app/system/invoice-area/DataTable/columns/invoice-printers-columns.tsx`:

```tsx
import moment from 'moment'
import { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal } from 'lucide-react'
import {
  Button, DataTableColumnHeader, DropdownMenu, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui'
import { IPrinter } from '@/types'
import { DeleteInvoicePrinterDialog } from '@/components/app/dialog'
import { useState } from 'react'

interface ActionsProps { printer: IPrinter; invoiceAreaSlug: string }

function PrinterActions({ printer, invoiceAreaSlug }: ActionsProps) {
  const { t } = useTranslation(['common'])
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon"><MoreHorizontal size={16} /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
          <Button variant="ghost" className="w-full justify-start text-sm text-destructive" onClick={() => setDeleteOpen(true)}>
            {t('common.delete')}
          </Button>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteInvoicePrinterDialog
        isOpen={deleteOpen}
        onOpenChange={setDeleteOpen}
        invoiceAreaSlug={invoiceAreaSlug}
        printerSlug={printer.slug}
      />
    </>
  )
}

export const useInvoicePrintersColumns = (invoiceAreaSlug: string): ColumnDef<IPrinter>[] => {
  const { t } = useTranslation(['chefArea'])

  return [
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('printer.createdAt')} />,
      cell: ({ row }) => <span>{moment(row.original.createdAt).format('HH:mm:ss DD/MM/YYYY')}</span>,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('printer.name')} />,
    },
    {
      accessorKey: 'ip',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('printer.ip')} />,
    },
    {
      accessorKey: 'port',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('printer.port')} />,
    },
    {
      accessorKey: 'printerId',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('printer.printerConnector')} />,
    },
    {
      id: 'actions',
      cell: ({ row }) => <PrinterActions printer={row.original} invoiceAreaSlug={invoiceAreaSlug} />,
    },
  ]
}
```

- [ ] **Step 3.6 — Create Invoice Area Detail page**

Create `src/app/system/invoice-area/invoice-area-detail-page.tsx`:

```tsx
import { useParams } from 'react-router-dom'
import moment from 'moment'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { SquareMenu } from 'lucide-react'
import { DataTable, Badge } from '@/components/ui'
import { useGetInvoiceAreasByBranch, useGetPrintersForInvoiceArea } from '@/hooks'
import { useInvoicePrintersColumns } from './DataTable/columns/invoice-printers-columns'
import { CreateInvoicePrinterSheet } from '@/components/app/sheet'
import { useBranchStore } from '@/stores'

export default function InvoiceAreaDetailPage() {
  const { t } = useTranslation(['chefArea'])
  const { t: tHelmet } = useTranslation('helmet')
  const { slug } = useParams<{ slug: string }>()
  const branchSlug = useBranchStore((s) => s.currentBranch?.slug ?? '')

  const { data: areasData } = useGetInvoiceAreasByBranch(branchSlug)
  const invoiceArea = areasData?.result?.find((a) => a.slug === slug)

  const { data: printersData, isLoading } = useGetPrintersForInvoiceArea(slug ?? '')
  const printers = printersData?.result ?? []
  const columns = useInvoicePrintersColumns(slug ?? '')

  return (
    <div className="flex flex-col flex-1 w-full pb-2">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.invoiceArea.title')}</title>
        <meta name="description" content={tHelmet('helmet.invoiceArea.title')} />
      </Helmet>
      <span className="flex items-center justify-between text-lg mb-4">
        <span className="flex items-center gap-2">
          <SquareMenu />
          {invoiceArea?.name ?? slug}
        </span>
        <Badge variant="outline">{invoiceArea?.description}</Badge>
      </span>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-medium">{t('chefArea:invoiceArea.printers')}</h2>
        {slug && branchSlug && (
          <CreateInvoicePrinterSheet invoiceAreaSlug={slug} branchSlug={branchSlug} />
        )}
      </div>
      <DataTable columns={columns} data={printers} isLoading={isLoading} />
    </div>
  )
}
```

- [ ] **Step 3.7 — Create Invoice Area List page**

Create `src/app/system/invoice-area/page.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, SquareMenu } from 'lucide-react'
import moment from 'moment'
import {
  DataTable, Button, DropdownMenu, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuTrigger, DataTableColumnHeader,
} from '@/components/ui'
import { CreateInvoiceAreaSheet } from '@/components/app/sheet'
import { DeleteInvoiceAreaDialog } from '@/components/app/dialog'
import { useGetInvoiceAreasByBranch } from '@/hooks'
import { IInvoiceArea } from '@/types'
import { ROUTE } from '@/constants'
import { useBranchStore } from '@/stores'

export default function InvoiceAreaPage() {
  const { t } = useTranslation(['chefArea', 'common'])
  const { t: tHelmet } = useTranslation('helmet')
  const navigate = useNavigate()
  const branchSlug = useBranchStore((s) => s.currentBranch?.slug ?? '')
  const { data, isLoading } = useGetInvoiceAreasByBranch(branchSlug)
  const areas = data?.result ?? []

  const [deleteSlug, setDeleteSlug] = useState<string | null>(null)

  const columns: ColumnDef<IInvoiceArea>[] = [
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('common:common.createdAt')} />,
      cell: ({ row }) => <span>{moment(row.original.createdAt).format('HH:mm:ss DD/MM/YYYY')}</span>,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('chefArea:invoiceArea.name')} />,
      cell: ({ row }) => (
        <button
          className="text-primary hover:underline text-left"
          onClick={() => navigate(`${ROUTE.STAFF_INVOICE_AREA_MANAGEMENT}/${row.original.slug}`)}
        >
          {row.original.name}
        </button>
      ),
    },
    {
      accessorKey: 'description',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('chefArea:invoiceArea.description')} />,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreHorizontal size={16} /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('common:common.actions')}</DropdownMenuLabel>
            <Button
              variant="ghost"
              className="w-full justify-start text-sm text-destructive"
              onClick={() => setDeleteSlug(row.original.slug)}
            >
              {t('common:common.delete')}
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-col flex-1 w-full pb-2">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.invoiceArea.title')}</title>
        <meta name="description" content={tHelmet('helmet.invoiceArea.title')} />
      </Helmet>
      <div className="flex items-center justify-between mb-4">
        <span className="flex items-center gap-2 text-lg">
          <SquareMenu />
          {t('chefArea:invoiceArea.title')}
        </span>
        <CreateInvoiceAreaSheet branchSlug={branchSlug} />
      </div>
      <DataTable columns={columns} data={areas} isLoading={isLoading} />
      {deleteSlug && (
        <DeleteInvoiceAreaDialog
          isOpen={!!deleteSlug}
          onOpenChange={(open) => { if (!open) setDeleteSlug(null) }}
          slug={deleteSlug}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3.8 — Create page index export**

Create `src/app/system/invoice-area/index.tsx`:

```ts
export { default as InvoiceAreaPage } from './page'
export { default as InvoiceAreaDetailPage } from './invoice-area-detail-page'
```

- [ ] **Step 3.9 — Add route constant**

In `src/constants/route.ts`, add:

```ts
STAFF_INVOICE_AREA_MANAGEMENT: '/system/invoice-area',
```

- [ ] **Step 3.10 — Register lazy pages in `src/router/loadable.tsx`**

Add these two exports:

```ts
export const InvoiceAreaPage = React.lazy(() =>
  import('@/app/system/invoice-area').then((module) => ({
    default: module.InvoiceAreaPage,
  }))
)

export const InvoiceAreaDetailPage = React.lazy(() =>
  import('@/app/system/invoice-area').then((module) => ({
    default: module.InvoiceAreaDetailPage,
  }))
)
```

- [ ] **Step 3.11 — Add routes in `src/router/index.tsx`**

Add inside the system routes (alongside the chef-area routes):

```tsx
{
  path: ROUTE.STAFF_INVOICE_AREA_MANAGEMENT,
  element: <InvoiceAreaPage />,
},
{
  path: `${ROUTE.STAFF_INVOICE_AREA_MANAGEMENT}/:slug`,
  element: <InvoiceAreaDetailPage />,
},
```

- [ ] **Step 3.12 — Export new components**

In `src/components/app/dialog/index.tsx`, add:
```ts
export { default as CreateInvoiceAreaDialog } from './create-invoice-area-dialog'
export { default as UpdateInvoiceAreaDialog } from './update-invoice-area-dialog'
export { default as DeleteInvoiceAreaDialog } from './delete-invoice-area-dialog'
export { default as CreateInvoicePrinterDialog } from './create-invoice-printer-dialog'
export { default as DeleteInvoicePrinterDialog } from './delete-invoice-printer-dialog'
```

In `src/components/app/sheet/index.tsx`, add:
```ts
export { default as CreateInvoiceAreaSheet } from './create-invoice-area-sheet'
export { default as CreateInvoicePrinterSheet } from './create-invoice-printer-sheet'
```

- [ ] **Step 3.13 — Commit**

```bash
git add src/app/system/invoice-area/ \
  src/components/app/dialog/create-invoice-area-dialog.tsx \
  src/components/app/dialog/update-invoice-area-dialog.tsx \
  src/components/app/dialog/delete-invoice-area-dialog.tsx \
  src/components/app/dialog/create-invoice-printer-dialog.tsx \
  src/components/app/dialog/delete-invoice-printer-dialog.tsx \
  src/components/app/sheet/create-invoice-area-sheet.tsx \
  src/components/app/sheet/create-invoice-printer-sheet.tsx \
  src/components/app/dialog/index.tsx \
  src/components/app/sheet/index.tsx \
  src/router/loadable.tsx \
  src/router/index.tsx \
  src/constants/route.ts
git commit -m "feat(invoice-area): add Invoice Area and Invoice Printer management pages"
```

---

## Task 4: Add `printerId` to Chef Area printer forms

**Files:**
- Modify: `src/components/app/sheet/create-printer-sheet.tsx`
- Modify: `src/components/app/sheet/update-printer-sheet.tsx`
- Modify: `src/components/app/dialog/confirm-create-printer-dialog.tsx`
- Modify: `src/components/app/dialog/confirm-update-printer-dialog.tsx`

---

- [ ] **Step 4.1 — Add `printerId` field to `create-printer-sheet.tsx`**

In `src/components/app/sheet/create-printer-sheet.tsx`:

1. Import `PrinterConnectorSelect` and the chef area's branch slug:

```tsx
// Add imports
import PrinterConnectorSelect from '@/components/app/select/printer-connector-select'
import { useGetChefAreaBySlug } from '@/hooks'
```

2. Inside the component, resolve `branchSlug`:

```tsx
const { data: chefAreaData } = useGetChefAreaBySlug(slug as string)
const branchSlug = chefAreaData?.result?.branch?.slug ?? ''
```

3. Add `printerId` to `defaultValues`:

```tsx
defaultValues: {
  name: '',
  ip: '',
  port: '',
  dataType: PrinterDataType.TSPL_ZPL,
  description: '',
  slug: slug || '',
  printerId: '',  // add this
},
```

4. Add the `printerId` form field inside the form (after `dataType`):

```tsx
// Add to formFields object:
printerId: (
  <FormField
    control={form.control}
    name="printerId"
    render={({ field }) => (
      <FormItem>
        <FormLabel className="flex items-center gap-1">
          <span className="text-destructive">*</span>
          {t('printer.printerConnector')}
        </FormLabel>
        <FormControl>
          <PrinterConnectorSelect
            branchSlug={branchSlug}
            value={field.value}
            onChange={field.onChange}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
),
```

5. Add `{formFields.printerId}` in the form JSX after `{formFields.dataType}`:

```tsx
<div className={`grid grid-cols-1 gap-2 p-4 bg-white rounded-md border dark:bg-transparent`}>
  {formFields.dataType}
  {formFields.printerId}
</div>
```

- [ ] **Step 4.2 — Add `printerId` field to `update-printer-sheet.tsx`**

Apply the same changes as Step 4.1 to `update-printer-sheet.tsx`:

1. Import `PrinterConnectorSelect` and `useGetChefAreaBySlug`
2. Resolve `branchSlug` from the chef area slug (the `slug` from `useParams`)
3. Add `printerId: printer.printerId ?? ''` to `defaultValues`
4. Add the `printerId` form field using `PrinterConnectorSelect`

- [ ] **Step 4.3 — Pass `printerId` in create dialog**

In `src/components/app/dialog/confirm-create-printer-dialog.tsx`, `ICreatePrinterForChefAreaRequest` now includes `printerId`. The dialog receives the full `printer` object from the sheet — no changes needed since the sheet already includes `printerId` in the submitted data. Verify the `createPrinter(printer, ...)` call passes the full object as-is.

- [ ] **Step 4.4 — Pass `printerId` in update dialog**

Same as Step 4.3 for `confirm-update-printer-dialog.tsx` — verify the full `IUpdatePrinterForChefAreaRequest` including `printerId` is passed through.

- [ ] **Step 4.5 — Run lint + typecheck**

```bash
npm run lint
npx tsc -b
```

Expected: 0 errors.

- [ ] **Step 4.6 — Commit**

```bash
git add src/components/app/sheet/create-printer-sheet.tsx \
  src/components/app/sheet/update-printer-sheet.tsx \
  src/components/app/dialog/confirm-create-printer-dialog.tsx \
  src/components/app/dialog/confirm-update-printer-dialog.tsx
git commit -m "feat(chef-area): add printerId field to printer create/update forms"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Fix API bugs in `printer.ts` | Task 1.1 |
| Add query keys for new entities | Task 1.3 |
| Zod schemas for all new forms | Task 1.4–1.5 |
| Hooks for Printer Connector CRUD | Task 1.6 |
| Hooks for Invoice Area CRUD | Task 1.6 |
| Hooks for Invoice Printer CRUD | Task 1.6 |
| `PrinterConnectorSelect` reusable component | Task 2.1 |
| Printer Connector CRUD in Config page | Task 2.2–2.10 |
| Invoice Area list page | Task 3.7 |
| Invoice Area detail page + printer table | Task 3.6 |
| Create printer in invoice area (with `printerId`) | Task 3.4 |
| Delete printer in invoice area | Task 3.2 |
| Routes for invoice area pages | Task 3.9–3.11 |
| `printerId` in Chef Area create printer form | Task 4.1 |
| `printerId` in Chef Area update printer form | Task 4.2 |

**Missing:** `update-invoice-printer-sheet.tsx` — the plan includes `create` but defers `update` to follow the same pattern. Add if needed by the backend team.
