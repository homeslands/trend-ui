import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useLookupVoucherByQr } from '@/hooks'
import * as voucherApi from '@/api/voucher'

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const voucher = { slug: 'abc123', code: 'ABC123' }

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('useLookupVoucherByQr', () => {
  it('tra theo slug TRƯỚC — mã QR in ra chứa slug', async () => {
    const spy = vi
      .spyOn(voucherApi, 'getSpecificVoucher')
      .mockResolvedValue({ result: voucher } as never)

    const { result } = renderHook(() => useLookupVoucherByQr(), { wrapper })
    result.current.mutate({ identifier: 'abc123', isPublic: false })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledWith({ slug: 'abc123' })
    expect(result.current.data).toEqual(voucher)
  })

  it('thử lại theo code khi tra slug không ra — nhân viên gõ tay mã trên nhãn', async () => {
    const spy = vi
      .spyOn(voucherApi, 'getSpecificVoucher')
      .mockResolvedValueOnce({ result: null } as never)
      .mockResolvedValueOnce({ result: voucher } as never)

    const { result } = renderHook(() => useLookupVoucherByQr(), { wrapper })
    result.current.mutate({ identifier: 'ABC123', isPublic: false })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenNthCalledWith(1, { slug: 'ABC123' })
    expect(spy).toHaveBeenNthCalledWith(2, { code: 'ABC123' })
    expect(result.current.data).toEqual(voucher)
  })

  it('dùng endpoint public khi isPublic = true', async () => {
    const spy = vi
      .spyOn(voucherApi, 'getSpecificPublicVoucher')
      .mockResolvedValue({ result: voucher } as never)

    const { result } = renderHook(() => useLookupVoucherByQr(), { wrapper })
    result.current.mutate({ identifier: 'abc123', isPublic: true })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledWith({ slug: 'abc123' })
  })

  it('lỗi khi cả hai lần tra đều không ra', async () => {
    vi.spyOn(voucherApi, 'getSpecificVoucher').mockResolvedValue({
      result: null,
    } as never)

    const { result } = renderHook(() => useLookupVoucherByQr(), { wrapper })
    result.current.mutate({ identifier: 'khong-ton-tai', isPublic: false })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('thử lại theo code khi tra slug ném lỗi', async () => {
    const spy = vi
      .spyOn(voucherApi, 'getSpecificVoucher')
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce({ result: voucher } as never)

    const { result } = renderHook(() => useLookupVoucherByQr(), { wrapper })
    result.current.mutate({ identifier: 'ABC123', isPublic: false })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
