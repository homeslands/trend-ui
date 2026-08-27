import { describe, it, expect } from 'vitest'

import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import { IVoucher } from '@/types'
import { buildVoucherCartFixHint } from '../voucher-cart-fix-hint'

/** Voucher tối thiểu, chỉ khai các field mà bộ dựng lời khuyên thật sự đọc. */
function makeVoucher(overrides: Partial<IVoucher> = {}): IVoucher {
  return {
    slug: 'v1',
    type: VOUCHER_TYPE.PERCENT_ORDER,
    minOrderValue: 0,
    applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
    voucherProducts: [],
    ...overrides,
  } as unknown as IVoucher
}

/** Sản phẩm được voucher chấp nhận, đúng hình dạng `voucherProducts`. */
function eligible(slug: string, name: string) {
  return {
    slug: `vp-${slug}`,
    createdAt: '',
    product: { slug, name },
  } as unknown as IVoucher['voucherProducts'][number]
}

const CA_PHE = eligible('ca-phe', 'Cà phê sữa')
const TRA_DAO = eligible('tra-dao', 'Trà đào')
const BANH_MI = eligible('banh-mi', 'Bánh mì')

describe('buildVoucherCartFixHint', () => {
  describe('luật AT_LEAST_ONE_REQUIRED', () => {
    it('nêu món cần THÊM khi giỏ chưa có món nào thuộc phiếu', () => {
      const fix = buildVoucherCartFixHint(
        makeVoucher({ voucherProducts: [CA_PHE, TRA_DAO] }),
        { cartItems: [{ slug: 'banh-flan', name: 'Bánh flan' }], subTotal: 0 },
      )

      expect(fix?.message).toEqual({ key: 'voucher.fixAddEligibleItem' })
      // Dòng hai trả lời đúng câu người dùng hỏi tiếp: gọi gì thì được?
      expect(fix?.hint).toEqual({
        key: 'voucher.fixHintAddOneOf',
        params: { names: 'Cà phê sữa, Trà đào' },
      })
      // Danh sách đầy đủ đi kèm để màn quét mở rộng được tại chỗ: ở quầy không
      // có đường nào khác tới danh sách này.
      expect(fix?.eligibleNames).toEqual(['Cà phê sữa', 'Trà đào'])
    })

    it('trả null khi giỏ đã có một món thuộc phiếu', () => {
      const fix = buildVoucherCartFixHint(
        makeVoucher({ voucherProducts: [CA_PHE, TRA_DAO] }),
        { cartItems: [{ slug: 'ca-phe', name: 'Cà phê sữa' }], subTotal: 0 },
      )

      expect(fix).toBeNull()
    })
  })

  describe('luật ALL_REQUIRED', () => {
    it('nêu đích danh món cần BỎ, không bắt người đọc tự đối chiếu', () => {
      const fix = buildVoucherCartFixHint(
        makeVoucher({
          applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
          voucherProducts: [CA_PHE],
        }),
        {
          cartItems: [
            { slug: 'ca-phe', name: 'Cà phê sữa' },
            { slug: 'tra-sua', name: 'Trà sữa' },
            { slug: 'banh-flan', name: 'Bánh flan' },
          ],
          subTotal: 0,
        },
      )

      expect(fix?.message).toEqual({
        key: 'voucher.fixRemoveItems',
        params: { names: 'Trà sữa, Bánh flan' },
      })
      expect(fix?.hint).toEqual({
        key: 'voucher.fixHintOnlyAppliesTo',
        params: { names: 'Cà phê sữa' },
      })
      expect(fix?.eligibleNames).toEqual(['Cà phê sữa'])
    })

    it('KHÔNG cắt danh sách món cần bỏ — nó lấy từ đơn nên vốn ngắn, và bỏ sót một món là người dùng sửa xong vẫn hỏng', () => {
      const cartItems = ['A', 'B', 'C', 'D', 'E'].map((n) => ({
        slug: n.toLowerCase(),
        name: n,
      }))

      const fix = buildVoucherCartFixHint(
        makeVoucher({
          applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
          voucherProducts: [CA_PHE],
        }),
        { cartItems, subTotal: 0 },
      )

      expect(fix?.message.params?.names).toBe('A, B, C, D, E')
    })

    it('trả null khi mọi món trong giỏ đều thuộc phiếu', () => {
      const fix = buildVoucherCartFixHint(
        makeVoucher({
          applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
          voucherProducts: [CA_PHE, TRA_DAO],
        }),
        { cartItems: [{ slug: 'ca-phe', name: 'Cà phê sữa' }], subTotal: 0 },
      )

      expect(fix).toBeNull()
    })
  })

  describe('cắt danh sách món được áp dụng', () => {
    it('nêu 3 tên rồi gộp phần còn lại — dải chữ trên màn quét hẹp', () => {
      const many = ['P1', 'P2', 'P3', 'P4', 'P5'].map((n) =>
        eligible(n.toLowerCase(), n),
      )

      const fix = buildVoucherCartFixHint(
        makeVoucher({ voucherProducts: many }),
        { cartItems: [], subTotal: 0 },
      )

      // Nêu TỔNG số món ngay ở dòng ngắn: người đọc biết phạm vi rộng hay hẹp
      // trước khi quyết định có bấm mở ra xem hay không.
      expect(fix?.hint).toEqual({
        key: 'voucher.fixHintAddOneOfMore',
        params: { names: 'P1, P2, P3', rest: 2, total: 5 },
      })
      expect(fix?.eligibleNames).toEqual(['P1', 'P2', 'P3', 'P4', 'P5'])
    })

    it('dùng khoá KHÔNG có phần gộp khi vừa đúng 3 món', () => {
      const fix = buildVoucherCartFixHint(
        makeVoucher({ voucherProducts: [CA_PHE, TRA_DAO, BANH_MI] }),
        { cartItems: [], subTotal: 0 },
      )

      expect(fix?.hint?.key).toBe('voucher.fixHintAddOneOf')
      expect(fix?.hint?.params).toEqual({
        names: 'Cà phê sữa, Trà đào, Bánh mì',
      })
    })
  })

  describe('giá trị tối thiểu', () => {
    it('nêu SỐ TIỀN CÒN THIẾU, không chỉ nói chưa đạt', () => {
      const fix = buildVoucherCartFixHint(
        makeVoucher({ voucherProducts: [CA_PHE], minOrderValue: 100000 }),
        { cartItems: [{ slug: 'ca-phe', name: 'Cà phê sữa' }], subTotal: 40000 },
      )

      expect(fix?.message.key).toBe('voucher.fixMinOrderShort')
      // Lý do là tiền, không phải sản phẩm: không có gì để mở rộng.
      expect(fix?.eligibleNames).toBeUndefined()
      // Đi qua `formatCurrency` của app để số tiền ở đây giống hệt mọi số tiền
      // khác trên màn — app dùng dấu phẩy, không phải dấu chấm.
      expect(fix?.message.params?.amount).toBe('60,000 đ')
      expect(fix?.hint).toBeUndefined()
    })

    it('bỏ qua giá trị tối thiểu với voucher đồng giá', () => {
      const fix = buildVoucherCartFixHint(
        makeVoucher({
          type: VOUCHER_TYPE.SAME_PRICE_PRODUCT,
          voucherProducts: [CA_PHE],
          minOrderValue: 100000,
        }),
        { cartItems: [{ slug: 'ca-phe', name: 'Cà phê sữa' }], subTotal: 0 },
      )

      expect(fix).toBeNull()
    })

    it('ưu tiên nói về SẢN PHẨM trước tiền, khi hỏng cả hai', () => {
      // Thiếu sản phẩm là cổng cứng: thêm bao nhiêu món khác cũng không qua.
      // Nói tiền trước sẽ đẩy người dùng thêm món vô ích rồi vẫn hỏng.
      const fix = buildVoucherCartFixHint(
        makeVoucher({ voucherProducts: [CA_PHE], minOrderValue: 100000 }),
        { cartItems: [{ slug: 'tra-sua', name: 'Trà sữa' }], subTotal: 1000 },
      )

      expect(fix?.message.key).toBe('voucher.fixAddEligibleItem')
    })
  })

  describe('không phải chuyện giỏ hàng', () => {
    it('trả null khi voucher không gắn sản phẩm nào — người dùng không sửa được', () => {
      // Nhóm `permanent`: khuyên thêm hay bỏ món đều vô nghĩa.
      const fix = buildVoucherCartFixHint(makeVoucher({ voucherProducts: [] }), {
        cartItems: [{ slug: 'ca-phe', name: 'Cà phê sữa' }],
        subTotal: 0,
      })

      expect(fix).toBeNull()
    })

    it('chịu được voucherProducts thiếu product', () => {
      const fix = buildVoucherCartFixHint(
        makeVoucher({
          voucherProducts: [
            { slug: 'vp-x', createdAt: '', product: undefined },
            CA_PHE,
          ] as unknown as IVoucher['voucherProducts'],
        }),
        { cartItems: [], subTotal: 0 },
      )

      expect(fix?.hint?.params?.names).toBe('Cà phê sữa')
    })
  })
})
