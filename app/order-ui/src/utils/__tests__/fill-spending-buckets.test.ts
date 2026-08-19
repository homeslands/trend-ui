import { describe, it, expect } from 'vitest'
import { fillSpendingBuckets } from '../fill-spending-buckets'
import { ICustomerAccountRevenueTimeItem, UserStatisticsGroupBy } from '@/types'

// Dựng một mốc CHI TIÊU đầy đủ 11 trường — chỉ cần khai trực tiếp những trường một
// test quan tâm, phần còn lại mặc định 0, để test không phải gõ lại cả breakdown mỗi
// lần chỉ muốn kiểm tra `totalAmount`/`count`.
function bucket(
  overrides: Partial<ICustomerAccountRevenueTimeItem> & { time: string },
): ICustomerAccountRevenueTimeItem {
  return {
    count: 0,
    totalAmount: 0,
    countPoint: 0,
    countBank: 0,
    countCash: 0,
    countCreditCard: 0,
    totalAmountPoint: 0,
    totalAmountBank: 0,
    totalAmountCash: 0,
    totalAmountCreditCard: 0,
    ...overrides,
  }
}

describe('fillSpendingBuckets', () => {
  it('fills missing day buckets with 0', () => {
    const data = [
      bucket({ time: '2026-07-01T00:00:00', count: 3, totalAmount: 150000 }),
      bucket({ time: '2026-07-04T00:00:00', count: 5, totalAmount: 220000 }),
    ]
    const r = fillSpendingBuckets(
      data,
      '2026-07-01T00:00:00',
      '2026-07-04T23:59:59',
      UserStatisticsGroupBy.DAY,
    )
    expect(r).toHaveLength(4)
    expect(r.map((x) => x.totalAmount)).toEqual([150000, 0, 0, 220000])
    expect(r[0].time).toBe('2026-07-01T00:00:00')
  })

  // `count` đi kèm `totalAmount` trong response thật — hai lượt bucket phải ghép
  // đúng mốc, không lệch chỉ số.
  it('carries `count` through the same buckets as `totalAmount`', () => {
    const data = [
      bucket({ time: '2026-07-01T00:00:00', count: 3, totalAmount: 150000 }),
      bucket({ time: '2026-07-04T00:00:00', count: 5, totalAmount: 220000 }),
    ]
    const r = fillSpendingBuckets(
      data,
      '2026-07-01T00:00:00',
      '2026-07-04T23:59:59',
      UserStatisticsGroupBy.DAY,
    )
    expect(r.map((x) => x.count)).toEqual([3, 0, 0, 5])
  })

  it('sums amounts and counts landing in the same bucket', () => {
    const data = [
      bucket({ time: '2026-07-01T03:00:00', count: 2, totalAmount: 100 }),
      bucket({ time: '2026-07-01T20:00:00', count: 1, totalAmount: 50 }),
    ]
    const r = fillSpendingBuckets(
      data,
      '2026-07-01T00:00:00',
      '2026-07-01T23:59:59',
      UserStatisticsGroupBy.DAY,
    )
    expect(r).toHaveLength(1)
    expect(r[0].totalAmount).toBe(150)
    expect(r[0].count).toBe(3)
  })

  it('returns a copy of data when range is missing', () => {
    const data = [bucket({ time: '2026-07-01T00:00:00', count: 1, totalAmount: 10 })]
    expect(fillSpendingBuckets(data, '', '', UserStatisticsGroupBy.DAY)).toEqual(data)
  })

  it('returns all-zero buckets for empty data', () => {
    const r = fillSpendingBuckets(
      [],
      '2026-07-01T00:00:00',
      '2026-07-03T23:59:59',
      UserStatisticsGroupBy.DAY,
    )
    expect(r.map((x) => x.totalAmount)).toEqual([0, 0, 0])
    expect(r.map((x) => x.count)).toEqual([0, 0, 0])
  })

  // Phân rã theo phương thức thanh toán (mới thêm) phải sống sót qua bước điền bucket
  // y hệt `totalAmount`/`count`: mốc có dữ liệu giữ nguyên giá trị, mốc thiếu = 0.
  it('preserves the per-method breakdown (e.g. `totalAmountCash`) per bucket and zero-fills it on a missing bucket', () => {
    const data = [
      bucket({
        time: '2026-07-01T00:00:00',
        count: 13,
        totalAmount: 872500,
        countCash: 6,
        countCreditCard: 7,
        totalAmountCash: 244500,
        totalAmountCreditCard: 628000,
      }),
      bucket({
        time: '2026-07-03T00:00:00',
        count: 2,
        totalAmount: 50000,
        countBank: 1,
        countPoint: 1,
        totalAmountBank: 30000,
        totalAmountPoint: 20000,
      }),
    ]
    const r = fillSpendingBuckets(
      data,
      '2026-07-01T00:00:00',
      '2026-07-03T23:59:59',
      UserStatisticsGroupBy.DAY,
    )
    expect(r).toHaveLength(3)
    // Mốc có dữ liệu: breakdown giữ nguyên.
    expect(r[0].totalAmountCash).toBe(244500)
    expect(r[0].totalAmountCreditCard).toBe(628000)
    expect(r[0].countCash).toBe(6)
    // Mốc thiếu ở giữa: zero-filled trên MỌI trường breakdown, không chỉ totalAmount.
    expect(r[1].totalAmountCash).toBe(0)
    expect(r[1].totalAmountBank).toBe(0)
    expect(r[1].countCash).toBe(0)
    // Mốc có dữ liệu khác: breakdown đúng của riêng nó, không lẫn từ mốc khác.
    expect(r[2].totalAmountBank).toBe(30000)
    expect(r[2].totalAmountPoint).toBe(20000)
    expect(r[2].totalAmountCash).toBe(0)
  })
})
