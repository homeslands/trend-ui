import { describe, it, expect } from 'vitest'
import { ICustomerAccountRevenue } from '@/types'
import { computeSpendingKpis, computeGrowth, computePaymentMethodBreakdown } from '../spending-kpis'

const summary: ICustomerAccountRevenue['summary'] = {
  totalAmount: 1000,
  totalAmountBank: 420,
  totalAmountCash: 280,
  totalAmountPoint: 190,
  totalAmountCreditCard: 110,
  percentBank: 42,
  percentCash: 28,
  percentPoint: 19,
  percentCreditCard: 11,
}

// Không cast: fixture phải khớp ĐÚNG hình dạng response thật, để type drift
// (ví dụ `customer` vs `customers`) làm test đỏ thay vì trôi qua.
//
// `spenderCount` và `total` truyền RIÊNG (khác giá trị nhau ở phần lớn test) vì
// đó chính là điều đang được kiểm chứng: tử số (`customers.length`) và mẫu số
// (`total`) đến từ CÙNG một response nhưng là hai con số độc lập — không còn
// ràng buộc "total == số khách chi tiêu" như fixture cũ ngầm định.
const makeRevenue = (spenderCount: number, total: number): ICustomerAccountRevenue => ({
  summary,
  customers: Array.from({ length: spenderCount }, (_, i) => ({
    customerSlug: `c${i}`,
    customerName: `KH ${i}`,
    customerRegisteredAt: '2026-07-01T00:00:00',
    totalAmount: 100,
    totalAmountPoint: 10,
    totalAmountCash: 30,
    totalAmountBank: 50,
    totalAmountCreditCard: 10,
  })),
  data: [
    {
      time: '2026-07-01T00:00:00',
      count: spenderCount,
      totalAmount: 1000,
      countPoint: 0,
      countBank: 0,
      countCash: 0,
      countCreditCard: 0,
      totalAmountPoint: 190,
      totalAmountBank: 420,
      totalAmountCash: 280,
      totalAmountCreditCard: 110,
    },
  ],
  total,
})

describe('computeSpendingKpis', () => {
  // Tử số và mẫu số giờ đến từ CÙNG response /revenue/account (customers.length
  // và total) — không còn ghép với /user/statistics — nên chỉ cần một request để
  // tính tỉ lệ, và populations luôn khớp nhau theo cấu trúc.
  it('computes conversion from revenue.total as denominator (same response as numerator)', () => {
    const r = computeSpendingKpis({ revenue: makeRevenue(8, 20) })
    expect(r.totalAmount).toBe(1000)
    expect(r.spendingCustomers).toBe(8)
    expect(r.avgPerCustomer).toBe(125)
    expect(r.conversion).toBe(40)
    // Mẫu số phải đi RA NGOÀI cùng tỉ lệ, không chỉ nằm ngầm trong phép chia — card
    // hiển thị "8 / 20" chứ không phải mỗi "8" kèm "40% chuyển đổi".
    expect(r.totalCustomers).toBe(20)
  })

  // Mẫu số được phơi ra phải là ĐÚNG mẫu số đã dùng để chia. Nếu hai giá trị này lệch
  // nhau, UI sẽ hiện một tỉ lệ không khớp với chính con số nó in ra ngay cạnh.
  it('exposes the exact denominator used to compute conversion', () => {
    const r = computeSpendingKpis({ revenue: makeRevenue(31, 178) })
    expect(r.totalCustomers).toBe(178)
    expect(r.conversion).toBe(17.4)
    expect(+((r.spendingCustomers / r.totalCustomers) * 100).toFixed(1)).toBe(r.conversion)
  })

  // Không còn customerType nào được truyền vào computeSpendingKpis nữa — hàm chỉ
  // nhận `revenue`. Đây chính là điều thay thế guard cũ "customerType === ALL →
  // null": vì tử số và mẫu số luôn cùng phạm vi lọc (kể cả khi customerType = all),
  // một con số thật luôn được trả về, không còn ẩn theo customerType.
  it('computes a real conversion number regardless of which customerType produced the response (old guard hid this)', () => {
    const r = computeSpendingKpis({ revenue: makeRevenue(15, 50) })
    expect(r.conversion).toBe(30)
  })

  it('returns null conversion when total is 0 (no divide by zero)', () => {
    const r = computeSpendingKpis({ revenue: makeRevenue(0, 0) })
    expect(r.conversion).toBeNull()
    expect(r.avgPerCustomer).toBe(0)
    // total = 0 → UI ẩn hẳn phần "/ mẫu số" (điều kiện `totalCustomers > 0`), không
    // in ra "0 / 0".
    expect(r.totalCustomers).toBe(0)
  })

  // Trường hợp phòng thủ: response lỗi/không đầy đủ thiếu hẳn `total`. Type thật
  // luôn có `total: number` nên phải cast có chủ đích để mô phỏng — không phải
  // lỗi gõ nhầm — nhằm xác nhận `revenue?.total ?? 0` không throw và trả null
  // thay vì NaN/Infinity.
  it('returns null conversion when total is missing from the response', () => {
    const malformed = { ...makeRevenue(8, 20) } as ICustomerAccountRevenue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (malformed as any).total
    const r = computeSpendingKpis({ revenue: malformed })
    expect(r.conversion).toBeNull()
    expect(r.spendingCustomers).toBe(8)
  })

  it('caps conversion at 100 when spenders exceed total', () => {
    const r = computeSpendingKpis({ revenue: makeRevenue(12, 10) })
    expect(r.conversion).toBe(100)
  })

  it('handles missing revenue (not loaded yet)', () => {
    const r = computeSpendingKpis({ revenue: undefined })
    expect(r.totalAmount).toBe(0)
    expect(r.spendingCustomers).toBe(0)
    expect(r.avgPerCustomer).toBe(0)
    expect(r.conversion).toBeNull()
  })
})

describe('computeGrowth', () => {
  it('computes positive growth', () => {
    const g = computeGrowth(155, 100)
    expect(g).toEqual({ percent: 55, isNew: false })
  })

  it('computes negative growth', () => {
    const g = computeGrowth(80, 100)
    expect(g).toEqual({ percent: -20, isNew: false })
  })

  it('rounds to one decimal', () => {
    const g = computeGrowth(213, 137)
    expect(g.percent).toBe(55.5)
    expect(g.isNew).toBe(false)
  })

  it('treats previous = 0 with current > 0 as "new", not infinite growth', () => {
    const g = computeGrowth(168, 0)
    expect(g).toEqual({ percent: null, isNew: true })
  })

  it('returns null, not NaN, when both current and previous are 0', () => {
    const g = computeGrowth(0, 0)
    expect(g).toEqual({ percent: null, isNew: false })
  })

  it('returns null when previous is undefined (compare off / no data yet)', () => {
    const g = computeGrowth(100, undefined)
    expect(g).toEqual({ percent: null, isNew: false })
  })

  it('returns null when previous is null', () => {
    const g = computeGrowth(100, null)
    expect(g).toEqual({ percent: null, isNew: false })
  })
})

describe('computePaymentMethodBreakdown', () => {
  // Product owner: LUÔN hiện đủ bốn phương thức, kể cả khi = 0 (đảo ngược hành vi cũ
  // "lọc bỏ phương thức 0đ") — mẫu response thật ở chế độ lọc theo SĐT: Chuyển khoản +
  // Thẻ tín dụng = 0, vẫn phải xuất hiện với "0 đ (0%)".
  it('always returns all four methods, including zero-amount ones, in stable order', () => {
    const revenue: ICustomerAccountRevenue = {
      summary: {
        totalAmount: 258000,
        totalAmountBank: 0,
        totalAmountCash: 255000,
        totalAmountPoint: 3000,
        totalAmountCreditCard: 0,
        percentBank: 0,
        percentCash: 98.84,
        percentPoint: 1.16,
        percentCreditCard: 0,
      },
      customers: [],
      data: [],
      total: 1,
    }
    const result = computePaymentMethodBreakdown(revenue)
    expect(result).toEqual([
      { i18nKey: 'customer.analytics.paymentBank', amount: 0, percent: 0 },
      { i18nKey: 'customer.analytics.paymentCash', amount: 255000, percent: 98.84 },
      { i18nKey: 'customer.analytics.paymentPoint', amount: 3000, percent: 1.16 },
      { i18nKey: 'customer.analytics.paymentCredit', amount: 0, percent: 0 },
    ])
  })

  it('returns an empty list when revenue is not loaded yet', () => {
    expect(computePaymentMethodBreakdown(undefined)).toEqual([])
  })

  it('returns all four methods when every amount is non-zero', () => {
    const revenue = makeRevenue(8, 20)
    const result = computePaymentMethodBreakdown(revenue)
    expect(result).toHaveLength(4)
  })
})
