import { describe, it, expect } from 'vitest'

import { fillPointTransactionBuckets } from '../fill-point-transaction-buckets'
import { UserStatisticsGroupBy } from '@/types'

describe('fillPointTransactionBuckets', () => {
  it('fills missing day buckets with 0 on every numeric field', () => {
    // Chuỗi thưa đúng như BE trả: chỉ mốc CÓ giao dịch, 01/07 rồi nhảy sang 04/07.
    const data = [
      { time: '2026-07-01T00:00:00', count: 3, earn: 150000, spend: 12000 },
      { time: '2026-07-04T00:00:00', count: 5, earn: 300000, spend: 19000 },
    ]

    const result = fillPointTransactionBuckets(
      data,
      '2026-07-01T00:00:00',
      '2026-07-04T23:59:59',
      UserStatisticsGroupBy.DAY,
    )

    expect(result).toHaveLength(4)
    expect(result.map((item) => item.earn)).toEqual([150000, 0, 0, 300000])
    expect(result.map((item) => item.spend)).toEqual([12000, 0, 0, 19000])
    expect(result.map((item) => item.count)).toEqual([3, 0, 0, 5])
  })

  it('keeps earn/spend/count aligned to the same bucket (no cross-field drift)', () => {
    // Bảo vệ bất biến của cách ghép: ba trường được điền qua BA lượt riêng rồi ghép
    // theo index — nếu lượt nào lệch dãy mốc, giá trị sẽ nhảy sang bucket khác.
    const result = fillPointTransactionBuckets(
      [{ time: '2026-07-02T00:00:00', count: 7, earn: 1800000, spend: 100000 }],
      '2026-07-01T00:00:00',
      '2026-07-03T23:59:59',
      UserStatisticsGroupBy.DAY,
    )

    expect(result).toHaveLength(3)
    expect(result[1]).toMatchObject({ count: 7, earn: 1800000, spend: 100000 })
    expect(result[0]).toMatchObject({ count: 0, earn: 0, spend: 0 })
    expect(result[2]).toMatchObject({ count: 0, earn: 0, spend: 0 })
  })

  it('returns an empty series when the API sends none', () => {
    expect(
      fillPointTransactionBuckets([], '', '', UserStatisticsGroupBy.DAY),
    ).toEqual([])
  })
})
