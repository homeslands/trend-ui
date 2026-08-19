import { PaymentMethod, RevenueTypeQuery } from '@/constants'
import { IBase } from './base.type'
import { UserStatisticsGroupBy } from './user.type'

export enum CustomerAccountRevenueType {
  ALL = 'all',
  NEW_REGISTER = 'new-register',
}

export interface IRevenue extends IBase {
  date: string
  totalAmount: number
  totalOrder: number
}

export interface IRevenueQuery {
  branch?: string
  startDate?: string
  endDate?: string
  type?: RevenueTypeQuery
}

export interface IBranchRevenue extends IBase {
  date: string
  maxReferenceNumberOrder: number
  minReferenceNumberOrder: number
  totalAmountBank: number
  totalAmountCash: number
  totalAmountInternal: number
  totalAccumulatedPointsToUse: number
  totalAmountPoint: number
  totalAmountCreditCard: number
  originalAmount: number
  promotionAmount: number
  voucherAmount: number
  totalAmount: number
  totalOrderPoint: number
  totalOrder: number
}

export interface ICustomerAccountRevenueTimeItem {
  time: string
  count: number
  totalAmount: number
  countPoint: number
  countBank: number
  countCash: number
  countCreditCard: number
  totalAmountPoint: number
  totalAmountBank: number
  totalAmountCash: number
  totalAmountCreditCard: number
}

export interface ICustomerAccountRevenueQuery {
  startDate?: string
  endDate?: string
  branch?: string
  paymentMethod?: PaymentMethod
  phonenumber?: string
  customerType?: CustomerAccountRevenueType
  groupBy?: UserStatisticsGroupBy
}

/**
 * Hình dạng của `result` từ `GET /user/revenue/account` — một OBJECT tổng hợp, KHÔNG phải
 * mảng. Không extends IBase: `result` không mang `slug`/`createdAt`.
 *
 * Lưu ý đường dẫn: route nằm dưới tiền tố `/user` (backend gắn nó vào controller `user`),
 * KHÔNG phải `/revenue/account`. Hàm gọi nó lại nằm ở `api/revenue.ts` — đúng convention
 * "một file một DOMAIN", vì type này, hook `useCustomerAccountRevenue` và query key đều
 * thuộc domain revenue; tiền tố URL là chuyện routing của backend, không quyết định cách
 * chia file ở FE.
 */
export interface ICustomerAccountRevenue {
  summary: {
    totalAmount: number,
    totalAmountBank: number,
    totalAmountCash: number,
    totalAmountPoint: number,
    totalAmountCreditCard: number,
    percentPoint: number,
    percentCash: number,
    percentBank: number,
    percentCreditCard: number,
  }
  customers: {
    customerSlug: string,
    customerName: string,
    customerRegisteredAt: string,
    totalAmount: number,
    totalAmountPoint: number,
    totalAmountCash: number,
    totalAmountBank: number,
    totalAmountCreditCard: number,
  }[]
  /** Chuỗi thời gian theo `groupBy`. Mảng rỗng = kỳ này không ai chi tiêu (dữ liệu hợp lệ). */
  data: ICustomerAccountRevenueTimeItem[]
  total: number
}

export interface IAllRevenueQuery {
  startDate?: string
  endDate?: string
  type?: RevenueTypeQuery
}

export interface IBranchRevenueQuery {
  branch: string
  startDate?: string
  endDate?: string
  type?: RevenueTypeQuery
}

export interface IOverviewFilter {
  branch: string
  startDate: string
  endDate: string
  type: RevenueTypeQuery
}

export interface IOverviewFilterStore {
  overviewFilter: IOverviewFilter
  setOverviewFilter: (
    overviewFilter:
      | IOverviewFilter
      | ((prev: IOverviewFilter) => IOverviewFilter),
  ) => void
  clearOverviewFilter: () => void
  resetToDefault: () => void
}
