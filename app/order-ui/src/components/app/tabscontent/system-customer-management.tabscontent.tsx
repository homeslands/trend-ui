import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { CustomerAnalyticsPanel, CustomerSpendingTable } from '@/app/system/customers/components'
import { Card, CardHeader, CardTitle, DataTable } from '@/components/ui'
import { useUsers } from '@/hooks'
import {
  useCustomerAnalyticsFilters,
  useCustomerListFilters,
} from '@/app/system/customers/hooks'
import { useUserListColumns, SpendingRow } from '@/app/system/customers/DataTable/columns'
import { Role, ROUTE } from '@/constants'
import { CustomerAction } from '@/app/system/customers/DataTable/actions'
import { IUserInfo } from '@/types'
import { showErrorToastMessage } from '@/utils'

const DATETIME = 'YYYY-MM-DDTHH:mm:ss'
const startOfDay = (d: string) => moment(d).startOf('day').format(DATETIME)
const endOfDay = (d: string) => moment(d).endOf('day').format(DATETIME)

export function SystemCustomerManagementTabsContent() {
  const { t } = useTranslation('customer')
  const { t: tToast } = useTranslation('toast')
  const navigate = useNavigate()

  const analytics = useCustomerAnalyticsFilters()
  const { page, size, card, setPage, setSize, setCard, reset } = useCustomerListFilters()

  /**
   * SĐT và khoảng ngày giờ có MỘT nguồn sự thật duy nhất: `useCustomerAnalyticsFilters`
   * (key URL `phone`/`from`/`to`). Bảng "Danh bạ" bên dưới ĐỌC THẲNG `analytics.phone`/
   * `analytics.from`/`analytics.to` cho query `useUsers` — không còn `q`/`tfrom`/`tto`
   * riêng của `useCustomerListFilters` (đã bị xoá khỏi hook đó, xem
   * `use-customer-list-filters.ts`). `useCustomerListFilters` giờ chỉ còn giữ
   * `page`/`size`/`card` — những thứ thật sự thuộc về riêng bảng này (phân trang
   * table-local, quét RFID/QR).
   *
   * Chỉ tự chuyển tab ở đúng lần chuyển tiếp RỖNG → CÓ GIÁ TRỊ (dùng `useRef` giữ giá
   * trị trước đó): không tự chuyển ở mọi lần render (sẽ chuyển lại ngay cả khi người
   * dùng vừa tự tay bấm về "Danh bạ" trong lúc SĐT vẫn còn), và không chuyển khi SĐT bị
   * xoá (chuyển tiếp ngược CÓ GIÁ TRỊ → RỖNG, vd. bấm Reset) — người dùng có thể đang cố
   * tình xem lại "Danh bạ".
   *
   * Không gọi setter URL nào khác trong cùng effect này — `setTable` là setter DUY NHẤT
   * ở đây. Giá trị `analytics.phone` mà effect này đọc chỉ đổi SAU KHI hiệu ứng debounce
   * trong `CustomerAnalyticsPanel` (ô SĐT → `filters.setPhone`) đã tự commit xong ở một
   * lượt render trước đó — nên `setTable` luôn chạy ở một lượt effect riêng, không bao
   * giờ đứng chung tick với `setPhone` (tránh đúng bẫy "hai setter URL trong một lần
   * xử lý sự kiện" khiến react-router chỉ giữ lại cái sau).
   */
  const prevAnalyticsPhoneRef = useRef(analytics.phone)
  useEffect(() => {
    const prevPhone = prevAnalyticsPhoneRef.current
    prevAnalyticsPhoneRef.current = analytics.phone
    if (!prevPhone && analytics.phone) {
      analytics.setTable('spend')
    }
    // Chỉ cần theo dõi `analytics.phone`/`analytics.setTable` — `analytics` đổi tham
    // chiếu ở MỌI thay đổi filter (branch, groupBy, ...) vì được useMemo hoá theo toàn
    // bộ field, đưa cả object vào deps sẽ chạy lại effect này quá thường xuyên dù guard
    // vẫn đúng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytics.phone, analytics.setTable])

  const columns = useUserListColumns()
  const hasShownToastForCurrentFilterRef = useRef<string>('')

  const [spendingRows, setSpendingRows] = useState<SpendingRow[]>([])
  const [spendingLoading, setSpendingLoading] = useState(true)
  const handleSpendingRows = useCallback((rows: SpendingRow[], isLoading: boolean) => {
    setSpendingRows(rows)
    setSpendingLoading(isLoading)
  }, [])

  // Bảng Danh bạ ĐỒNG NHẤT với thẻ "Khách mới": lọc theo NGÀY TẠO tài khoản trong đúng
  // khoảng ngày của dashboard — số khách đăng ký trong kỳ khớp giữa card và bảng.
  //
  // NGOẠI LỆ khi đang search SĐT: BỎ lọc ngày. `/user` lọc theo ngày TẠO, nên nếu tìm
  // một khách đăng ký NGOÀI kỳ (nhưng có chi tiêu trong kỳ) mà vẫn áp khoảng ngày thì
  // họ bị loại → kết quả rỗng. Khi có SĐT, ưu tiên tìm được đúng khách bất kể ngày.
  //
  // `enabled` chỉ bật khi đang XEM tab Danh bạ — nhập SĐT sẽ tự chuyển sang tab Chi tiêu
  // (xem panel), nên gọi /user lúc đó là phí một request cho bảng đang ẩn.
  const hasPhoneFilter = !!analytics.phone
  const { data, isLoading } = useUsers(
    {
      page,
      size,
      order: 'DESC',
      phonenumber: analytics.phone,
      membershipCard: card || undefined,
      hasPaging: true,
      role: Role.CUSTOMER,
      startDate:
        !hasPhoneFilter && analytics.from ? startOfDay(analytics.from) : undefined,
      endDate: !hasPhoneFilter && analytics.to ? endOfDay(analytics.to) : undefined,
    },
    analytics.table === 'dir',
  )

  // Toast khi filter (SĐT dashboard hoặc card RFID) không tìm thấy user
  useEffect(() => {
    const activeFilter = card || analytics.phone
    if (isLoading || !data?.result || !activeFilter) {
      if (!activeFilter) hasShownToastForCurrentFilterRef.current = ''
      return
    }
    const currentItemsCount = data.result.items?.length ?? 0
    if (currentItemsCount === 0 && hasShownToastForCurrentFilterRef.current !== activeFilter) {
      showErrorToastMessage(tToast('toast.userNotFound', { ns: 'toast' }))
      hasShownToastForCurrentFilterRef.current = activeFilter
    }
  }, [data, analytics.phone, card, isLoading, tToast])

  const handleRFIDScan = useCallback((code: string) => setCard(code), [setCard])
  const handleRFIDClear = useCallback(() => setCard(''), [setCard])
  const handleReset = useCallback(() => reset(), [reset])

  const handlePaginationChange = useCallback(
    (pageIndex0: number, pageSize: number) => {
      if (pageSize !== size) setSize(pageSize)
      else setPage(pageIndex0 + 1)
    },
    [size, setSize, setPage],
  )

  const handleRowClick = (row: IUserInfo) => {
    navigate(`${ROUTE.STAFF_CUSTOMER_MANAGEMENT}/${row.slug}`)
  }

  // Khoảng ngày/SĐT không còn control riêng ở đây — popover thời gian + ô SĐT của
  // dashboard (analytics) đã điều khiển cả hai bảng. `hasActiveFilter`/reset của
  // action bar này chỉ còn nói về thứ vẫn thuộc riêng bảng: thẻ RFID/QR đã quét.
  const CustomerActionOptions = useMemo(() => {
    return function ActionOptions() {
      return (
        <div className="flex flex-wrap gap-2 items-center">
          <CustomerAction
            onRFIDScan={handleRFIDScan}
            onRFIDClear={handleRFIDClear}
            onReset={handleReset}
            scannedCode={card}
            hasActiveFilter={!!card}
          />
        </div>
      )
    }
  }, [card, handleRFIDScan, handleRFIDClear, handleReset])

  const segButton = (value: 'dir' | 'spend', label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => analytics.setTable(value)}
      className={
        'px-3 h-full text-xs font-medium rounded transition-colors ' +
        (analytics.table === value
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground')
      }
    >
      {label}
    </button>
  )

  return (
    <div className="grid grid-cols-1 gap-2 pb-2 h-full">
      <CustomerAnalyticsPanel filters={analytics} onSpendingRowsChange={handleSpendingRows} />

      {/* Switch bảng ĐỘC LẬP với chart: cả hai dashboard cùng hiện nên bảng không thuộc về view nào. */}
      <Card className="shadow-none">
        <CardHeader className="flex flex-row justify-between items-center py-3">
          <CardTitle className="text-base">{t('customer.analytics.tableCardTitle')}</CardTitle>
          <div className="inline-flex p-1 h-9 rounded-md border border-input bg-background">
            {segButton('dir', t('customer.analytics.tableDirectory'))}
            {segButton('spend', t('customer.analytics.tableSpending'))}
          </div>
        </CardHeader>
      </Card>

      {analytics.table === 'spend' ? (
        <CustomerSpendingTable rows={spendingRows} isLoading={spendingLoading} />
      ) : (
        <DataTable
          columns={columns}
          data={data?.result?.items || []}
          isLoading={isLoading}
          pages={data?.result?.totalPages || 0}
          pageIndex={page - 1}
          pageSize={size}
          onPaginationChange={handlePaginationChange}
          onPageChange={() => {}}
          onPageSizeChange={() => {}}
          actionOptions={CustomerActionOptions}
          onRowClick={handleRowClick}
        />
      )}
    </div>
  )
}
