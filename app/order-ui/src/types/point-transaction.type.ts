import { IUserInfo, UserStatisticsGroupBy } from './user.type'
import { PointTransactionType } from '@/constants'

export interface IPointTransaction {
  slug: string
  type: string
  desc: string
  objectType: string
  objectSlug: string
  points: number
  user: IUserInfo
  userSlug: string
  createdAt?: string
}

/** Một mốc trong chuỗi thời gian của `/point-transaction/analysis`. Tên trường theo
 * đúng response BE (`time`/`count`/`earn`/`spend`), KHÔNG đổi tên ở tầng type. */
export interface IPointTransactionStatistic {
  /** Mốc đầu bucket, độ chia theo `groupBy` gửi lên. Dạng 'YYYY-MM-DDTHH:mm:ss'. */
  time: string
  /** Tổng SỐ GIAO DỊCH trong bucket (không tách in/out). */
  count: number
  /** Tổng xu nhận trong bucket. */
  earn: number
  /** Tổng xu tiêu trong bucket (số dương). */
  spend: number
}

export interface IAnalyzePointTransaction {
  totalEarned: number;
  totalSpent: number;
  netDifference: number;
  /** Chuỗi thời gian cho chart lịch sử xu, bucket theo `groupBy`. Optional vì BE chỉ
   * trả khi có tham số hợp lệ — FE phải chịu được khi thiếu. */
  statistics?: IPointTransactionStatistic[];
}

/** Query của `/point-transaction` (list) và `/point-transaction/analysis` — cả hai dùng
 * chung `FindAllPointTransactionDto` bên BE. Lưu ý endpoint EXPORT dùng DTO riêng và vẫn
 * giữ tên cũ `fromDate`/`toDate`, đừng nhầm sang đây. */
export interface IPointTransactionQuery {
  page?: number
  size?: number
  userSlug?: string
  startDate?: string // YYYY-MM-DD format
  endDate?: string // YYYY-MM-DD format
  type?: PointTransactionType
  k?: string
  groupBy?: UserStatisticsGroupBy
}

export interface UsePointTransactionsFilters {
  fromDate?: string
  toDate?: string
  type?: PointTransactionType
}
