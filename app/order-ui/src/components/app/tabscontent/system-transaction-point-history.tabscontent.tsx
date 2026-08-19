/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import moment from 'moment'
import { saveAs } from 'file-saver'
import { useDebounce } from 'use-debounce'
import {
  ArrowDownRight,
  ArrowUpRight,
  CoinsIcon,
  DownloadIcon,
  RefreshCcw,
  SearchIcon,
  TagIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  WalletIcon,
  XIcon,
} from 'lucide-react'

import {
  useAnalyzePointTransactions,
  useExportSystemPointTransactions,
  useIsMobile,
  usePagination,
  useSystemPointTransactions,
} from '@/hooks'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { PointTransactionType } from '@/constants'
import { SortContext } from '@/contexts'
import { fillPointTransactionBuckets, formatCurrency } from '@/utils'
import { IAnalyzePointTransaction } from '@/types'
import { usePointTransactionColumns } from '@/app/system/card-order-history/DataTable/columns/point-transaction-columns'
import { PointTransactionChart } from '@/app/system/card-order-history/components/point-transaction-chart'
import { DateRangeComparePopover } from '@/components/app/popover'
import { InfoHint } from '@/components/app/tooltip'
import {
  DateFilterValue,
  defaultDateFilter,
  formatRangeLabel,
} from '@/constants/date-range.constants'
import { UserStatisticsGroupBySelect } from '@/components/app/select'
import { UserStatisticsGroupBy } from '@/types'

// The API takes plain dates; the popover works in 'YYYY-MM-DDTHH:mm:ss'.
const toApiDate = (value: string) => moment(value).format('YYYY-MM-DD')

// Single source for the active-filter chips so they can't drift apart.
const FILTER_CHIP_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs text-primary'
const CHIP_CLEAR_CLASS =
  'rounded-full p-0.5 text-primary/70 transition-colors hover:bg-primary/20 hover:text-primary'

// Summary tiles mirror the overview-home KPI card structure
// (Card > CardHeader pb-2 > CardContent) so their height matches by
// construction rather than by a hard-coded value.
/** % thay đổi so với kỳ trước. `null` khi kỳ trước = 0 — chia cho 0 sẽ ra Infinity, mà
 * "tăng vô hạn %" thì vô nghĩa; ca đó hiển thị giá trị tuyệt đối của kỳ trước thay vì %. */
const percentChange = (current: number, previous: number): number | null =>
  previous === 0 ? null : ((current - previous) / previous) * 100

/** Dòng "so với kỳ trước" dưới mỗi thẻ. Cố ý KHÔNG tô xanh/đỏ theo dấu: tăng chi tiêu
 * là xấu còn tăng tích luỹ là tốt, một quy ước màu duy nhất sẽ sai ở một trong hai thẻ.
 * Mũi tên chỉ hướng, người đọc tự diễn giải tốt/xấu theo ngữ cảnh thẻ. */
function ComparisonDelta({
  current,
  previous,
  label,
  previousLabel,
  hint,
}: {
  current: number
  previous: number
  label: string
  previousLabel: string
  hint: string
}) {
  const percent = percentChange(current, previous)
  const isUp = current >= previous
  const Icon = isUp ? ArrowUpRight : ArrowDownRight

  return (
    <div className="flex flex-wrap gap-x-1.5 items-center mt-1.5 text-xs text-muted-foreground">
      <Icon className="w-3.5 h-3.5" />
      <b className="text-foreground">
        {percent === null
          ? `${isUp ? '+' : '−'}${formatCurrency(Math.abs(current - previous), '')}`
          : `${percent >= 0 ? '+' : '−'}${Math.abs(percent).toFixed(1)}%`}
      </b>
      <span>{label}</span>
      <InfoHint content={hint} ariaLabel={label} />
      <span className="opacity-70">
        ({previousLabel}: {formatCurrency(previous, '')})
      </span>
    </div>
  )
}

function PointTransactionSummary({
  analyzeData,
  compareData,
  isLoading,
  isMobile,
}: {
  analyzeData?: IAnalyzePointTransaction
  /** Số liệu kỳ trước; `undefined` khi người dùng không bật so sánh. */
  compareData?: IAnalyzePointTransaction
  isLoading: boolean
  isMobile: boolean
}) {
  const { t } = useTranslation(['profile'])
  const { t: tCommon } = useTranslation('common')

  const gridClass = `grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`

  if (isLoading) {
    return (
      <div className={gridClass}>
        {Array(3)
          .fill(0)
          .map((_value, index) => (
            <Card key={index} className="shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="h-4 w-4 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-32 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
      </div>
    )
  }

  const totalEarned = analyzeData?.totalEarned ?? 0
  const totalSpent = analyzeData?.totalSpent ?? 0
  const net = totalEarned - totalSpent

  const prevEarned = compareData?.totalEarned ?? 0
  const prevSpent = compareData?.totalSpent ?? 0
  const prevNet = prevEarned - prevSpent

  const tiles = [
    {
      key: 'earned',
      title: t('profile.totalEarned'),
      hint: tCommon('hint.totalEarned'),
      value: totalEarned,
      previous: prevEarned,
      sign: '+',
      valueClass: 'text-green-600 dark:text-green-400',
      icon: TrendingUpIcon,
    },
    {
      key: 'spent',
      title: t('profile.totalSpent'),
      hint: tCommon('hint.totalSpent'),
      value: totalSpent,
      previous: prevSpent,
      sign: '-',
      valueClass: 'text-red-600 dark:text-red-400',
      icon: TrendingDownIcon,
    },
    {
      key: 'net',
      title: t('profile.netDifference'),
      hint: tCommon('hint.netDifference'),
      value: Math.abs(net),
      previous: Math.abs(prevNet),
      sign: net >= 0 ? '+' : '-',
      // Neutral accent so net doesn't read as a third in/out state.
      valueClass: 'text-amber-600 dark:text-amber-400',
      icon: WalletIcon,
    },
  ]

  return (
    <div className={gridClass}>
      {tiles.map((tile) => (
        <Card key={tile.key} className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex gap-1.5 items-center text-sm font-medium text-muted-foreground">
              {tile.title}
              <InfoHint content={tile.hint} ariaLabel={tile.title} />
            </CardTitle>
            <tile.icon className={`h-4 w-4 ${tile.valueClass}`} />
          </CardHeader>
          <CardContent>
            <div
              className={`flex items-center gap-1.5 text-2xl font-bold tabular-nums ${tile.valueClass}`}
            >
              <span>
                {tile.sign}
                {formatCurrency(tile.value, '')}
              </span>
              <CoinsIcon className="h-5 w-5 text-primary" />
            </div>
            {compareData && (
              <ComparisonDelta
                current={tile.value}
                previous={tile.previous}
                label={tCommon('compare.vsPrevious')}
                previousLabel={tCommon('compare.previousPeriod')}
                hint={tCommon('hint.vsPrevious')}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function SystemTransactionPointHistoryTabContent() {
  const { t } = useTranslation(['profile'])
  // Bound explicitly: with 'profile' as the default namespace a bare
  // t('giftCard.…') would resolve against 'profile' and render the raw key.
  const { t: tGiftCard } = useTranslation('giftCard')
  const { t: tCustomer } = useTranslation('customer')
  const { t: tCommon } = useTranslation('common')
  const isMobile = useIsMobile()

  const [dateFilter, setDateFilter] = useState<DateFilterValue>(defaultDateFilter)
  const [type, setType] = useState<PointTransactionType>(PointTransactionType.ALL)
  const [keyword, setKeyword] = useState('')
  const [debounceKeyword] = useDebounce(keyword, 500)
  const { pagination, handlePageChange, handlePageSizeChange } = usePagination()

  // `/point-transaction/analysis` và `/point-transaction` (list) dùng CHUNG
  // `FindAllPointTransactionDto` → nhận `startDate`/`endDate` + `groupBy`.
  // Payload này KHÔNG chứa page/size để summary + chart không refetch khi đổi trang.
  const analysisPayload = useMemo(() => {
    const payload: any = {
      type: type === PointTransactionType.ALL ? null : type,
      startDate: toApiDate(dateFilter.startDate),
      endDate: toApiDate(dateFilter.endDate),
      groupBy: dateFilter.groupBy,
    }
    if (debounceKeyword) payload.k = debounceKeyword
    return payload
  }, [type, dateFilter.startDate, dateFilter.endDate, dateFilter.groupBy, debounceKeyword])

  // Export dùng DTO RIÊNG (`ExportAllSystemPointTransactionDto`) và vẫn giữ tên cũ
  // `fromDate`/`toDate` — KHÔNG spread `analysisPayload` vào đây: BE validate với
  // `whitelist: true` nên `startDate`/`endDate` sẽ bị loại bỏ âm thầm và file xuất ra
  // mất luôn bộ lọc thời gian. DTO này cũng không nhận `k`/`groupBy`.
  const exportPayload = useMemo(
    () => ({
      type: type === PointTransactionType.ALL ? null : type,
      fromDate: toApiDate(dateFilter.startDate),
      toDate: toApiDate(dateFilter.endDate),
    }),
    [type, dateFilter.startDate, dateFilter.endDate],
  )

  const listPayload = useMemo(
    () => ({
      ...analysisPayload,
      page: pagination.pageIndex,
      size: pagination.pageSize,
    }),
    [analysisPayload, pagination.pageIndex, pagination.pageSize],
  )

  // Kỳ trước: CÙNG endpoint, cùng bộ lọc, chỉ khác khoảng ngày. BE không phải làm gì
  // thêm. Chỉ gọi khi người dùng thật sự bật so sánh và popover đã có khoảng hợp lệ.
  const compareEnabled =
    dateFilter.compareEnabled && !!dateFilter.compareStart && !!dateFilter.compareEnd
  const comparePayload = useMemo(
    () => ({
      ...analysisPayload,
      startDate: toApiDate(dateFilter.compareStart),
      endDate: toApiDate(dateFilter.compareEnd),
    }),
    [analysisPayload, dateFilter.compareStart, dateFilter.compareEnd],
  )

  const { isLoading, data, refetch } = useSystemPointTransactions(listPayload)
  const { data: analyzeData, isLoading: isLoadingAnalysis } =
    useAnalyzePointTransactions(analysisPayload)
  const { data: compareData } = useAnalyzePointTransactions(
    comparePayload,
    compareEnabled,
  )
  const { mutate: exportMutation, isPending } =
    useExportSystemPointTransactions()

  const pointTransactions = useMemo(() => data?.result?.items || [], [data])
  const totalCount = data?.result?.total || 0
  // BE chỉ trả về những mốc CÓ giao dịch → chuỗi thưa. Lấp đủ mốc trong kỳ để trục
  // thời gian không bị bóp méo (xem `fillPointTransactionBuckets`).
  const statistics = useMemo(
    () =>
      fillPointTransactionBuckets(
        analyzeData?.result?.statistics ?? [],
        dateFilter.startDate,
        dateFilter.endDate,
        dateFilter.groupBy,
      ),
    [analyzeData, dateFilter.startDate, dateFilter.endDate, dateFilter.groupBy],
  )

  // Kỳ trước cũng phải lấp bucket, và lấp theo KHOẢNG CỦA CHÍNH NÓ — hai kỳ cùng độ dài
  // nên ra cùng số bucket, ghép theo index trên chart là khớp.
  const compareStatistics = useMemo(
    () =>
      fillPointTransactionBuckets(
        compareData?.result?.statistics ?? [],
        dateFilter.compareStart,
        dateFilter.compareEnd,
        dateFilter.groupBy,
      ),
    [compareData, dateFilter.compareStart, dateFilter.compareEnd, dateFilter.groupBy],
  )

  const typeLabel = useMemo(() => {
    if (type === PointTransactionType.IN) return t('profile.coinEarned')
    if (type === PointTransactionType.OUT) return t('profile.coinSpent')
    return t('profile.allTransactions')
  }, [type, t])

  const defaults = useMemo(() => defaultDateFilter(), [])
  const isDefaultRange =
    dateFilter.startDate === defaults.startDate &&
    dateFilter.endDate === defaults.endDate
  const hasActiveFilters =
    !isDefaultRange || type !== PointTransactionType.ALL || !!debounceKeyword

  // Any filter change resets to page 1 to avoid landing on an empty page.
  const handleApplyRange = useCallback(
    (value: DateFilterValue) => {
      setDateFilter(value)
      handlePageChange(1)
    },
    [handlePageChange],
  )

  // Cách gộp là lựa chọn GHI ĐÈ: preset đã đặt một giá trị mặc định, select này cho phép
  // đổi riêng nó mà không đụng tới khoảng ngày.
  const handleGroupByChange = useCallback(
    (groupBy: UserStatisticsGroupBy) => {
      setDateFilter((prev) => ({ ...prev, groupBy }))
    },
    [],
  )

  const handleTypeChange = useCallback(
    (value: PointTransactionType) => {
      setType(value)
      handlePageChange(1)
    },
    [handlePageChange],
  )

  const handleKeywordChange = useCallback(
    (value: string) => {
      setKeyword(value)
      handlePageChange(1)
    },
    [handlePageChange],
  )

  const handleClearFilter = useCallback(() => {
    setDateFilter(defaultDateFilter())
    setType(PointTransactionType.ALL)
    setKeyword('')
    handlePageChange(1)
  }, [handlePageChange])

  const handleRefresh = useCallback(() => {
    handlePageChange(1)
    refetch()
  }, [handlePageChange, refetch])

  const handleExport = useCallback(() => {
    const ITEM_MAX = 1000000
    exportMutation(
      { ...exportPayload, size: ITEM_MAX, ignoreSize: true },
      {
        onSuccess: (result) => {
          saveAs(result.blob, result.filename)
        },
      },
    )
  }, [exportPayload, exportMutation])

  const handleSortChange = () => {}

  const rangeLabel = formatRangeLabel(
    dateFilter.activePreset,
    dateFilter.startDate,
    dateFilter.endDate,
    tCustomer('customer.registrationDashboard.presetAllTime'),
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar: search left, filters + actions right. Màn hẹp thì CUỘN NGANG
          (`overflow-x-auto` + các item `shrink-0`) thay vì xuống dòng, để thứ tự và vị
          trí tương đối của các control không đổi theo bề rộng màn hình. Ô search phải
          có bề rộng CỐ ĐỊNH (không `flex-1`) — trong hàng cuộn được, `flex-1` sẽ bị co
          lại thay vì đẩy hàng tràn ra. */}
      <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap scrollbar-hide">
        <div className="relative w-[18rem] shrink-0">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="bg-background pl-9 text-sm dark:border-gray-700"
            placeholder={t('profile.searchPlaceholer')}
            value={keyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <DateRangeComparePopover value={dateFilter} onApply={handleApplyRange} />
          <UserStatisticsGroupBySelect
            value={dateFilter.groupBy}
            onChange={handleGroupByChange}
            labelPrefix={tCommon('dayOfWeek.groupByPrefix')}
          />
          <Select value={type} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-40 bg-background dark:border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PointTransactionType.ALL}>
                {t('profile.allTransactions')}
              </SelectItem>
              <SelectItem value={PointTransactionType.IN}>
                {t('profile.coinEarned')}
              </SelectItem>
              <SelectItem value={PointTransactionType.OUT}>
                {t('profile.coinSpent')}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={handleRefresh}
            className="flex items-center gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            {tCommon('common.refresh')}
          </Button>
          <Button
            onClick={handleExport}
            disabled={isPending || totalCount === 0}
            className="flex min-w-[120px] items-center gap-2"
          >
            <DownloadIcon size={16} />
            {t('profile.exportAll')}
          </Button>
        </div>
      </div>

      {/* Active-filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {t('profile.filter')}:
        </span>
        <span className={FILTER_CHIP_CLASS}>
          {tGiftCard('giftCard.pointTransaction.period')}{' '}
          <b className="font-semibold">{rangeLabel}</b>
        </span>
        {type !== PointTransactionType.ALL && (
          <span className={FILTER_CHIP_CLASS}>
            {tGiftCard('giftCard.pointTransaction.type')}{' '}
            <b className="font-semibold">{typeLabel}</b>
            <button
              type="button"
              aria-label={t('profile.clearFilter')}
              onClick={() => handleTypeChange(PointTransactionType.ALL)}
              className={CHIP_CLEAR_CLASS}
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        )}
        {debounceKeyword && (
          <span className={FILTER_CHIP_CLASS}>
            <b className="font-semibold">“{debounceKeyword}”</b>
            <button
              type="button"
              aria-label={t('profile.clearFilter')}
              onClick={() => handleKeywordChange('')}
              className={CHIP_CLEAR_CLASS}
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        )}
        {/* Always rendered so the control never disappears on the user; it just
            goes inert when there is nothing to clear. */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearFilter}
          disabled={!hasActiveFilters}
          className="h-7 gap-1.5 border-destructive bg-destructive/10 px-3 text-xs text-destructive hover:bg-destructive/20 hover:text-destructive"
        >
          <XIcon className="h-3.5 w-3.5" />
          {t('profile.clearFilter')}
        </Button>
        <span className="text-xs text-muted-foreground">
          · {totalCount} {t('profile.coinTransactions').toLowerCase()}
        </span>
      </div>

      {/* Summary tiles */}
      <PointTransactionSummary
        analyzeData={analyzeData?.result}
        compareData={compareEnabled ? compareData?.result : undefined}
        isLoading={isLoadingAnalysis}
        isMobile={isMobile}
      />

      {/* Coin history chart */}
      <PointTransactionChart
        data={statistics}
        compareData={compareEnabled ? compareStatistics : undefined}
        isLoading={isLoadingAnalysis}
        groupBy={dateFilter.groupBy}
      />

      {/* Transactions table */}
      {/* Horizontal padding keeps the inner table's own border off the rounded
          corners (it was being clipped at both edges); pb gives the pagination
          row room to breathe. */}
      <div className="rounded-xl border px-4 pb-4 pt-4 dark:border-gray-700">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 p-1.5 text-primary">
            <TagIcon className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('profile.coinTransactions')}
          </h3>
          <span className="text-xs text-muted-foreground">({totalCount})</span>
        </div>
        <SortContext.Provider value={{ onSort: handleSortChange }}>
          <DataTable
            columns={usePointTransactionColumns({
              page: data?.result.page || 0,
              size: data?.result?.pageSize || 0,
            })}
            data={pointTransactions}
            isLoading={isLoading}
            pages={data?.result.totalPages || 0}
            hiddenDatePicker={true}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </SortContext.Provider>
      </div>
    </div>
  )
}
