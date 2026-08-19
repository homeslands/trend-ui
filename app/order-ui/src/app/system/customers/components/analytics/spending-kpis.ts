import { ICustomerAccountRevenue } from '@/types'

export interface SpendingKpiInput {
  revenue?: ICustomerAccountRevenue
}

export interface SpendingKpis {
  totalAmount: number
  spendingCustomers: number
  avgPerCustomer: number
  /**
   * MẪU SỐ của `conversion` — `revenue.total`. Phải được hiển thị cạnh
   * `spendingCustomers` chứ không giữ ngầm bên trong phép chia: khi chỉ hiện mỗi
   * "31" và "17.4% chuyển đổi", người đọc buộc phải đoán mẫu số, và phản xạ tự
   * nhiên là ghép với số "Khách mới" nằm ngay card bên cạnh — vốn đến từ endpoint
   * KHÁC (`/user/statistics`) nên không bao giờ là mẫu số ở đây (31/72 = 43.1%,
   * không phải 17.4%). Phơi mẫu số ra là cách duy nhất khiến hiểu nhầm đó không
   * thể xảy ra.
   */
  totalCustomers: number
  /** null = không hiển thị được (xem ghi chú bên dưới) */
  conversion: number | null
}

/**
 * KPI chuyển đổi giờ lấy CẢ tử số lẫn mẫu số từ cùng MỘT response của
 * `GET /revenue/account`: tử số là `customers.length` (khách đã chi tiêu),
 * mẫu số là `total` (tổng số khách trong phạm vi lọc hiện tại, kể cả khách
 * chưa chi tiêu — theo xác nhận của product owner). Vì cả hai được sinh ra
 * từ CÙNG một request, dưới CÙNG một bộ filter (branch/customerType/
 * paymentMethod/phonenumber/khoảng ngày), chúng luôn mô tả cùng một tập
 * khách — bất biến bắt buộc của tỉ lệ này được thoả mãn theo cấu trúc, không
 * cần đoán hay chắp hai nguồn khác nhau lại nữa.
 *
 * Vì vậy tỉ lệ có nghĩa với CẢ `customerType = new-register` (khách mới đã
 * chi tiêu ÷ khách mới trong phạm vi) lẫn `customerType = all` (khách đã chi
 * tiêu ÷ tổng khách trong phạm vi) — không còn lý do để ẩn theo `customerType`
 * hay theo `branch`/`paymentMethod`/`phone` nữa (những filter đó giờ thu hẹp
 * CẢ HAI vế như nhau).
 *
 * Guard còn lại: `revenue` chưa tải xong → null; `total` bằng 0 hoặc thiếu →
 * null (không chia cho 0); kết quả bị chặn trần ở 100.
 */
export function computeSpendingKpis({ revenue }: SpendingKpiInput): SpendingKpis {
  const totalAmount = revenue?.summary?.totalAmount ?? 0
  const spendingCustomers = revenue?.customers?.length ?? 0
  const avgPerCustomer = spendingCustomers
    ? Math.round(totalAmount / spendingCustomers)
    : 0

  const total = revenue?.total ?? 0
  const canComputeConversion = revenue !== undefined && total > 0

  const conversion = canComputeConversion
    ? Math.min(100, +((spendingCustomers / total) * 100).toFixed(1))
    : null

  return { totalAmount, spendingCustomers, avgPerCustomer, totalCustomers: total, conversion }
}

export interface PaymentMethodBreakdownItem {
  /** Khoá i18n dưới namespace `customer.analytics.*` — dùng thẳng làm tiêu đề card. */
  i18nKey: string
  amount: number
  percent: number
}

/**
 * Bảng chia theo phương thức thanh toán, đọc trực tiếp bốn cặp `totalAmount*`/`percent*`
 * trên `revenue.summary` — KHÔNG phải `computePaymentMix` (đã bị xoá cùng biểu đồ tròn cũ).
 * Dùng ở chế độ lọc theo SĐT: khi dashboard chỉ còn nói về MỘT khách, hai card "Khách có
 * chi tiêu"/"TB mỗi khách" luôn xấp xỉ 1/bằng "Tổng chi tiêu" nên vô nghĩa; bảng này thay
 * thế chúng bằng thứ thật sự khác biệt — khách đó trả bằng gì.
 *
 * LUÔN trả về ĐỦ bốn phương thức, kể cả khi `amount = 0` (theo yêu cầu product owner —
 * trước đây lọc bỏ phương thức 0đ, nay giữ lại để người dùng thấy đủ "0 đ (0%)" thay vì
 * suy diễn phương thức đó có tồn tại hay không). Thứ tự cố định: Chuyển khoản, Tiền mặt,
 * Xu, Thẻ tín dụng.
 */
export function computePaymentMethodBreakdown(
  revenue?: ICustomerAccountRevenue,
): PaymentMethodBreakdownItem[] {
  const summary = revenue?.summary
  if (!summary) return []
  return [
    { i18nKey: 'customer.analytics.paymentBank', amount: summary.totalAmountBank, percent: summary.percentBank },
    { i18nKey: 'customer.analytics.paymentCash', amount: summary.totalAmountCash, percent: summary.percentCash },
    { i18nKey: 'customer.analytics.paymentPoint', amount: summary.totalAmountPoint, percent: summary.percentPoint },
    { i18nKey: 'customer.analytics.paymentCredit', amount: summary.totalAmountCreditCard, percent: summary.percentCreditCard },
  ]
}

export interface GrowthResult {
  /** null = không tính được (thiếu kỳ trước) hoặc không có nghĩa (xem `isNew`). */
  percent: number | null
  /** true khi kỳ trước = 0 và kỳ này > 0 — không phải "tăng trưởng vô cực". */
  isNew: boolean
}

/**
 * % tăng trưởng so với kỳ trước, dùng cho các thẻ KPI "Khách mới" / "Tổng chi tiêu".
 *
 * `previous` là `undefined`/`null` khi chế độ so sánh đang TẮT hoặc dữ liệu kỳ
 * trước chưa có — trong cả hai trường hợp, tăng trưởng không có nghĩa nên trả
 * `percent: null`.
 *
 * `previous = 0` mà `current > 0` KHÔNG phải "tăng trưởng vô cực": dashboard đăng
 * ký cũ (đã xoá) coi đây là một trạng thái riêng ("mới") thay vì chia cho 0.
 * `previous = 0` và `current = 0` thì không có gì thay đổi để báo cáo → cũng null.
 */
export function computeGrowth(
  current: number,
  previous: number | undefined | null,
): GrowthResult {
  if (previous === undefined || previous === null) return { percent: null, isNew: false }
  if (previous === 0) return { percent: null, isNew: current > 0 }
  const percent = +(((current - previous) / previous) * 100).toFixed(1)
  return { percent, isNew: false }
}
