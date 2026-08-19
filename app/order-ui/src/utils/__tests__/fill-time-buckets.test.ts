import { describe, it, expect } from 'vitest'
import { fillTimeBuckets } from '../fill-time-buckets'
import { UserStatisticsGroupBy } from '@/types'

describe('fillTimeBuckets', () => {
  it('fills missing month buckets with 0', () => {
    const data = [
      { time: '2026-01-15T00:00:00', count: 12 },
      { time: '2026-05-10T00:00:00', count: 19 },
    ]
    const r = fillTimeBuckets(
      data,
      '2026-01-01T00:00:00',
      '2026-05-31T23:59:59',
      UserStatisticsGroupBy.MONTH,
    )
    expect(r).toHaveLength(5)
    expect(r.map((x) => x.count)).toEqual([12, 0, 0, 0, 19])
  })

  it('returns all zeros when data is empty', () => {
    const r = fillTimeBuckets(
      [],
      '2026-01-01T00:00:00',
      '2026-03-31T23:59:59',
      UserStatisticsGroupBy.MONTH,
    )
    expect(r.map((x) => x.count)).toEqual([0, 0, 0])
  })

  it('fills day buckets with 0 between existing days', () => {
    const data = [{ time: '2026-06-02T08:00:00', count: 5 }]
    const r = fillTimeBuckets(
      data,
      '2026-06-01T00:00:00',
      '2026-06-03T23:59:59',
      UserStatisticsGroupBy.DAY,
    )
    expect(r.map((x) => x.count)).toEqual([0, 5, 0])
  })

  it('aggregates multiple items falling in the same bucket', () => {
    const data = [
      { time: '2026-01-05T00:00:00', count: 3 },
      { time: '2026-01-20T00:00:00', count: 4 },
    ]
    const r = fillTimeBuckets(
      data,
      '2026-01-01T00:00:00',
      '2026-02-28T23:59:59',
      UserStatisticsGroupBy.MONTH,
    )
    expect(r.map((x) => x.count)).toEqual([7, 0])
  })

  it('returns a copy of data unchanged when range is missing', () => {
    const data = [{ time: '2026-01-15T00:00:00', count: 12 }]
    expect(fillTimeBuckets(data, '', '', UserStatisticsGroupBy.MONTH)).toEqual(data)
  })
})
