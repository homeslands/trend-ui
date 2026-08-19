import { IPointTransactionStatistic, UserStatisticsGroupBy } from '@/types'

import { fillTimeBuckets } from './fill-time-buckets'

/** Ba trường SỐ của một mốc giao dịch xu. Mỗi trường phải đi qua `fillTimeBuckets` một
 * lượt riêng vì hàm đó chỉ mang được một `count` mỗi lượt. */
const NUMERIC_FIELDS = ['count', 'earn', 'spend'] as const

/**
 * Điền đủ mốc thời gian cho chuỗi GIAO DỊCH XU, tái dùng nguyên logic chia bucket của
 * `fillTimeBuckets` (mốc thiếu = 0 cho mọi trường, gộp nếu trùng bucket) — cùng một
 * nguồn sự thật với chart thống kê khách hàng.
 *
 * BE chỉ trả về những mốc CÓ giao dịch, nên chuỗi rất thưa (vd. nhảy thẳng từ 26/07
 * sang 08/08). Vẽ thẳng chuỗi thưa lên trục category sẽ đặt hai mốc cách nhau 13 ngày
 * nằm SÁT NHAU như thể liền kề — trục thời gian bị bóp méo và người đọc hiểu sai nhịp
 * độ. Lấp đủ mốc (giá trị 0) giữ đúng khoảng cách thật giữa các mốc.
 *
 * Cùng startDate/endDate/groupBy ⇒ mọi lượt sinh ra đúng cùng một dãy mốc, nên ghép
 * theo index là an toàn.
 */
export function fillPointTransactionBuckets(
  data: IPointTransactionStatistic[],
  startDate: string,
  endDate: string,
  groupBy: UserStatisticsGroupBy,
): IPointTransactionStatistic[] {
  const filledByField = NUMERIC_FIELDS.map((field) =>
    fillTimeBuckets(
      data.map((item) => ({ time: item.time, count: item[field] ?? 0 })),
      startDate,
      endDate,
      groupBy,
    ),
  )

  const bucketCount = filledByField[0]?.length ?? 0
  const result: IPointTransactionStatistic[] = []
  for (let index = 0; index < bucketCount; index++) {
    result.push({
      time: filledByField[0][index].time,
      count: filledByField[0][index]?.count ?? 0,
      earn: filledByField[1][index]?.count ?? 0,
      spend: filledByField[2][index]?.count ?? 0,
    })
  }
  return result
}
