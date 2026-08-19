import { useEffect, useMemo, useRef } from 'react'
import moment from 'moment'
import { useTranslation } from 'react-i18next'
import { RefreshCcw, RotateCcw, Search } from 'lucide-react'

import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import {
  useBranch,
  useCustomerAccountRevenue,
  useDebouncedInput,
  useUsers,
  useUserStatistics,
} from '@/hooks'
import { UserStatisticsGroupBySelect } from '@/components/app/select'
import { PaymentMethod, Role } from '@/constants'
import { CustomerAccountRevenueType } from '@/types'
import { fillSpendingBuckets, fillTimeBuckets } from '@/utils'
import { CustomerAnalyticsFilters, resolveDefaultBranch } from '@/app/system/customers/hooks'
import { SpendingRow } from '@/app/system/customers/DataTable/columns'
import { useBranchStore } from '@/stores'

import { DateFilterValue, PRESETS, formatRangeLabel } from '@/constants/date-range.constants'
import DateRangeComparePopover from '@/components/app/popover/date-range-compare-popover'
import CustomerAnalyticsSummary from './customer-analytics-summary'
import CustomerAnalyticsChart from './customer-analytics-chart'

interface CustomerAnalyticsPanelProps {
  filters: CustomerAnalyticsFilters
  onSpendingRowsChange?: (rows: SpendingRow[], isLoading: boolean) => void
}

const DAY = 'YYYY-MM-DD'
const DATETIME = 'YYYY-MM-DDTHH:mm:ss'
const startOfDay = (d: string) => moment(d).startOf('day').format(DATETIME)
const endOfDay = (d: string) => moment(d).endOf('day').format(DATETIME)

const PAYMENT_METHODS: { value: PaymentMethod; i18n: string }[] = [
  { value: PaymentMethod.BANK_TRANSFER, i18n: 'customer.analytics.paymentBank' },
  { value: PaymentMethod.CASH, i18n: 'customer.analytics.paymentCash' },
  { value: PaymentMethod.POINT, i18n: 'customer.analytics.paymentPoint' },
  { value: PaymentMethod.CREDIT_CARD, i18n: 'customer.analytics.paymentCredit' },
]

const ALL = '__all__'

export default function CustomerAnalyticsPanel({
  filters,
  onSpendingRowsChange,
}: CustomerAnalyticsPanelProps) {
  const { t } = useTranslation('customer')
  // Chỉ mượn ĐÚNG MỘT chuỗi ("Đang lọc theo") từ namespace `dashboard` — cùng nhãn mà
  // `order-overview.tab-content.tsx` dùng cho hàng badge của nó — thay vì chép lại
  // chuỗi này vào `customer.json` và có hai nguồn sự thật cho cùng một câu chữ.
  const { t: tDashboard } = useTranslation('dashboard')

  const startDate = startOfDay(filters.from)
  const endDate = endOfDay(filters.to)
  const compareOn = filters.compareEnabled && !!filters.compareFrom && !!filters.compareTo

  /**
   * Chỉ lấy TÊN chi nhánh — không dùng `BranchSelect` (component dùng chung cho 15+
   * màn hình khác) vì label của nó là `name - address`; địa chỉ đầy đủ làm vỡ hàng
   * toolbar khi trigger co giãn theo nội dung. Cùng hook `useBranch` mà `BranchSelect`
   * dùng, chỉ khác cách render.
   */
  const { data: branchData } = useBranch()
  const branches = useMemo(() => branchData?.result ?? [], [branchData])

  /**
   * `branch` là REQUIRED trên `GET /revenue/account` — không còn lựa chọn "Tất cả
   * chi nhánh" gửi request thiếu tham số. Khi URL chưa có `branch`, resolve mặc định
   * theo đúng thứ tự ưu tiên của `BranchSelect`: chi nhánh đang lưu trong
   * `useBranchStore` (nhân viên đang thao tác tại đó) nếu còn hợp lệ, ngược lại chi
   * nhánh đầu tiên. Danh sách chi nhánh tải bất đồng bộ nên `defaultBranchSlug` có
   * thể rỗng ở lần render đầu — `effectiveBranch` theo đó cũng rỗng và các truy vấn
   * chi tiêu bị `enabled: false` chặn lại (xem `spendQuery` bên dưới) để không bao
   * giờ bắn request thiếu `branch`.
   */
  const { branch: storeBranch } = useBranchStore()
  const defaultBranchSlug = useMemo(
    () => resolveDefaultBranch(branches, storeBranch?.slug),
    [branches, storeBranch?.slug],
  )
  const effectiveBranch = filters.branch || defaultBranchSlug

  // Ghi lại mặc định vào URL — một lần, bằng `replace` để không đẻ ra history entry
  // lúc mount — để `branch` trên URL luôn phản ánh ĐÚNG những gì đã gửi lên API
  // (chia sẻ link, back/forward đều nhất quán) thay vì có một chi nhánh "ngầm" chỉ
  // tồn tại trong bộ nhớ component. Chỉ một setter (`setBranch`) trong effect này —
  // không ghép với setter nào khác.
  useEffect(() => {
    if (!filters.branch && defaultBranchSlug) {
      filters.setBranch(defaultBranchSlug, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.branch, defaultBranchSlug])

  const {
    data: newData,
    isLoading: newLoading,
    refetch: refetchNew,
  } = useUserStatistics({ startDate, endDate, groupBy: filters.groupBy }, true)
  const { data: newPrevData, refetch: refetchNewPrev } = useUserStatistics(
    {
      startDate: compareOn ? startOfDay(filters.compareFrom) : '',
      endDate: compareOn ? endOfDay(filters.compareTo) : '',
      groupBy: filters.groupBy,
    },
    compareOn,
  )

  // `branch` REQUIRED trên API — không bắn truy vấn khi chưa resolve được chi nhánh
  // nào (danh sách chi nhánh còn đang tải ở lần render đầu).
  const hasBranch = !!effectiveBranch
  const spendQuery = {
    startDate,
    endDate,
    groupBy: filters.groupBy,
    branch: effectiveBranch || undefined,
    paymentMethod: (filters.paymentMethod as PaymentMethod) || undefined,
    phonenumber: filters.phone || undefined,
    customerType: filters.customerType,
  }
  const {
    data: spendData,
    isLoading: spendLoading,
    refetch: refetchSpend,
  } = useCustomerAccountRevenue(spendQuery, hasBranch)
  const { data: spendPrevData, refetch: refetchSpendPrev } = useCustomerAccountRevenue(
    {
      ...spendQuery,
      startDate: compareOn ? startOfDay(filters.compareFrom) : '',
      endDate: compareOn ? endOfDay(filters.compareTo) : '',
    },
    hasBranch && compareOn,
  )

  // Tổng khách TOÀN HỆ THỐNG, KHÔNG giới hạn khoảng ngày.
  //
  // KHÔNG truyền `branch` — đây là chủ ý, không phải thiếu sót. `/user` CÓ hỗ trợ lọc
  // chi nhánh, nhưng lọc theo nó ở đây sẽ cho số SAI: khách tự đăng ký không bao giờ
  // được gán chi nhánh (auth.service.ts `register` chỉ set `{ password, role }`), nên
  // `user.branch` là NULL với gần như toàn bộ khách. Backend lọc bằng
  // `whereOptions.branch = { slug }` — một INNER JOIN — nên mọi khách NULL bị loại sạch
  // và con số tụt xuống chỉ còn vài khách tình cờ có chi nhánh. Cột `branch` trên bảng
  // `user` thực chất dành cho NHÂN VIÊN; liên kết khách↔chi nhánh chỉ tồn tại qua ĐƠN
  // HÀNG, không có ở tầng user. "Tổng khách của chi nhánh" vì thế không phải khái niệm
  // tính được từ endpoint này — muốn có phải thêm API đếm khách theo đơn ở BE.
  //
  // KHÔNG truyền startDate/endDate: card này là con số nền ổn định, kéo khoảng ngày trên
  // panel thì nó phải đứng yên. Truyền ngày vào sẽ biến nó thành "khách tạo trong kỳ",
  // trùng ý nghĩa với card "Khách mới" ngay cạnh.
  //
  // `size: 1` vì chỉ cần trường `total` của response phân trang; BE dùng `findAndCount`
  // nên `total` là số đếm ĐẦY ĐỦ của bộ lọc, không phụ thuộc `size`. Lấy size lớn hơn
  // chỉ tải về những dòng không ai đọc.
  //
  // `enabled: true` — không phụ thuộc chi nhánh nên không gate theo `hasBranch` như hai
  // truy vấn chi tiêu.
  const { data: totalCustomersData, refetch: refetchTotalCustomers } = useUsers(
    {
      page: 1,
      size: 1,
      order: 'DESC',
      hasPaging: true,
      role: Role.CUSTOMER,
    },
    true,
  )

  // `result` là OBJECT tổng hợp (summary + customers + data + total), không phải mảng.
  const revenue = spendData?.result
  const revenuePrev = spendPrevData?.result

  const newCustomers = useMemo(
    () => fillTimeBuckets(newData?.result?.data ?? [], startDate, endDate, filters.groupBy),
    [newData, startDate, endDate, filters.groupBy],
  )
  const newCustomersPrev = useMemo(
    () =>
      compareOn
        ? fillTimeBuckets(
            newPrevData?.result?.data ?? [],
            startOfDay(filters.compareFrom),
            endOfDay(filters.compareTo),
            filters.groupBy,
          )
        : [],
    [compareOn, newPrevData, filters.compareFrom, filters.compareTo, filters.groupBy],
  )
  const spending = useMemo(
    () => fillSpendingBuckets(revenue?.data ?? [], startDate, endDate, filters.groupBy),
    [revenue, startDate, endDate, filters.groupBy],
  )
  const spendingPrev = useMemo(
    () =>
      compareOn
        ? fillSpendingBuckets(
            revenuePrev?.data ?? [],
            startOfDay(filters.compareFrom),
            endOfDay(filters.compareTo),
            filters.groupBy,
          )
        : [],
    [compareOn, revenuePrev, filters.compareFrom, filters.compareTo, filters.groupBy],
  )

  /**
   * Ô SĐT: gõ phím KHÔNG được ghi thẳng vào URL — mỗi ký tự là một request và một
   * entry history. Debounce theo đúng cách của DataTable (`useDebouncedInput`).
   * `lastPushedRef` giữ giá trị vừa đồng bộ hai chiều: nếu không có nó, nút reset
   * (xoá `phone` khỏi URL) sẽ bị debounce của ô input ghi ngược trở lại.
   */
  const {
    inputValue: phoneInput,
    setInputValue: setPhoneInput,
    debouncedInputValue: debouncedPhone,
  } = useDebouncedInput({ defaultValue: filters.phone, delay: 400 })
  const lastPushedRef = useRef(filters.phone)
  const setPhone = filters.setPhone
  const urlPhone = filters.phone

  useEffect(() => {
    if (debouncedPhone === lastPushedRef.current) return
    lastPushedRef.current = debouncedPhone
    setPhone(debouncedPhone)
  }, [debouncedPhone, setPhone])

  useEffect(() => {
    if (urlPhone === lastPushedRef.current) return
    lastPushedRef.current = urlPhone
    setPhoneInput(urlPhone)
    // setPhoneInput là handler mới mỗi render (không memo hoá) → cố ý bỏ khỏi deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPhone])

  /**
   * Reset phải xoá CẢ state cục bộ (`phoneInput`) lẫn URL. Nếu chỉ gọi `filters.reset()`,
   * khi URL chưa từng có `phone` thì `urlPhone === lastPushedRef.current` (đều là `''`)
   * → effect đồng bộ hai chiều bên trên short-circuit và không xoá ô nhập; ~400ms sau,
   * debounce của ô input lại tự ghi ngược giá trị vừa gõ vào URL, đè lên ý định Reset.
   * `setPhoneInput('')` là state cục bộ (không navigate) nên effect debounce sau đó
   * no-op vì `'' === lastPushedRef.current`.
   */
  const handleResetFilters = () => {
    setPhoneInput('')
    filters.reset()
  }

  const spendingRows = useMemo(() => revenue?.customers ?? [], [revenue])
  useEffect(() => {
    onSpendingRowsChange?.(spendingRows, spendLoading)
  }, [spendingRows, spendLoading, onSpendingRowsChange])

  const dateFilterValue: DateFilterValue = useMemo(
    () => ({
      startDate,
      endDate,
      activePreset: filters.preset,
      groupBy: filters.groupBy,
      compareEnabled: filters.compareEnabled,
      compareStart: filters.compareFrom ? startOfDay(filters.compareFrom) : '',
      compareEnd: filters.compareTo ? endOfDay(filters.compareTo) : '',
    }),
    [
      startDate,
      endDate,
      filters.preset,
      filters.groupBy,
      filters.compareEnabled,
      filters.compareFrom,
      filters.compareTo,
    ],
  )

  const handleApplyRange = (value: DateFilterValue) => {
    filters.setRange({
      from: moment(value.startDate).format(DAY),
      to: moment(value.endDate).format(DAY),
      groupBy: value.groupBy,
      preset: value.activePreset,
      compareEnabled: value.compareEnabled,
      compareFrom: value.compareStart ? moment(value.compareStart).format(DAY) : '',
      compareTo: value.compareEnd ? moment(value.compareEnd).format(DAY) : '',
    })
  }

  const handleRefresh = () => {
    // Luôn refetch 3 truy vấn "kỳ hiện tại"; chỉ refetch truy vấn so sánh khi nó đang bật (enabled).
    refetchNew()
    refetchSpend()
    refetchTotalCustomers()
    if (compareOn) {
      refetchNewPrev()
      refetchSpendPrev()
    }
  }

  // Mỗi control tự nêu nhãn ngay trên trigger ("Chi nhánh: <tên>") để không cần một
  // hàng nhãn riêng phía trên — theo đúng bố cục demo. Không còn lựa chọn "Tất cả chi
  // nhánh" (branch REQUIRED trên API) nên rỗng chỉ xảy ra trong khoảnh khắc chi nhánh
  // còn đang tải.
  const selectedBranchLabel = branches.find((b) => b.slug === effectiveBranch)?.name ?? ''
  const selectedPaymentLabel = filters.paymentMethod
    ? t(PAYMENT_METHODS.find((m) => m.value === filters.paymentMethod)?.i18n ?? '')
    : t('customer.analytics.allPaymentMethods')
  const selectedCustomerTypeLabel =
    filters.customerType === CustomerAccountRevenueType.ALL
      ? t('customer.analytics.customerTypeAll')
      : t('customer.analytics.customerTypeNewRegister')

  /**
   * Hàng badge "Lọc:" đọc lại đúng những gì `DateRangeComparePopover` đang áp — vì
   * trigger của popover giờ chỉ còn nhãn tĩnh "Khoảng thời gian" (Change 3), hàng này
   * là nơi hiển thị khoảng ngày/so sánh đang active. Không còn badge riêng cho groupBy:
   * `UserStatisticsGroupBySelect` trong hàng control phía trên đã tự nêu giá trị ngay
   * trên trigger của nó (`labelPrefix`), lặp lại ở đây chỉ thừa. Cũng không thêm badge
   * cho branch/phương thức/loại khách — ba control đó cũng đã tự nêu giá trị ngay trên
   * trigger của chính chúng (`selectedBranchLabel` v.v.).
   */
  const allTimeLabel = t('customer.registrationDashboard.presetAllTime')
  const activeRangeLabel = filters.preset
    ? t(PRESETS.find((p) => p.key === filters.preset)?.i18n ?? '')
    : formatRangeLabel(null, startDate, endDate, allTimeLabel)

  /**
   * PO đổi ý riêng cho trường hợp SĐT: ẨN HẲN nửa "khách mới" — KPI card lẫn panel
   * biểu đồ trên. Lý do gốc: `/user/statistics` (nguồn của "Khách mới") không nhận
   * `phonenumber` nên số "khách mới" không mô tả đúng tập khách đã lọc theo SĐT.
   * `CustomerAnalyticsSummary`/`CustomerAnalyticsChart` dùng cờ này qua prop
   * `hideNewCustomerCard`/`spendingOnly` để ẩn hẳn nửa trên, không chỉ làm mờ nó.
   */
  const phoneNarrowed = !!filters.phone

  return (
    // Card viền + shadow đã bị bỏ (yêu cầu thiết kế: chart đọc "mở" trên trang, không
    // đóng khung) — thay bằng `div` trơn, padding nhẹ `p-3` thay vì `p-6` mặc định của
    // `CardHeader`/`CardContent` cũ (đóng khung nặng không còn lý do để giữ padding dày).
    <div className="flex flex-col gap-3 p-3">
      {/* Header giờ chỉ còn select chi nhánh, neo PHẢI — đúng vị trí toggle metric
          ("Số tiền"/"Số giao dịch") từng đứng trước khi bị bỏ (PO quyết định biểu đồ
          chỉ hiện số tiền). Title "Khách mới & chi tiêu" cũng bị bỏ theo yêu cầu mới.
          Wiring của select GIỮ NGUYÊN Y HỆT — cùng `effectiveBranch`/`filters.setBranch`
          đã resolve mặc định + gate các truy vấn chi tiêu ở trên, chỉ đổi vị trí render
          (trước đây nằm trong cụm control bên phải của toolbar). */}
      <div className="flex justify-end items-center">
        <Select
          value={effectiveBranch}
          onValueChange={(v) => filters.setBranch(v)}
        >
          <SelectTrigger className="w-[17rem] h-9">
            <SelectValue>
              {`${t('customer.analytics.filterBranch')}: ${selectedBranchLabel}`}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b.slug} value={b.slug}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Một hàng duy nhất theo quy ước dashboard chuẩn: chỉ TÌM KIẾM (SĐT, control
          người dùng chạm nhiều nhất) neo bên trái; mọi control còn lại — thời gian
          (kèm groupBy + so sánh), phương thức, loại khách, rồi hai HÀNH ĐỘNG chỉ-icon
          (refresh, reset) đứng cạnh nhau ở cuối — gom về bên phải bằng `ml-auto`.
          Chi nhánh KHÔNG còn ở đây nữa — đã chuyển lên header phía trên (xem block
          ngay trước). Màn hẹp: hàng CUỘN NGANG (`overflow-x-auto` + `whitespace-nowrap`,
          các item `shrink-0`) thay vì xuống dòng — giữ mọi control trên đúng một hàng
          nên vị trí tương đối của chúng không đổi theo bề rộng màn hình.
          `delayDuration={200}` trên `TooltipProvider` (thay vì mặc định 700ms
          của Radix): trong CÙNG một provider, Radix chỉ áp full delay cho tooltip
          HOVER ĐẦU TIÊN — các tooltip sau đó trong cùng provider bật gần như ngay lập
          tức (skip-delay). Refresh đứng trước reset nên luôn là tooltip đầu tiên người
          dùng chạm tới và luôn cảm giác "chậm hơn" nếu để delay mặc định; hạ delay
          xuống 200ms cho cả provider để cả hai tooltip nhất quán, không cái nào ì. */}
      <TooltipProvider delayDuration={200}>
        <div className="flex gap-2 items-center overflow-x-auto whitespace-nowrap scrollbar-hide">
          {/* Neo TRÁI duy nhất: ô tìm SĐT. Rộng hơn để gõ một số điện thoại VN đầy đủ
              thoải mái mà không bị cắt chữ; vẫn không lấn át hàng. */}
          <div className="relative w-[16rem] shrink-0">
            <Search className="absolute left-2 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 w-full h-9 text-xs"
              placeholder={t('customer.analytics.filterPhone')}
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
            />
          </div>

          {/* Cụm PHẢI, đẩy sang phải bằng `ml-auto`: thời gian + cách nhóm (áp toàn
              dashboard — cả hai biểu đồ) rồi hai control CHỈ áp cho khối chi tiêu
              (`/user/statistics` không nhận các filter này nên biểu đồ khách mới không
              bị lọc theo chúng), cuối cùng là refresh + reset đứng SÁT NHAU ở cuối hàng.
              `UserStatisticsGroupBySelect` đứng NGAY SAU popover ngày — preset/khoảng
              tuỳ chỉnh trong popover đặt một groupBy MẶC ĐỊNH hợp lý khi Apply
              (`PRESET_GROUPBY`/`groupByForSpan`, xem `date-range-compare-popover.tsx`),
              select này chỉ cho phép GHI ĐÈ lựa chọn đó sau đó — một setter URL riêng
              (`filters.setGroupBy`), không gộp chung handler với popover. */}
          <div className="flex gap-2 items-center ml-auto shrink-0">
            <DateRangeComparePopover value={dateFilterValue} onApply={handleApplyRange} />
            <UserStatisticsGroupBySelect
              value={filters.groupBy}
              onChange={filters.setGroupBy}
            />
            <Select
              value={filters.paymentMethod || ALL}
              onValueChange={(v) => filters.setPaymentMethod(v === ALL ? '' : v)}
            >
              {/* Không còn tiền tố "Phương thức: " — giá trị ("Tất cả phương thức",
                  "Chuyển khoản", ...) đã tự nói lên nó là gì, tiền tố chỉ lặp lại chữ
                  "phương thức" và làm trigger bị cắt chữ. Rút từ 13rem xuống 11rem vì
                  chuỗi dài nhất ("Tất cả phương thức") giờ ngắn hơn hẳn bản có tiền tố. */}
              <SelectTrigger className="w-[11rem] h-9">
                <SelectValue>{selectedPaymentLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('customer.analytics.allPaymentMethods')}</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {t(m.i18n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.customerType}
              onValueChange={(v) => filters.setCustomerType(v as CustomerAccountRevenueType)}
            >
              {/* Cùng lý do: bỏ tiền tố "Loại khách: " ("Loại khách: Tất cả khách" lặp
                  chữ "khách" hai lần). Rút xuống 10rem — vẫn đủ cho chuỗi dài nhất
                  ("Khách mới đăng ký" / "Newly registered"). */}
              <SelectTrigger className="w-[10rem] h-9">
                <SelectValue>{selectedCustomerTypeLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CustomerAccountRevenueType.NEW_REGISTER}>
                  {t('customer.analytics.customerTypeNewRegister')}
                </SelectItem>
                <SelectItem value={CustomerAccountRevenueType.ALL}>
                  {t('customer.analytics.customerTypeAll')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-9 h-9 shrink-0"
                  onClick={handleRefresh}
                  aria-label={t('customer.analytics.refresh')}
                >
                  <RefreshCcw className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('customer.analytics.refresh')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-9 h-9 shrink-0"
                  onClick={handleResetFilters}
                  aria-label={t('customer.analytics.reset')}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('customer.analytics.reset')}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>

      {/* Hàng readout cho control THỜI GIAN — cùng khuôn mẫu badge "Lọc:" của
          `order-overview.tab-content.tsx` (badge outline viền primary). Không lặp lại
          branch/phương thức/loại khách/SĐT ở đây vì mỗi control đó đã tự nêu giá trị
          ngay trên trigger của nó. `overflow-x-auto` để hàng cuộn ngang thay vì đẩy
          rộng trang trên màn hình hẹp. */}
      <div className="flex overflow-x-auto gap-2 items-center">
        <span className="text-sm text-muted-foreground">{tDashboard('dashboard.filter')}</span>
        <Badge
          variant="outline"
          className="flex gap-1 items-center h-8 text-sm border-primary text-primary bg-primary/10"
        >
          {activeRangeLabel}
        </Badge>
        {compareOn && (
          <Badge
            variant="outline"
            className="flex gap-1 items-center h-8 text-sm border-primary text-primary bg-primary/10"
          >
            {t('customer.registrationDashboard.compareWithPrevious')}
          </Badge>
        )}
      </div>

      <CustomerAnalyticsSummary
        revenue={revenue}
        newCustomerTotal={newData?.result?.total ?? 0}
        allCustomerTotal={totalCustomersData?.result?.total}
        newCustomerPrevTotal={compareOn ? newPrevData?.result?.total : undefined}
        spendPrevTotal={compareOn ? revenuePrev?.summary?.totalAmount : undefined}
        customerType={filters.customerType}
        isLoading={newLoading || spendLoading}
        hideNewCustomerCard={phoneNarrowed}
        paymentMethodSelected={!!filters.paymentMethod}
      />

      {/* Không bọc viền ở đây: mỗi chart tự có card viền bo tròn riêng
          (`ChartCard` trong `customer-analytics-chart`), thêm một lớp nữa sẽ thành
          khung lồng khung. */}
      <CustomerAnalyticsChart
        newCustomers={newCustomers}
        newCustomersPrev={newCustomersPrev}
        spending={spending}
        spendingPrev={spendingPrev}
        groupBy={filters.groupBy}
        compareEnabled={compareOn}
        isLoading={newLoading || spendLoading}
        spendingOnly={phoneNarrowed}
      />
    </div>
  )
}
