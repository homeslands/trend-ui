import moment from 'moment'

import { IUserStatisticsItem, UserStatisticsGroupBy } from '@/types'

// Đơn vị dùng để "gom" một mốc về đầu bucket của nó.
const START_OF_UNIT: Record<UserStatisticsGroupBy, moment.unitOfTime.StartOf> = {
  [UserStatisticsGroupBy.HOUR]: 'hour',
  [UserStatisticsGroupBy.DAY]: 'day',
  [UserStatisticsGroupBy.WEEK]: 'isoWeek',
  [UserStatisticsGroupBy.MONTH]: 'month',
  [UserStatisticsGroupBy.YEAR]: 'year',
}

// Bước nhảy giữa hai bucket liền kề.
const STEP_UNIT: Record<UserStatisticsGroupBy, moment.unitOfTime.DurationConstructor> = {
  [UserStatisticsGroupBy.HOUR]: 'hour',
  [UserStatisticsGroupBy.DAY]: 'day',
  [UserStatisticsGroupBy.WEEK]: 'week',
  [UserStatisticsGroupBy.MONTH]: 'month',
  [UserStatisticsGroupBy.YEAR]: 'year',
}

const MAX_BUCKETS = 100000

/**
 * Điền đủ mọi mốc thời gian từ `startDate` → `endDate` theo `groupBy`.
 * Mốc có trong `data` giữ nguyên count (gộp nếu trùng bucket); mốc thiếu → count = 0.
 * Trả về mảng theo thứ tự thời gian tăng dần. `time` xuất ra dạng
 * 'YYYY-MM-DDTHH:mm:ss' (local, không timezone) — khớp định dạng backend dùng.
 * Nếu thiếu range thì trả về bản sao `data` (không đổi hành vi cũ).
 */
export function fillTimeBuckets(
  data: IUserStatisticsItem[],
  startDate: string,
  endDate: string,
  groupBy: UserStatisticsGroupBy,
): IUserStatisticsItem[] {
  if (!startDate || !endDate) return [...data]

  const startOf = START_OF_UNIT[groupBy]
  const step = STEP_UNIT[groupBy]

  const counts = new Map<number, number>()
  for (const item of data) {
    const key = moment(item.time).startOf(startOf).valueOf()
    counts.set(key, (counts.get(key) ?? 0) + item.count)
  }

  const result: IUserStatisticsItem[] = []
  const cursor = moment(startDate).startOf(startOf)
  const last = moment(endDate).startOf(startOf)

  let iterations = 0
  while (cursor.isSameOrBefore(last) && iterations < MAX_BUCKETS) {
    result.push({
      time: cursor.format('YYYY-MM-DDTHH:mm:ss'),
      count: counts.get(cursor.valueOf()) ?? 0,
    })
    cursor.add(1, step)
    iterations++
  }

  return result
}
