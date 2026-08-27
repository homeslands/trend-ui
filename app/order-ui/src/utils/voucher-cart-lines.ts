/**
 * Món trong đơn, ở dạng thô mà các sheet đang có.
 *
 * Sáu sheet voucher lấy món từ ba nguồn khác nhau — giỏ hàng, bản nháp sửa đơn,
 * đơn đã đặt — và ba nguồn đó đặt slug sản phẩm ở ba chỗ khác nhau. Kiểu này cố
 * ý khai lỏng để nhận được cả ba mà không sheet nào phải tự nắn.
 */
export interface RawVoucherCartLine {
  slug?: string
  productSlug?: string
  name?: string
  isGift?: boolean
  variant?: { product?: { slug?: string; name?: string } }
}

/** Món đã chuẩn hoá: đúng slug SẢN PHẨM và tên hiển thị. */
export interface VoucherCartLine {
  slug: string
  name: string
}

/**
 * Nắn món của mọi nguồn về cùng một dạng, để bộ phân loại lý do và bộ dựng lời
 * khuyên nhìn CHUNG một giỏ hàng.
 *
 * Trước đây mỗi sheet tự lắp, và hai chỗ trong cùng một sheet đọc hai field khác
 * nhau — dải chữ khuyên thêm món này trong khi bộ phân loại xếp voucher vào nhóm
 * khác. Gom về một hàm thì lệch kiểu đó không còn chỗ để xảy ra.
 *
 * Thứ tự ưu tiên KHÔNG tuỳ tiện: `convertOrderDetailToOrderItem` đặt
 * `slug: orderDetail.slug` — tức slug của DÒNG ĐƠN, không phải sản phẩm. Nên
 * `productSlug` và `variant.product.slug` phải được xét trước, còn `slug` chỉ là
 * lối cuối cho món thêm thẳng vào giỏ (ở đó hai giá trị trùng nhau).
 */
export function normalizeVoucherCartLines(
  lines: RawVoucherCartLine[] | undefined | null,
): VoucherCartLine[] {
  return (lines || [])
    .filter((line) => !line?.isGift)
    .map((line) => ({
      slug: line?.productSlug || line?.variant?.product?.slug || line?.slug || '',
      name: line?.name || line?.variant?.product?.name || '',
    }))
    // Bỏ hẳn dòng không tìm được slug: để chuỗi rỗng lọt xuống thì nó sẽ âm thầm
    // khớp với voucher nào có sản phẩm slug rỗng — sai mà không báo gì.
    .filter((line) => !!line.slug)
}
