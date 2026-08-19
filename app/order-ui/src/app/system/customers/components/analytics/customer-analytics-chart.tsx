import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import moment from 'moment'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui'
import { TrendBadge } from '@/components/app/badge'
import { TrendReadingGuide } from '@/components/app/accordion'
import { InfoHint } from '@/components/app/tooltip'
import {
  ICustomerAccountRevenueTimeItem,
  IUserStatisticsItem,
  UserStatisticsGroupBy,
} from '@/types'
import { formatCurrency, isTrendVisible, trendOf, TrendResult } from '@/utils'

import { useChartColors } from './chart-colors'

interface CustomerAnalyticsChartProps {
  newCustomers: IUserStatisticsItem[]
  newCustomersPrev: IUserStatisticsItem[]
  spending: ICustomerAccountRevenueTimeItem[]
  spendingPrev: ICustomerAccountRevenueTimeItem[]
  groupBy: UserStatisticsGroupBy
  compareEnabled: boolean
  isLoading: boolean
  /**
   * `true` khi filter SĐT đang thu hẹp khối chi tiêu — ẨN HẲN panel "khách mới". Dựng
   * lại option thành MỘT grid duy nhất (chỉ series chi tiêu), một xAxis, một yAxis —
   * KHÔNG BAO GIỜ hai thang Y trong một plot vẫn đúng vì đây vẫn chỉ có một yAxis; quy
   * tắc cấm là "hai thang Y trong MỘT grid", không phải "chỉ được một grid". Hai-grid
   * layout (nhánh else) giữ nguyên y hệt khi cờ này tắt.
   */
  spendingOnly?: boolean
}

/**
 * Mỗi panel giờ là MỘT chart riêng trong MỘT card có viền bo tròn, tiêu đề nằm ở thẻ
 * HTML phía trên canvas (không dùng `title` của ECharts — nó vẽ trong canvas nên đè lên
 * tên trục Y). Vì thế mỗi canvas chỉ còn MỘT grid, hình học rút gọn còn:
 *   grid.top    = 44   (legend ở top:0 chiếm ~16px; 28px còn lại là khoảng thở cho NHÃN
 *                        SỐ trên đầu cột — ECharts đặt nhãn đó NGOÀI grid và KHÔNG tính
 *                        vào layout, nên cột cao nhất sẽ đẩy nhãn đè lên hàng legend nếu
 *                        hạ số này. ĐỪNG hạ xuống dưới 44.)
 *   grid.height = phần vẽ thật (xem ba hằng số PLOT bên dưới)
 *   grid.bottom = 60   (nhãn trục X xoay 45° kiểu "HH:00 DD/MM" — dài nhất trong các
 *                        groupBy — không có `containLabel` nên phải chừa cứng)
 * Chiều cao canvas = 44 + plot + 60. Class Tailwind phải là CHUỖI TĨNH (JIT scanner
 * không thấy class dựng bằng template literal), nên các giá trị dưới đây phải khớp tay
 * với `h-[...]` trong JSX.
 */
const GRID_TOP = 44
/** Panel "khách mới" — 344 = 44 + 240 + 60 */
const NEW_PLOT_HEIGHT = 240
/** Panel "chi tiêu" khi đứng cạnh panel khách mới — 364 = 44 + 260 + 60. Nhỉnh hơn
 * panel trên vì trục tiền có nhãn dài hơn ("250k") nên cần thở hơn. */
const SPEND_PLOT_HEIGHT = 260
/** `spendingOnly`: panel chi tiêu là chart DUY NHẤT nên được cao hơn — 416 = 44+312+60 */
const SPEND_ONLY_PLOT_HEIGHT = 312

/** Nhóm để `echarts.connect` nối con trỏ trục giữa hai instance. */
const CHART_GROUP = 'customer-analytics'

/** Hai series ẩn dựng dải tin cậy 95% quanh đường trend bằng kỹ thuật "stack" của
 * ECharts: series `lower` vô hình rồi series `upper - lower` tô nền lên trên — công
 * thức của `upper`/`lower` xem `trend.ts`. `key` phải riêng cho từng đường trend trong
 * cùng canvas (mỗi panel chỉ có một đường nên `key` chính là tên panel) để tránh lẫn
 * stack nếu sau này có nhiều đường trend cùng lúc. `z: 1` giữ dải NẰM DƯỚI cột dữ liệu;
 * `silent` + `tooltip.show = false` để dải không bắt hover/tooltip. Cố tình KHÔNG đưa
 * hai `name` này vào `legend.data` — chúng chỉ minh hoạ độ bất định, không phải một
 * chuỗi dữ liệu để bật/tắt.
 */
function confidenceBandSeries(
  trend: TrendResult,
  color: string,
  key: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  const stack = `trend-ci-${key}`
  return [
    {
      name: `__trend-ci-lower-${key}`,
      type: 'line',
      stack,
      data: trend.lower,
      symbol: 'none',
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      tooltip: { show: false },
      silent: true,
      z: 1,
    },
    {
      name: `__trend-ci-band-${key}`,
      type: 'line',
      stack,
      data: trend.upper.map((u, i) => {
        const l = trend.lower[i]
        return u === null || l === null ? null : Number((u - l).toFixed(2))
      }),
      symbol: 'none',
      lineStyle: { opacity: 0 },
      areaStyle: { color, opacity: 0.12 },
      tooltip: { show: false },
      silent: true,
      z: 1,
    },
  ]
}

/** Khung card của một chart: viền bo tròn + tiêu đề HTML phía trên canvas. Tiêu đề đặt
 * bằng HTML (không phải `title` của ECharts) vì `title` vẽ TRONG canvas nên đè lên tên
 * trục Y, và để khớp đúng format tiêu đề của chart lịch sử xu. */
function ChartCard({
  title,
  subtitle,
  heightClass,
  containerRef,
  isLoading,
  isEmpty,
  emptyText,
  trend,
  hint,
}: {
  title: string
  subtitle: string
  /** Giải thích chỉ số của panel cho người ngoài ngành. */
  hint: string
  heightClass: string
  containerRef: React.RefObject<HTMLDivElement>
  isLoading: boolean
  isEmpty: boolean
  emptyText: string
  /** Badge slope + R² của đường trend; ẩn khi không đủ dữ liệu để hồi quy. */
  trend?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-white dark:border-gray-700 dark:bg-transparent">
      <div className="px-4 pt-4">
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-between items-baseline">
          <h3 className="flex gap-1.5 items-center text-sm font-semibold text-gray-900 dark:text-white">
            {title}
            <InfoHint content={hint} ariaLabel={title} />
          </h3>
          {!isLoading && !isEmpty && trend}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        {/* Đặt trong TỪNG card, ngay dưới hàng chỉ số nó giải thích — giống chart lịch sử
            xu. Đặt một lần dưới cả hai card thì tiết kiệm được một dòng nhưng bị đẩy
            xuống ~700px dưới chỗ cần dùng, người dùng không tìm ra. Accordion đang đóng
            chỉ tốn một dòng nên nhân đôi rẻ hơn nhiều so với mất khả năng tìm thấy. */}
        <TrendReadingGuide />
      </div>
      <div className={'relative w-full ' + heightClass}>
        <div
          ref={containerRef}
          className={'h-full w-full ' + (isLoading || isEmpty ? 'invisible' : '')}
        />
        {isLoading && <Skeleton className="absolute inset-2 h-auto w-auto" />}
        {!isLoading && isEmpty && (
          <div className="flex absolute inset-0 justify-center items-center text-muted-foreground">
            {emptyText}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Rút gọn nhãn HIỂN THỊ trên legend cho các entry "kỳ trước" ("<panel> · Kỳ trước" →
 * "<panel> · Trước") — chỉ đổi CHỮ HIỂN THỊ trên legend, không đổi `name` gốc của
 * series nên tooltip + toggle-theo-tên của echarts không bị ảnh hưởng. Giữ nguyên tiền
 * tố panel ("Khách mới"/"Chi tiêu") vì đó là thứ duy nhất nói entry thuộc panel nào —
 * không được rút gọn hay bỏ.
 */
const legendFormatter = (
  name: string,
  nameNew: string,
  nameSpend: string,
  namePrev: string,
  shortPrev: string,
): string => {
  if (name === `${nameNew} · ${namePrev}`) return `${nameNew} · ${shortPrev}`
  if (name === `${nameSpend} · ${namePrev}`) return `${nameSpend} · ${shortPrev}`
  return name
}

/**
 * Tooltip dùng chung cho cả hai grid (khách mới + chi tiêu), nối với nhau qua
 * `axisPointer.link`. Khi tooltip có `formatter` tuỳ biến, ECharts gộp series của
 * TẤT CẢ trục X đã liên kết vào MỘT mảng `params` duy nhất trong MỘT lần gọi — khác
 * với hành vi mặc định (không có formatter) vốn build riêng từng khối theo từng trục
 * rồi nối lại, khiến header ngày bị lặp. Vì params đã gộp, chỉ cần lấy nhãn ngày MỘT
 * LẦN từ `params[0].name`. Series trend không cần tự lọc ở đây — nó bị loại khỏi
 * tooltip từ nguồn qua `tooltip: { show: false }` ngay trên định nghĩa series.
 *
 * Chế độ so sánh: thay vì thêm một DÒNG riêng cho "kỳ trước" (số dòng tăng gấp đôi,
 * tooltip biến thành bảng), giá trị kỳ trước được gộp NGAY TRÊN CÙNG DÒNG với giá trị
 * hiện tại, dạng phụ chú mờ trong ngoặc — `2 khách (Trước: 1 khách)`. Tooltip luôn có
 * đúng 2 dòng dữ liệu (khách mới, chi tiêu) bất kể compare bật hay tắt.
 */
interface TooltipParam {
  seriesName: string
  value: number | null
  name: string
  marker: string
}

/** Tên bốn series phương thức thanh toán, để tooltip tra cứu bằng `seriesName`. */
interface PaymentMethodNames {
  bank: string
  cash: string
  point: string
  credit: string
}

const buildTooltipFormatter = (
  nameNew: string,
  nameSpend: string,
  namePrev: string,
  legendPreviousShort: string,
  axisCustomers: string,
  mutedColor: string,
  methodNames: PaymentMethodNames,
  totalMarkerColor: string,
  // Format giá trị của HAI dòng chi tiêu (bốn phương thức + tổng) — tiêm từ ngoài để
  // đổi theo metric ('amount' → formatCurrency, 'count' → "<n> lần") mà không phải
  // nhân đôi toàn bộ hàm formatter này.
  formatSpendValue: (v: number) => string,
  // Nhãn dòng TỔNG (ví dụ "Tổng chi tiêu") — khác `nameSpend` ("Chi tiêu", tên series)
  // để dòng tổng đọc rõ là TỔNG chứ không lẫn với một dòng phương thức.
  spendTotalLabel: string,
) => (rawParams: TooltipParam | TooltipParam[]): string => {
  const params = Array.isArray(rawParams) ? rawParams : [rawParams]
  if (params.length === 0) return ''

  const byName = (name: string) => params.find((p) => p.seriesName === name)
  const header = params[0].name

  const row = (
    marker: string,
    label: string,
    current: number,
    previous: number | undefined,
    formatValue: (v: number) => string,
  ) => {
    const prevText =
      previous === undefined
        ? ''
        : ` <span style="color:${mutedColor}">(${legendPreviousShort}: ${formatValue(previous)})</span>`
    return `${marker}${label}&nbsp;&nbsp;<strong>${formatValue(current)}</strong>${prevText}`
  }

  const lines: string[] = []
  const newP = byName(nameNew)
  if (newP) {
    lines.push(
      row(
        newP.marker,
        nameNew,
        newP.value ?? 0,
        byName(`${nameNew} · ${namePrev}`)?.value ?? undefined,
        (v) => `${v} ${axisCustomers}`,
      ),
    )
  }

  // Chi tiêu giờ là BỐN series chồng (theo phương thức) thay vì một series duy nhất
  // đặt tên `nameSpend` — liệt kê từng phương thức có mặt trong `params` (bỏ qua
  // phương thức = 0 tiền cho gọn), rồi một dòng TỔNG cộng ở cuối. Tổng được tính lại
  // từ chính bốn giá trị trong params (bất biến: bốn totalAmount* cộng = totalAmount)
  // thay vì đọc lại mảng ngoài closure, để luôn khớp с những gì đang thật sự hiển thị
  // trên trục đang hover.
  const methodParams = (
    [
      [methodNames.bank, byName(methodNames.bank)],
      [methodNames.cash, byName(methodNames.cash)],
      [methodNames.point, byName(methodNames.point)],
      [methodNames.credit, byName(methodNames.credit)],
    ] as const
  ).filter((entry): entry is [string, TooltipParam] => entry[1] !== undefined)

  // Chỉ liệt kê phương thức có tiền/giao dịch (> 0); phương thức 0 bỏ cho gọn.
  const nonZeroMethods = methodParams.filter(([, p]) => (p.value ?? 0) > 0)
  nonZeroMethods.forEach(([label, p]) => {
    lines.push(row(p.marker, label, p.value ?? 0, undefined, formatSpendValue))
  })

  // Dòng TỔNG chỉ hiện khi cột có TỪ HAI phương thức trở lên — với một phương thức
  // duy nhất thì tổng đúng bằng dòng phương thức đó, thêm dòng tổng chỉ gây trùng lặp.
  // Khi hiện, làm NỔI BẬT: tách khỏi các dòng phương thức bằng một đường kẻ trên +
  // nhãn in đậm, để đọc rõ đây là con số cộng gộp.
  if (nonZeroMethods.length > 1) {
    const total = nonZeroMethods.reduce((s, [, p]) => s + (p.value ?? 0), 0)
    const prevTotal = byName(`${nameSpend} · ${namePrev}`)?.value
    const prevText =
      prevTotal == null
        ? ''
        : ` <span style="color:${mutedColor}">(${legendPreviousShort}: ${formatSpendValue(prevTotal)})</span>`
    const totalMarker = `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:9px;height:9px;background-color:${totalMarkerColor};"></span>`
    lines.push(
      `<div style="margin-top:5px;padding-top:5px;border-top:1px solid ${mutedColor}">` +
        `${totalMarker}<strong>${spendTotalLabel}</strong>&nbsp;&nbsp;<strong>${formatSpendValue(total)}</strong>${prevText}</div>`,
    )
  }

  return `<div>${header}</div>${lines.join('<br/>')}`
}

export default function CustomerAnalyticsChart({
  newCustomers,
  newCustomersPrev,
  spending,
  spendingPrev,
  groupBy,
  compareEnabled,
  isLoading,
  spendingOnly = false,
}: CustomerAnalyticsChartProps) {
  const { t } = useTranslation('customer')
  const newChartRef = useRef<HTMLDivElement>(null)
  const spendChartRef = useRef<HTMLDivElement>(null)
  const colors = useChartColors()

  const formatDate = useCallback(
    (dateStr: string) => {
      switch (groupBy) {
        case UserStatisticsGroupBy.HOUR:
          return moment(dateStr).format('HH:00 DD/MM')
        case UserStatisticsGroupBy.WEEK:
          return `${t('customer.analytics.weekPrefix')}${moment(dateStr).isoWeek()}/${moment(dateStr).isoWeekYear()}`
        case UserStatisticsGroupBy.MONTH:
          return moment(dateStr).format('MM/YYYY')
        case UserStatisticsGroupBy.YEAR:
          return moment(dateStr).format('YYYY')
        default:
          return moment(dateStr).format('DD/MM')
      }
    },
    [groupBy, t],
  )

  const xLabels = useMemo(
    () => newCustomers.map((it) => formatDate(it.time)),
    [newCustomers, formatDate],
  )
  const newValues = useMemo(() => newCustomers.map((it) => it.count), [newCustomers])
  const newPrevValues = useMemo(
    () => newCustomers.map((_, i) => newCustomersPrev[i]?.count ?? 0),
    [newCustomers, newCustomersPrev],
  )
  const spendValues = useMemo(
    () => newCustomers.map((_, i) => spending[i]?.totalAmount ?? 0),
    [newCustomers, spending],
  )
  const spendPrevValues = useMemo(
    () => newCustomers.map((_, i) => spendingPrev[i]?.totalAmount ?? 0),
    [newCustomers, spendingPrev],
  )
  // Bốn chuỗi giá trị theo phương thức thanh toán — mỗi chuỗi nuôi MỘT series cột
  // trong stack "chi tiêu theo phương thức". Cùng chỉ số `i` với `spendValues` (đều
  // suy từ `newCustomers` để khớp độ dài trục X), nên tổng bốn giá trị tại mỗi `i`
  // luôn bằng `spendValues[i]` (bất biến do BE đảm bảo: bốn `totalAmount*` cộng lại =
  // `totalAmount`).
  const spendBankValues = useMemo(
    () => newCustomers.map((_, i) => spending[i]?.totalAmountBank ?? 0),
    [newCustomers, spending],
  )
  const spendCashValues = useMemo(
    () => newCustomers.map((_, i) => spending[i]?.totalAmountCash ?? 0),
    [newCustomers, spending],
  )
  const spendPointValues = useMemo(
    () => newCustomers.map((_, i) => spending[i]?.totalAmountPoint ?? 0),
    [newCustomers, spending],
  )
  const spendCreditValues = useMemo(
    () => newCustomers.map((_, i) => spending[i]?.totalAmountCreditCard ?? 0),
    [newCustomers, spending],
  )

  const isEmpty = !isLoading && newCustomers.length === 0

  // Tính ở cấp component vì phần render cần các chỉ số cho badge; effect tái dùng
  // `.values`/`.upper`/`.lower` để vẽ đường và dải tin cậy.
  // Bản `*Raw` là kết quả CHƯA lọc — badge + popover dùng bản này để giải thích được cả
  // xu hướng đã bị ẩn. Bản đã lọc qua `isTrendVisible` (p-value + số mốc tối thiểu, KHÔNG
  // phải ngưỡng R²) mới được dùng để VẼ: không để một xu hướng không có ý nghĩa thống kê
  // kẻ một đường trông chắc chắn xuyên qua chart.
  const newTrendRaw = useMemo(() => trendOf(newValues), [newValues])
  const spendTrendRaw = useMemo(() => trendOf(spendValues), [spendValues])
  const newTrend = isTrendVisible(newTrendRaw) ? newTrendRaw : null
  const spendTrend = isTrendVisible(spendTrendRaw) ? spendTrendRaw : null

  useEffect(() => {
    if (isLoading || isEmpty) return

    const nameNew = t('customer.analytics.seriesNewCustomers')
    const nameSpend = t('customer.analytics.seriesSpending')
    const namePrev = t('customer.analytics.seriesPrevious')
    const nameTrend = t('customer.analytics.trendLine')
    const legendPreviousShort = t('customer.analytics.legendPreviousShort')
    const axisAmountMillion = t('customer.analytics.axisAmountMillion')
    const axisAmountThousand = t('customer.analytics.axisAmountThousand')
    const axisCustomers = t('customer.analytics.axisCustomers')
    // Tên bốn phương thức thanh toán — TÁI DÙNG key đã có sẵn cho dropdown filter
    // (`paymentBank/Cash/Point/Credit`), không tạo key i18n mới.
    const nameBank = t('customer.analytics.paymentBank')
    const nameCash = t('customer.analytics.paymentCash')
    const namePoint = t('customer.analytics.paymentPoint')
    const nameCredit = t('customer.analytics.paymentCredit')

    const barStyle = { borderRadius: [4, 4, 0, 0] as [number, number, number, number] }

    // Rút gọn tiền TÁI DÙNG cho cả nhãn trục Y (`amountAxisLabel.formatter` bên dưới)
    // lẫn nhãn trên đầu cột chi tiêu — cùng MỘT hàm để trục và nhãn cột luôn khớp nhau
    // (không hand-roll formatter tiền thứ hai).
    const formatAmountShort = (v: number) =>
      v >= 1_000_000
        ? `${v / 1_000_000}${axisAmountMillion}`
        : `${v / 1000}${axisAmountThousand}`

    // Format giá trị của HAI dòng chi tiêu trong tooltip (bốn phương thức + tổng).
    const formatSpendValue = (v: number) => formatCurrency(v)

    // Nhãn trên đầu cột: ẨN khi giá trị = 0 để không rối mắt với hàng loạt "0"/"0k" ở
    // các ô trống — giống cách chart đăng ký khách hàng cũ đã làm. Cỡ chữ nhỏ (11px),
    // màu mượn từ `useChartColors().label` (không hardcode hex).
    const barLabelStyle = { fontSize: 11, color: colors.label }
    const newCountLabel = {
      show: true,
      position: 'top' as const,
      ...barLabelStyle,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (p: any) => (p.value === 0 ? '' : `${p.value}`),
    }
    // Nhãn TỔNG trên đầu stack — gắn vào series TRÊN CÙNG (credit, xem bên dưới), đọc
    // tổng từ `spendValues[dataIndex]` chứ KHÔNG phải `p.value` của riêng segment
    // credit: vì credit là series cuối trong stack, cạnh trên của rect của nó luôn
    // trùng đỉnh cả cột dù giá trị riêng của nó = 0 (base = tổng 3 segment dưới), nên
    // đây là nơi đúng để đặt MỘT nhãn tổng duy nhất thay vì bốn nhãn/segment (nhãn theo
    // từng đoạn quá rối mắt trên một cột đã chia bốn màu).
    const stackTotalLabel = {
      show: true,
      position: 'top' as const,
      ...barLabelStyle,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (p: any) => {
        const total = spendValues[p.dataIndex] ?? 0
        if (total === 0) return ''
        return formatAmountShort(total)
      },
    }

    // Series chi tiêu luôn nằm ở trục 0: từ khi mỗi panel là MỘT instance ECharts riêng,
    // chart chi tiêu chỉ có duy nhất một xAxis/yAxis. (Trước đây khi hai panel chung một
    // canvas, chỉ số này là 1 để trỏ sang grid thứ hai — giữ lại giá trị đó sau khi tách
    // gây lỗi runtime `xAxis "1" not found`.)
    const spendGridIndex = 0
    // KHÔNG dùng viền tách đoạn stack ở đây. Với nhiều mốc (vd "Năm này" theo NGÀY ≈
    // 200 cột) mỗi cột chỉ rộng ~4px; viền 2px hai bên nuốt trọn bề rộng, cột còn trơ
    // viền = màu nền → biến mất hoàn toàn trên nền trắng (chính là bug "chart chi tiêu
    // không hiện cột"). Bốn phương thức đã KHÁC MÀU rõ nên không cần viền để tách đoạn.
    const stackSpacer = {}
    const STACK_ID = 'spend-method'
    // `data: []` (không ai chi tiêu trong kỳ) là dữ liệu hợp lệ → vẫn vẽ cột 0.
    // Bốn series CHỒNG (cùng `stack`) theo phương thức thanh toán — thay cho MỘT
    // series `totalAmount` cũ. Thứ tự đáy → đỉnh: bank, cash, point, credit (khớp thứ
    // tự cột `colBank/colCash/colPoint/colCredit` của bảng chi tiêu). Legend tự động
    // liệt kê đủ bốn tên này (từ `series.map(s => s.name)` ở `chart.setOption` bên
    // dưới) nên người dùng bật/tắt TỪNG phương thức bằng click legend — hành vi có sẵn
    // của ECharts, không cần code toggle riêng.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spendSeries: any[] = [
      {
        name: nameBank, type: 'bar', stack: STACK_ID,
        xAxisIndex: spendGridIndex, yAxisIndex: spendGridIndex,
        data: spendBankValues, itemStyle: { color: colors.mixBank, ...stackSpacer },
      },
      {
        name: nameCash, type: 'bar', stack: STACK_ID,
        xAxisIndex: spendGridIndex, yAxisIndex: spendGridIndex,
        data: spendCashValues, itemStyle: { color: colors.mixCash, ...stackSpacer },
      },
      {
        name: namePoint, type: 'bar', stack: STACK_ID,
        xAxisIndex: spendGridIndex, yAxisIndex: spendGridIndex,
        data: spendPointValues, itemStyle: { color: colors.mixPoint, ...stackSpacer },
      },
      {
        // Series TRÊN CÙNG của stack — mang nhãn TỔNG duy nhất (`stackTotalLabel`),
        // cộng thêm bo góc trên (`barStyle`) vì đây là cạnh trên cùng của cả cột.
        name: nameCredit, type: 'bar', stack: STACK_ID,
        xAxisIndex: spendGridIndex, yAxisIndex: spendGridIndex,
        data: spendCreditValues, itemStyle: { color: colors.mixCredit, ...stackSpacer, ...barStyle },
        label: stackTotalLabel,
      },
    ]
    if (compareEnabled) {
      // Kỳ TRƯỚC KHÔNG chồng theo phương thức — vẫn MỘT cột xám tổng như trước, đứng
      // CẠNH stack kỳ hiện tại (không cùng `stack` id nên ECharts tự xếp thành hai cột
      // riêng trong cùng category). Bốn đoạn màu nữa cho kỳ trước sẽ không đọc nổi.
      spendSeries.push({
        name: `${nameSpend} · ${namePrev}`, type: 'bar', xAxisIndex: spendGridIndex, yAxisIndex: spendGridIndex,
        data: spendPrevValues, itemStyle: { color: colors.previous, ...barStyle },
      })
    }
    if (spendTrend) {
      // Đường trend bám TỔNG chi tiêu — vẫn là series LINE riêng trên cùng grid chi
      // tiêu, không tham gia stack.
      spendSeries.push({
        name: `${nameSpend} · ${nameTrend}`, type: 'line', xAxisIndex: spendGridIndex, yAxisIndex: spendGridIndex,
        data: spendTrend.values, symbol: 'circle', symbolSize: 7, smooth: false, connectNulls: false,
        tooltip: { show: false },
        lineStyle: { color: colors.trend, type: 'dashed', width: 2 },
        itemStyle: { color: colors.trend }, z: 3,
      })
      spendSeries.push(
        ...confidenceBandSeries(spendTrend, colors.trend, 'spend').map((s) => ({
          ...s, xAxisIndex: spendGridIndex, yAxisIndex: spendGridIndex,
        })),
      )
    }

    const amountAxisLabel = {
      color: colors.label,
      formatter: formatAmountShort,
    }
    // Trục Y của panel chi tiêu: trục tiền rút gọn (`amountAxisLabel`, không
    // `minInterval` — số tiền không cần ràng buộc số nguyên).
    const spendYAxisExtra = {
      name: t('customer.analytics.axisAmount'),
      nameTextStyle: { color: colors.label },
      axisLabel: amountAxisLabel,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newSeries: any[] = [
      {
        name: nameNew, type: 'bar', xAxisIndex: 0, yAxisIndex: 0,
        data: newValues, itemStyle: { color: colors.newCustomer, ...barStyle },
        // Chỉ cột kỳ hiện tại có nhãn, cùng lý do với `spendSeries` phía trên.
        label: newCountLabel,
      },
    ]
    if (compareEnabled) {
      newSeries.push({
        name: `${nameNew} · ${namePrev}`, type: 'bar', xAxisIndex: 0, yAxisIndex: 0,
        data: newPrevValues, itemStyle: { color: colors.previous, ...barStyle },
      })
    }
    if (newTrend) {
      newSeries.push({
        name: `${nameNew} · ${nameTrend}`, type: 'line', xAxisIndex: 0, yAxisIndex: 0,
        data: newTrend.values, symbol: 'circle', symbolSize: 7, smooth: false, connectNulls: false,
        lineStyle: { color: colors.trend, type: 'dashed', width: 2 },
        itemStyle: { color: colors.trend }, z: 3,
        // Trend là đường hồi quy minh hoạ, không phải số liệu thật (vd. "0.51 khách"
        // không có nghĩa) — loại khỏi tooltip ngay tại nguồn thay vì lọc theo tên trong
        // formatter, để không phụ thuộc vào việc formatter có được gọi đúng cách hay không.
        tooltip: { show: false },
      })
      newSeries.push(
        ...confidenceBandSeries(newTrend, colors.trend, 'new').map((s) => ({
          ...s, xAxisIndex: 0, yAxisIndex: 0,
        })),
      )
    }

    // MỘT tooltip dùng chung cho cả hai chart: `buildTooltipFormatter` tra series bằng
    // `seriesName`, mà mỗi instance chỉ nhận params của series CỦA NÓ — nên cùng một
    // formatter tự sinh ra đúng phần nội dung cho từng panel, không cần tách hai bản.
    const tooltip = {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      formatter: buildTooltipFormatter(
        nameNew,
        nameSpend,
        namePrev,
        legendPreviousShort,
        axisCustomers,
        colors.label,
        { bank: nameBank, cash: nameCash, point: namePoint, credit: nameCredit },
        colors.spending,
        formatSpendValue,
        t('customer.analytics.totalSpending'),
      ),
    }

    // Legend gọn: bỏ tiền tố lặp "Kỳ trước" đầy đủ, chỉ hiển thị bản rút gọn
    // (`legendFormatter`) — `name` gốc của series (dùng cho tooltip + toggle) giữ nguyên
    // nên KHÔNG đổi định danh, chỉ đổi nhãn HIỂN THỊ. Luôn render dù chỉ có 1 series —
    // legend vẫn có ích để xác nhận màu, và tăng lên >= 2 ngay khi bật so sánh.
    // Hai series ẩn của dải tin cậy (`__trend-ci-*`, xem `confidenceBandSeries`) bị lọc
    // khỏi `legend.data` — chúng minh hoạ độ bất định, không phải chuỗi để bật/tắt.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildLegend = (seriesList: any[]) => ({
      top: 0,
      itemGap: 14,
      itemWidth: 14,
      itemHeight: 10,
      textStyle: { color: colors.label, fontSize: 11 },
      data: seriesList
        .filter((s) => !String(s.name).startsWith('__trend-ci-'))
        .map((s) => s.name),
      formatter: (name: string) =>
        legendFormatter(name, nameNew, nameSpend, namePrev, legendPreviousShort),
    })

    const charts: echarts.ECharts[] = []

    /** Dựng MỘT chart trong MỘT card. `renderer: 'svg'`: renderer canvas rasterize theo
     * devicePixelRatio nên chữ trong chart (nhãn, legend, trục) trông mờ hơn hẳn text
     * HTML xung quanh — SVG luôn nét ở mọi mật độ điểm ảnh và không cần chỉnh DPR tay. */
    const mount = (
      el: HTMLDivElement,
      plotHeight: number,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yAxis: any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seriesList: any[],
    ) => {
      const chart = echarts.init(el, undefined, { renderer: 'svg' })
      chart.setOption({
        grid: { left: 64, right: 20, top: GRID_TOP, height: plotHeight },
        tooltip,
        legend: buildLegend(seriesList),
        xAxis: {
          type: 'category',
          data: xLabels,
          axisLabel: { rotate: 45, color: colors.label },
        },
        yAxis,
        series: seriesList,
      })
      charts.push(chart)
    }

    if (!spendingOnly && newChartRef.current) {
      mount(
        newChartRef.current,
        NEW_PLOT_HEIGHT,
        {
          type: 'value',
          name: axisCustomers,
          nameTextStyle: { color: colors.label },
          minInterval: 1,
          axisLabel: { color: colors.label },
          splitLine: { show: true, lineStyle: { type: 'dashed', color: colors.splitLine } },
        },
        newSeries,
      )
    }

    if (spendChartRef.current) {
      mount(
        spendChartRef.current,
        spendingOnly ? SPEND_ONLY_PLOT_HEIGHT : SPEND_PLOT_HEIGHT,
        {
          type: 'value',
          ...spendYAxisExtra,
          splitLine: { show: true, lineStyle: { type: 'dashed', color: colors.splitLine } },
        },
        spendSeries,
      )
    }

    // Hai panel giờ là hai INSTANCE riêng, nên `axisPointer.link` (chỉ nối được các grid
    // TRONG cùng một instance) không còn tác dụng. `connect` khôi phục đúng hành vi cũ:
    // hover một mốc thời gian sẽ soi cùng mốc đó ở cả hai chart.
    if (charts.length > 1) {
      charts.forEach((c) => {
        c.group = CHART_GROUP
      })
      echarts.connect(CHART_GROUP)
    }

    const onResize = () => charts.forEach((c) => c.resize())
    window.addEventListener('resize', onResize)
    return () => {
      charts.forEach((c) => c.dispose())
      window.removeEventListener('resize', onResize)
    }
  }, [
    xLabels, newValues, newPrevValues,
    spendValues, spendPrevValues,
    spendBankValues, spendCashValues, spendPointValues, spendCreditValues,
    compareEnabled, colors, isEmpty, isLoading, spendingOnly, t,
    newTrend, spendTrend,
  ])

  return (
    <div className="flex flex-col gap-4">
      {!spendingOnly && (
        <ChartCard
          title={t('customer.analytics.seriesNewCustomers')}
          hint={t('customer.analytics.hintNewCustomers')}
          subtitle={t('customer.analytics.chartUnit', {
            unit: t('customer.analytics.axisCustomers'),
          })}
          heightClass="h-[344px]"
          containerRef={newChartRef}
          isLoading={isLoading}
          isEmpty={isEmpty}
          emptyText={t('customer.analytics.emptyChart')}
          // Badge dùng bản RAW (chưa lọc qua `isTrendVisible`) để popover "Chi tiết mô
          // hình" giải thích được cả trend đã bị ẩn khỏi chart — đường kẻ + dải tin cậy
          // trong effect phía trên vẫn dùng bản đã lọc (`newTrend`).
          trend={
            newTrendRaw && (
              <TrendBadge
                slope={newTrendRaw.slope}
                intercept={newTrendRaw.intercept}
                r2={newTrendRaw.r2}
                pValue={newTrendRaw.pValue}
                n={newTrendRaw.n}
                groupBy={groupBy}
                ariaSeriesName={t('customer.analytics.seriesNewCustomers')}
                colorByDirection
                formatValue={(v) => `${v.toFixed(2)} ${t('customer.analytics.axisCustomers')}`}
              />
            )
          }
        />
      )}
      <ChartCard
        title={t('customer.analytics.seriesSpending')}
        hint={t('customer.analytics.hintSpending')}
        subtitle={t('customer.analytics.chartUnit', {
          unit: t('customer.analytics.axisAmount'),
        })}
        heightClass={spendingOnly ? 'h-[416px]' : 'h-[364px]'}
        containerRef={spendChartRef}
        isLoading={isLoading}
        isEmpty={isEmpty}
        emptyText={t('customer.analytics.emptyChart')}
        // Badge dùng bản RAW (chưa lọc qua `isTrendVisible`) — xem giải thích ở panel
        // "khách mới" phía trên.
        trend={
          spendTrendRaw && (
            <TrendBadge
              slope={spendTrendRaw.slope}
              intercept={spendTrendRaw.intercept}
              r2={spendTrendRaw.r2}
              pValue={spendTrendRaw.pValue}
              n={spendTrendRaw.n}
              groupBy={groupBy}
              ariaSeriesName={t('customer.analytics.seriesSpending')}
              colorByDirection
              formatValue={(v) => formatCurrency(v)}
            />
          )
        }
      />
    </div>
  )
}
