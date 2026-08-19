import { describe, it, expect } from 'vitest'
import moment from 'moment'
import { isVoucherExpired, isVoucherInActiveTimeWindow } from '@/utils/voucher-time'
import { IVoucher } from '@/types/voucher.type'

const makeVoucher = (overrides: Partial<IVoucher>): IVoucher =>
  ({
    endDate: '2099-12-31T23:59:59Z',
    activeStartTime: null,
    activeEndTime: null,
    ...overrides,
  } as IVoucher)

describe('isVoucherExpired', () => {
  it('returns false when endDate is far in the future', () => {
    const voucher = makeVoucher({ endDate: '2099-12-31T23:59:59Z' })
    expect(isVoucherExpired(voucher)).toBe(false)
  })

  it('returns false within 30-min grace period after endDate', () => {
    const endDate = moment().subtract(20, 'minutes').toISOString()
    expect(isVoucherExpired(makeVoucher({ endDate }))).toBe(false)
  })

  it('returns true after grace period expires', () => {
    const endDate = moment().subtract(31, 'minutes').toISOString()
    expect(isVoucherExpired(makeVoucher({ endDate }))).toBe(true)
  })
})

describe('isVoucherInActiveTimeWindow', () => {
  it('returns true when both times are null (all day)', () => {
    expect(isVoucherInActiveTimeWindow(makeVoucher({}))).toBe(true)
  })

  it('returns true when now is inside the window', () => {
    const now = moment().set({ hour: 15, minute: 0, second: 0 })
    const v = makeVoucher({ activeStartTime: '14:00', activeEndTime: '16:00' })
    expect(isVoucherInActiveTimeWindow(v, now)).toBe(true)
  })

  it('returns false when now is before the window', () => {
    const now = moment().set({ hour: 13, minute: 59, second: 0 })
    const v = makeVoucher({ activeStartTime: '14:00', activeEndTime: '16:00' })
    expect(isVoucherInActiveTimeWindow(v, now)).toBe(false)
  })

  it('returns true at exact start boundary', () => {
    const now = moment().set({ hour: 14, minute: 0, second: 0 })
    const v = makeVoucher({ activeStartTime: '14:00', activeEndTime: '16:00' })
    expect(isVoucherInActiveTimeWindow(v, now)).toBe(true)
  })

  it('returns true within 30-min grace after activeEndTime', () => {
    const now = moment().set({ hour: 16, minute: 20, second: 0 })
    const v = makeVoucher({ activeStartTime: '14:00', activeEndTime: '16:00' })
    expect(isVoucherInActiveTimeWindow(v, now)).toBe(true)
  })

  it('returns false after grace period ends', () => {
    const now = moment().set({ hour: 16, minute: 31, second: 0 })
    const v = makeVoucher({ activeStartTime: '14:00', activeEndTime: '16:00' })
    expect(isVoucherInActiveTimeWindow(v, now)).toBe(false)
  })

  it('handles grace period wrapping past midnight', () => {
    const now = moment().set({ hour: 0, minute: 10, second: 0 })
    const v = makeVoucher({ activeStartTime: '23:00', activeEndTime: '23:50' })
    expect(isVoucherInActiveTimeWindow(v, now)).toBe(true)
  })

  it('returns false well past midnight grace wrap', () => {
    const now = moment().set({ hour: 0, minute: 21, second: 0 })
    const v = makeVoucher({ activeStartTime: '23:00', activeEndTime: '23:50' })
    expect(isVoucherInActiveTimeWindow(v, now)).toBe(false)
  })
})
