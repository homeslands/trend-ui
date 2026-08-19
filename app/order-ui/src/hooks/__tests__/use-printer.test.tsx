import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import * as printerApi from '@/api'
import {
  useGetPrinterConnectorsByBranch,
  useCreatePrinterConnector,
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
      result: { slug: 'conn-1', url: 'http://192.168.1.1', apiKey: 'key', createdAt: '' },
    })

    const { result } = renderHook(
      () => useGetPrinterConnectorsByBranch('branch-1'),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.result?.slug).toBe('conn-1')
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

describe('useCreateInvoiceArea', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls createInvoiceArea with correct params', async () => {
    vi.mocked(printerApi.createInvoiceArea).mockResolvedValue({
      code: 200, error: false, message: '', method: 'POST', path: '', timestamp: 0,
      result: { slug: 'area-1', name: 'Area 1', branch: 'branch-1', createdAt: '' },
    })

    const { result } = renderHook(() => useCreateInvoiceArea(), { wrapper: createWrapper() })

    result.current.mutate({ branch: 'branch-1', name: 'Area 1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(printerApi.createInvoiceArea).toHaveBeenCalledWith({ branch: 'branch-1', name: 'Area 1' })
  })
})
