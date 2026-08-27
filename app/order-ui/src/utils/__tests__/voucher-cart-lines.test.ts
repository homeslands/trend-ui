import { describe, it, expect } from 'vitest'

import { normalizeVoucherCartLines } from '../voucher-cart-lines'

describe('normalizeVoucherCartLines', () => {
  it('ưu tiên productSlug — món trong đơn đang sửa có `slug` là slug DÒNG ĐƠN', () => {
    // `convertOrderDetailToOrderItem` đặt `slug: orderDetail.slug`, tức slug của
    // dòng đơn hàng chứ không phải của sản phẩm. Đọc nhầm `slug` ở đây là voucher
    // không bao giờ khớp món nào trong đơn đang sửa.
    const lines = normalizeVoucherCartLines([
      { slug: 'dong-don-abc', productSlug: 'ca-phe', name: 'Cà phê sữa' },
    ])

    expect(lines).toEqual([{ slug: 'ca-phe', name: 'Cà phê sữa' }])
  })

  it('rơi về variant.product.slug — đơn đã đặt không có productSlug', () => {
    const lines = normalizeVoucherCartLines([
      {
        slug: 'dong-don-xyz',
        variant: { product: { slug: 'tra-dao', name: 'Trà đào' } },
      },
    ])

    expect(lines).toEqual([{ slug: 'tra-dao', name: 'Trà đào' }])
  })

  it('rơi về slug khi không có gì khác — món thêm thẳng vào giỏ', () => {
    const lines = normalizeVoucherCartLines([
      { slug: 'banh-mi', name: 'Bánh mì' },
    ])

    expect(lines).toEqual([{ slug: 'banh-mi', name: 'Bánh mì' }])
  })

  it('loại món tặng — món tặng không tính vào điều kiện voucher', () => {
    const lines = normalizeVoucherCartLines([
      { productSlug: 'ca-phe', name: 'Cà phê sữa' },
      { productSlug: 'banh-flan', name: 'Bánh flan', isGift: true },
    ])

    expect(lines).toEqual([{ slug: 'ca-phe', name: 'Cà phê sữa' }])
  })

  it('bỏ dòng không tìm được slug sản phẩm, thay vì đẩy chuỗi rỗng xuống', () => {
    // Chuỗi rỗng lọt xuống bộ so khớp sẽ âm thầm khớp với voucher nào có sản
    // phẩm slug rỗng — im lặng và sai.
    const lines = normalizeVoucherCartLines([
      { name: 'Món hỏng dữ liệu' },
      { productSlug: 'ca-phe', name: 'Cà phê sữa' },
    ])

    expect(lines).toEqual([{ slug: 'ca-phe', name: 'Cà phê sữa' }])
  })

  it('lấy tên từ variant khi món không có name riêng', () => {
    const lines = normalizeVoucherCartLines([
      { productSlug: 'tra-sua', variant: { product: { name: 'Trà sữa' } } },
    ])

    expect(lines).toEqual([{ slug: 'tra-sua', name: 'Trà sữa' }])
  })

  it('chịu được danh sách rỗng hoặc undefined', () => {
    expect(normalizeVoucherCartLines([])).toEqual([])
    expect(normalizeVoucherCartLines(undefined)).toEqual([])
  })
})
