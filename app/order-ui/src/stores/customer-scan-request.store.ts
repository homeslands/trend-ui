import { create } from 'zustand'

/**
 * Cầu nối một chiều để màn quét voucher mở được màn định danh khách hàng.
 *
 * Hai màn này là anh em ruột trên cùng trang (`cart-content`, `cart-drawer`)
 * nhưng không biết nhau: `CustomerSearchInput` sở hữu dialog quét thẻ, còn
 * `StaffVoucherListSheet` nằm ở nhánh khác của cây component. Luồn callback qua
 * `VoucherQrScanButton` thì phải xuyên qua một component dùng chung cho cả 6
 * sheet — trong đó 3 sheet phía khách không có khái niệm "thêm khách hàng".
 *
 * Cố ý chỉ là một YÊU CẦU dùng một lần, không phải trạng thái mở/đóng: nơi nhận
 * tự quyết định làm gì rồi xoá yêu cầu đi. Nhờ vậy store không trở thành nguồn
 * sự thật thứ hai cạnh tranh với state cục bộ của dialog.
 */
interface CustomerScanRequestStore {
  isRequested: boolean
  /** Màn quét voucher gọi khi voucher đòi định danh mà đơn chưa có khách. */
  requestOpen: () => void
  /** Nơi nhận gọi ngay sau khi đã mở dialog, để yêu cầu không bị dùng lại. */
  clearRequest: () => void
}

export const useCustomerScanRequestStore = create<CustomerScanRequestStore>(
  (set) => ({
    isRequested: false,
    requestOpen: () => set({ isRequested: true }),
    clearRequest: () => set({ isRequested: false }),
  }),
)
