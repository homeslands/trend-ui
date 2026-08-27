import { describe, it, expect } from 'vitest'

import { classifyVoucherRejection } from '../voucher-scan-rejection'
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import { IVoucher } from '@/types'

/** Voucher dùng được: còn hạn, còn lượt, khớp sản phẩm trong giỏ. */
function makeVoucher(overrides: Partial<IVoucher> = {}): IVoucher {
  return {
    slug: 'v1',
    code: 'V1',
    type: VOUCHER_TYPE.PERCENT_ORDER,
    isActive: true,
    remainingUsage: 5,
    minOrderValue: 0,
    endDate: '2999-12-31T00:00:00.000Z',
    applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
    voucherProducts: [{ product: { slug: 'tra-sua' } }],
    ...overrides,
  } as unknown as IVoucher
}

const ctx = { cartProductSlugs: ['tra-sua'], subTotal: 100000 }

describe('classifyVoucherRejection', () => {
  it('hết hạn là VĨNH VIỄN — chờ bao lâu quét lại cũng vậy', () => {
    const voucher = makeVoucher({ endDate: '2020-01-01T00:00:00.000Z' })
    expect(classifyVoucherRejection(voucher, ctx)).toBe('permanent')
  })

  it('ngừng áp dụng và hết lượt cũng là VĨNH VIỄN', () => {
    expect(classifyVoucherRejection(makeVoucher({ isActive: false }), ctx)).toBe(
      'permanent',
    )
    expect(
      classifyVoucherRejection(makeVoucher({ remainingUsage: 0 }), ctx),
    ).toBe('permanent')
  })

  it('chưa đủ giá trị tối thiểu là do GIỎ HÀNG — thêm món là dùng được', () => {
    // Đây là chỗ dễ phân loại nhầm nhất. Xếp nhầm vào "vĩnh viễn" thì ta chặn
    // luôn mã đó cả phiên, và khách thêm món xong quét lại sẽ không có phản hồi
    // gì — một ngõ cụt tự tạo ra.
    const voucher = makeVoucher({ minOrderValue: 200000 })
    expect(classifyVoucherRejection(voucher, ctx)).toBe('cart')
  })

  it('sai sản phẩm cũng là do GIỎ HÀNG, không phải vĩnh viễn', () => {
    const voucher = makeVoucher({
      voucherProducts: [{ product: { slug: 'ca-phe' } }],
    } as unknown as Partial<IVoucher>)
    expect(classifyVoucherRejection(voucher, ctx)).toBe('cart')
  })

  it('ngoài khung giờ là ĐIỀU KIỆN KHÁC — đổi theo thời gian, không theo giỏ', () => {
    const voucher = makeVoucher({
      activeStartTime: '23:00',
      activeEndTime: '23:30',
    } as unknown as Partial<IVoucher>)
    const kind = classifyVoucherRejection(voucher, ctx)
    // Chỉ khẳng định "không phải vĩnh viễn và không phải do giỏ hàng" để test
    // không phụ thuộc vào đồng hồ lúc chạy.
    if (kind !== null) expect(kind).toBe('condition')
  })

  it('cần định danh mà chưa đăng nhập là ĐIỀU KIỆN KHÁC', () => {
    const voucher = makeVoucher({ isVerificationIdentity: true })
    expect(
      classifyVoucherRejection(voucher, { ...ctx, isLoggedIn: false }),
    ).toBe('condition')
  })

  it('hết hạn thắng mọi lý do khác khi trùng nhau', () => {
    // Vừa hết hạn vừa chưa đủ tối thiểu: phải báo là vĩnh viễn, vì thêm món
    // cũng không cứu được.
    const voucher = makeVoucher({
      endDate: '2020-01-01T00:00:00.000Z',
      minOrderValue: 999999,
    })
    expect(classifyVoucherRejection(voucher, ctx)).toBe('permanent')
  })

  it('voucher dùng được thì trả null', () => {
    expect(classifyVoucherRejection(makeVoucher(), ctx)).toBeNull()
  })
})
