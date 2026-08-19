import { ICustomerAccountRevenueTimeItem, UserStatisticsGroupBy } from '@/types'

import { fillTimeBuckets } from './fill-time-buckets'

/**
 * Mọi trường SỐ của một mốc chi tiêu — mỗi trường được bơm qua `fillTimeBuckets`
 * MỘT LƯỢT RIÊNG (nó chỉ mang được một `count` mỗi lượt) rồi ghép lại theo chỉ số.
 * Cùng startDate/endDate/groupBy ⇒ mọi lượt sinh ra đúng cùng một dãy mốc, nên ghép
 * theo index là an toàn. `time` không nằm trong danh sách này — lấy từ lượt đầu tiên.
 */
const NUMERIC_FIELDS = [
  'count',
  'totalAmount',
  'countPoint',
  'countBank',
  'countCash',
  'countCreditCard',
  'totalAmountPoint',
  'totalAmountBank',
  'totalAmountCash',
  'totalAmountCreditCard',
] as const

type NumericField = (typeof NUMERIC_FIELDS)[number]

/**
 * Điền đủ mốc thời gian cho chuỗi CHI TIÊU, tái dùng nguyên logic bucket của
 * `fillTimeBuckets` (mốc thiếu = 0 cho MỌI trường, gộp nếu trùng bucket). Giữ một
 * nguồn sự thật duy nhất cho việc chia bucket.
 *
 * BE trả về `totalAmount`/`count` CỘNG với phân rã theo phương thức thanh toán
 * (`totalAmount{Point,Bank,Cash,CreditCard}`, `count{Point,Bank,Cash,CreditCard}`) trên
 * MỖI mốc — cả mười trường phải sống sót qua bước điền bucket để chart cột chồng theo
 * phương thức có dữ liệu, không chỉ tổng.
 */
export function fillSpendingBuckets(
  data: ICustomerAccountRevenueTimeItem[],
  startDate: string,
  endDate: string,
  groupBy: UserStatisticsGroupBy,
): ICustomerAccountRevenueTimeItem[] {
  const filledByField = NUMERIC_FIELDS.map((field) =>
    fillTimeBuckets(
      data.map((d) => ({ time: d.time, count: d[field] ?? 0 })),
      startDate,
      endDate,
      groupBy,
    ),
  )

  const bucketCount = filledByField[0]?.length ?? 0
  const result: ICustomerAccountRevenueTimeItem[] = []
  for (let i = 0; i < bucketCount; i++) {
    const item = { time: filledByField[0][i].time } as unknown as Record<
      NumericField | 'time',
      number | string
    >
    NUMERIC_FIELDS.forEach((field, fieldIndex) => {
      item[field] = filledByField[fieldIndex][i]?.count ?? 0
    })
    result.push(item as unknown as ICustomerAccountRevenueTimeItem)
  }
  return result
}
